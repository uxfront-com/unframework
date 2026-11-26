import { existsSync, mkdirSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { run, tree } from "../helpers.ts";
import { check, consumer, designSystem, inRepository, SOURCE_TREE } from "./helpers.ts";

// A title with a class bound to a value, so it imports the shared `cx` (ADR-0121).
const TITLE = `export function CardTitle(props: { label: string }) {
  return <h2 class={["card-title", { long: props.label.length > 8 }]}>{props.label}</h2>;
}
`;

const packaged = async (under?: string) => {
	const root = designSystem({
		config: { targets: ["solid"], package: { resolveFrom: inRepository("packages/target-solid") } },
		frameworks: ["solid-js"],
		files: { "src/CardTitle.uf.tsx": TITLE },
		...(under ? { under } : {}),
	});
	const { code, stderr } = await run(root, "build", "--package");
	expect(stderr).toBe("");
	expect(code).toBe(0);
	return root;
};

describe("build --package: Solid", () => {
	it("builds compiled JS, declarations, and preserved JSX under the solid condition", async () => {
		const root = await packaged();
		const files = tree(join(root, "dist", "package"));
		expect(Object.keys(files)).toEqual(
			[
				"package.json",
				"solid/Card.d.ts",
				"solid/Card.js",
				"solid/Card.jsx",
				"solid/Card.uf.tsx.css",
				"solid/CardTitle.d.ts",
				"solid/CardTitle.js",
				"solid/CardTitle.jsx",
				// The shared helper modules the outputs import (ADR-0121), which no entry exports.
				"solid/_unframework/cx.js",
				"solid/_unframework/cx.jsx",
				"solid/index.d.ts",
				"solid/index.js",
				"solid/index.jsx",
				"solid/shared/format.js",
				"solid/shared/format.jsx",
				"solid/useToggle.d.ts",
				"solid/useToggle.js",
				"solid/useToggle.jsx",
				...SOURCE_TREE,
			].toSorted(),
		);
		// Solid's compiler ran on the JS, and left the JSX for the consumer's.
		expect(files["solid/CardTitle.js"]).toContain('from "solid-js/web"');
		expect(files["solid/CardTitle.js"]).toContain("template");
		expect(files["solid/CardTitle.js"]).not.toContain("ssr");
		expect(files["solid/CardTitle.jsx"]).toContain("<h2");
		expect(files["solid/CardTitle.jsx"]).not.toContain("solid-js/web");
		// Each stays on its own side of the condition.
		expect(files["solid/Card.js"]).toContain('from "./CardTitle.js"');
		expect(files["solid/Card.jsx"]).toContain('from "./CardTitle.jsx"');
		expect(files["solid/Card.jsx"]).toContain('import "./Card.uf.tsx.css"');
		// Each output imports a helper from the package's own `_unframework/`, on its side of the
		// condition, and declares none of its own.
		expect(files["solid/CardTitle.js"]).toContain('from "./_unframework/cx.js"');
		expect(files["solid/CardTitle.js"]).not.toMatch(/function cx\b/);
		expect(files["solid/CardTitle.jsx"]).toContain('from "./_unframework/cx.jsx"');
		expect(files["solid/CardTitle.jsx"]).not.toMatch(/function cx\b/);
		expect(files["solid/_unframework/cx.js"]).toMatch(/^export \{ cx \};$/m);
		expect(files["solid/_unframework/cx.jsx"]).toMatch(/^export \{ cx \};$/m);
		expect(JSON.stringify(JSON.parse(files["package.json"] ?? "").exports)).not.toContain(
			"_unframework",
		);
		const { exports } = JSON.parse(files["package.json"] ?? "");
		expect(exports["./solid"]).toEqual({
			types: "./solid/index.d.ts",
			solid: "./solid/index.jsx",
			default: "./solid/index.js",
		});
		// Conditions match in order: `default` before `solid` would hide it.
		expect(Object.keys(exports["./solid"])).toEqual(["types", "solid", "default"]);
	});

	it.each(["R&D", "C++"])("gives the same package under a directory named %s", async (under) => {
		const expected = tree(join(await packaged(), "dist", "package"));
		expect(tree(join(await packaged(under), "dist", "package"))).toEqual(expected);
	});

	it("reports a compiler that fails as UF7009, with its error and no stack", async () => {
		const root = designSystem({
			config: { targets: ["solid"] },
			frameworks: ["solid-js"],
			files: {
				"node_modules/babel-preset-solid/package.json": '{ "name": "babel-preset-solid" }',
				"node_modules/babel-preset-solid/index.js": 'throw new Error("the preset broke");\n',
			},
		});
		const installed = inRepository("packages/target-solid/node_modules");
		for (const name of ["tsdown", "@babel/core"]) {
			const link = join(root, "node_modules", name);
			mkdirSync(dirname(link), { recursive: true });
			symlinkSync(join(installed, name), link);
		}
		const { code, stderr } = await run(root, "build", "--package");
		expect(code).toBe(1);
		expect(stderr).toContain("UF7009");
		expect(stderr).toContain("the preset broke");
		expect(stderr).not.toMatch(/^\s+at /m);
		expect(existsSync(join(root, "dist", "package"))).toBe(false);
	});

	it("types a consumer that imports the subpath, and stops one that misuses it", async () => {
		const root = await packaged();
		const directory = consumer(root, "solid", {
			"Consumer.tsx": `import { Card, useToggle } from "demo-ds/solid";

export function Consumer() {
  const { on } = useToggle(true);
  return (
    <>
      <Card label={String(on())} />
      {/* @ts-expect-error label is a string. */}
      <Card label={1} />
    </>
  );
}
`,
		});
		const { code, output } = check("packages/cli", "tsc", ["-p", directory]);
		expect(output).toBe("");
		expect(code).toBe(0);
	});
});
