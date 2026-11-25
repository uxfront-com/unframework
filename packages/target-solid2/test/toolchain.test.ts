import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import type * as SolidWeb from "@solidjs/web";
import type { ToolchainContext, ToolchainFile } from "@unframework.dev/codegen";
import { createServer } from "vite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { toolchain } from "../src/toolchain/index.ts";
import { renderToString } from "../src/toolchain/server.ts";
import { compileForServer, goldens, packageDir, toolchainDir } from "./fixtures.ts";

const context: ToolchainContext = { toolchainDir, root: packageDir };
/** The declaration a styled golden's sheet import needs, as the toolchain project passes it. */
const SHEETS = join(toolchainDir, "sheets.d.ts");
/** The declarations of the styling engines' modules, which the styled goldens import (ADR-0064). */
const STYLEFRAME = join(toolchainDir, "../../integration/styleframe.d.ts");
const FIXTURE_ENGINE = join(toolchainDir, "../../integration/fixture-engine.d.ts");
const require = createRequire(import.meta.url);
const scratch = join(packageDir, ".uf-tmp", `toolchain-${randomUUID()}`);
beforeAll(() => mkdirSync(scratch, { recursive: true }));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** Every Solid 2 golden; the corpus has at least the two `basics` cases. */
function solidGoldens(): ToolchainFile[] {
	const files = goldens("solid2");
	expect(files.map((file) => file.path.split("/").at(-1))).toEqual(
		expect.arrayContaining(["Hello.tsx", "ProfileCard.tsx"]),
	);
	return files;
}

function golden(name: string): ToolchainFile {
	const file = solidGoldens().find((entry) => entry.path.endsWith(`/${name}`));
	if (!file) throw new Error(`No Solid 2 golden named ${name}`);
	return file;
}

/** A file in this package's scratch directory, whose imports resolve from its node_modules. */
function scratchFile(name: string, contents: string): string {
	const path = join(scratch, name);
	writeFileSync(path, contents);
	return path;
}

/**
 * A golden as the toolchain's own Vite configuration serves it, @solidjs/vite-plugin included, on
 * a plain dev server: the browser's client environment, or the server's.
 */
async function transformed(mode: "browser" | "ssr"): Promise<string> {
	const root = join(scratch, `vite-${mode}`);
	mkdirSync(root, { recursive: true });
	writeFileSync(join(root, "Hello.tsx"), golden("Hello.tsx").contents);
	const server = await createServer({
		...(await toolchain.vite(mode, { toolchainDir, root })),
		root,
		configFile: false,
		logLevel: "silent",
		appType: "custom",
		server: { middlewareMode: true, hmr: false, ws: false },
	});
	try {
		const environment = mode === "ssr" ? server.environments.ssr : server.environments.client;
		const result = await environment!.transformRequest("/Hello.tsx");
		return result!.code;
	} finally {
		await server.close();
	}
}

describe("solid2 toolchain", () => {
	it("names its runtime entries", () => {
		expect(toolchain.name).toBe("solid2");
		expect(toolchain.client).toBe("@unframework.dev/target-solid2/toolchain/client");
		expect(toolchain.server).toBe("@unframework.dev/target-solid2/toolchain/server");
		expect(toolchain.hydrate).toBe("@unframework.dev/target-solid2/toolchain/hydrate");
	});

	it("configures Vite with Solid 2's plugin, resolving Solid from the toolchain directory", async () => {
		const solid = ["solid-js", "@solidjs/web", "@solidjs/signals"];
		const browser = await toolchain.vite("browser", context);
		// @solidjs/vite-plugin is an array of plugins, `solid` the one that compiles.
		const names = (browser.plugins ?? [])
			.flat(2)
			.map((plugin) => (plugin && "name" in plugin ? plugin.name : undefined));
		expect(names).toContain("solid");
		expect(names).toEqual(
			expect.arrayContaining(["unframework:solid2-resolve", "unframework:solid2-undedupe"]),
		);
		expect(browser.resolve?.noExternal).toEqual(solid);
		// Served as it is, never pre-bundled from the project root, which holds Solid 1 here.
		expect(browser.optimizeDeps?.exclude).toEqual([...solid, "seroval", "seroval-plugins"]);
		const ssr = await toolchain.vite("ssr", context);
		expect(ssr.resolve?.noExternal).toEqual(solid);
		expect(ssr.optimizeDeps).toBeUndefined();
	});

	it("compiles DOM code without Solid's HMR wrapper in the browser, importing Solid 2", async () => {
		const code = await transformed("browser");
		expect(code).toContain("template(");
		expect(code).not.toMatch(/solid-refresh|\$\$registry|import\.meta\.hot/);
		expect(code).toMatch(/@solidjs\+web@2\.[^/]*\/node_modules\/@solidjs\/web\//);
	});

	it("compiles hydratable server code for SSR", async () => {
		const code = await transformed("ssr");
		// The root takes a spread, so Solid writes it with `ssrElement`, whose last argument
		// (`needsId`) prints the hydration key.
		expect(code).toMatch(/\.ssrElement\)\("p", [\s\S]*, true\);/);
		expect(code).not.toContain("template(");
	});
});

/** One file through Solid 2's compiler. */
async function check(contents: string) {
	const path = join(packageDir, "Fixture.tsx");
	return (await toolchain.frameworkCompile([{ path, contents }], context)).get(path);
}

describe("solid2 frameworkCompile (L3)", () => {
	// It checks every committed golden output, so its time grows with the corpus.
	it("accepts every committed golden output, with no warning", async () => {
		const files = solidGoldens();
		const results = await toolchain.frameworkCompile(files, context);
		expect(Object.fromEntries(results)).toEqual(
			Object.fromEntries(files.map((file) => [file.path, { errors: [], warnings: [] }])),
		);
	}, 60_000);

	it("rejects a mismatched closing tag", async () => {
		const broken = golden("Hello.tsx").contents.replace("</p>", "</span>");
		// @solidjs/compiler reports a parse error without its position.
		expect(await check(broken)).toEqual({
			errors: [
				{ message: "Expected corresponding JSX closing tag for 'p'.", code: "solid/compile" },
			],
			warnings: [],
		});
	});

	it("rejects HTML a browser would parse differently, at its template", async () => {
		const result = await check(
			[
				"export default function Card() {",
				"  return (",
				'    <p class="greeting">',
				"      <div>Hello, world!</div>",
				"    </p>",
				"  );",
				"}",
				"",
			].join("\n"),
		);
		// Solid 2's compiler refuses the template, where Solid 1's only warned.
		expect(result).toEqual({
			errors: [
				{
					message: [
						"The HTML provided is malformed and will yield unexpected output when evaluated by a browser.",
						"User HTML:",
						" <p><div>#text</div></p>",
						"Browser HTML:",
						" <p></p><div>#text</div><p></p>",
						"Original HTML:",
						" <p><div>Hello, world!</div></p>",
					].join("\n"),
					line: 3,
					column: 5,
					code: "solid/malformed-html",
				},
			],
			warnings: [],
		});
	});

	it("leaves types to the type check", async () => {
		const result = await check(
			'const count: number = "one";\n\nexport default function Count() {\n  return <p>{count}</p>;\n}\n',
		);
		expect(result).toEqual({ errors: [], warnings: [] });
	});

	it("refuses to check no files", async () => {
		await expect(toolchain.frameworkCompile([], context)).rejects.toThrow(/received no files/);
	});
});

describe("solid2 typecheck (L4)", () => {
	// It checks every committed golden output, so its time grows with the corpus.
	it("accepts every committed golden output in one run", async () => {
		const files = [...solidGoldens().map((file) => file.path), SHEETS, STYLEFRAME, FIXTURE_ENGINE];
		const results = await toolchain.typecheck(files, context);
		expect(Object.fromEntries(results)).toEqual(
			Object.fromEntries(files.map((file) => [file, []])),
		);
	}, 60_000);

	// It checks every committed golden output too, so its time grows with the corpus.
	it("reports each injected type error against its own file", async () => {
		const goldenFiles = [
			...solidGoldens().map((file) => file.path),
			SHEETS,
			STYLEFRAME,
			FIXTURE_ENGINE,
		];
		const script = scratchFile(
			"Script.tsx",
			'const count: number = "one";\n\nexport default function Script() {\n  return <p>{count}</p>;\n}\n',
		);
		const template = scratchFile(
			"Template.tsx",
			"export default function Template() {\n  return <p>{greet()}</p>;\n}\n",
		);
		const results = await toolchain.typecheck([...goldenFiles, script, template], context);
		expect(Object.fromEntries(results)).toEqual({
			...Object.fromEntries(goldenFiles.map((file) => [file, []])),
			[script]: [
				{
					message: "Type 'string' is not assignable to type 'number'.",
					line: 1,
					column: 7,
					code: "TS2322",
				},
			],
			[template]: [{ message: "Cannot find name 'greet'.", line: 2, column: 14, code: "TS2304" }],
		});
	}, 60_000);

	it("checks JSX against Solid's own types", async () => {
		const unknownProp = scratchFile(
			"UnknownProp.tsx",
			'export default function Field() {\n  return <input type="text" valu="x" />;\n}\n',
		);
		const [diagnostic] = (await toolchain.typecheck([unknownProp], context)).get(unknownProp)!;
		expect(diagnostic).toMatchObject({ line: 2, code: "TS2322" });
		expect(diagnostic?.message).toContain("'valu'");
	});
});

/** Compiles a golden the way the `ssr` project does, and imports it. */
async function compiled(file: ToolchainFile): Promise<unknown> {
	const code = await compileForServer(file.contents, file.path);
	const path = scratchFile(`ssr-${randomUUID()}.js`, code);
	return ((await import(path)) as { default: unknown }).default;
}

describe("solid2 renderToString (SSR)", () => {
	it("returns the component's HTML, with Solid's hydration keys", async () => {
		const ProfileCard = await compiled(golden("ProfileCard.tsx"));
		const html = await renderToString(ProfileCard, {});
		// A root that spreads its scope attributes renders through Solid's `ssrElement` (ADR-0063),
		// which, on Solid 2, writes no `style` the key leaves out, and no space after a class.
		expect(html.replace(/ _hk=[^ >]*/g, "")).toBe(
			[
				'<article class="profile" aria-labelledby="profile-name">',
				'<header class="profile-header">',
				`<img src="${golden("ProfileCard.tsx").contents.match(/src="([^"]+)"/)![1]}" alt="Ada's avatar" width="48" height="48">`,
				'<h2 id="profile-name">Ada Lovelace</h2>',
				"</header>",
				"<p>Mathematician &amp; writer<br>of the first published program</p>",
				"<hr>",
				'<label for="profile-note">Note</label>',
				'<input id="profile-note" type="text" name="note" placeholder="Say hello">',
				"</article>",
			].join(""),
		);
		// Solid 2's hydration key is `_hk`, unquoted where it can be.
		expect(html).toMatch(/^<article _hk=[^ >]+ /);
	});

	it("rejects what is not a component, naming what it received", async () => {
		await expect(renderToString({ default: () => "" }, {})).rejects.toThrow(
			"Expected a Solid component, received object.",
		);
	});

	it("rejects the undefined that Solid's browser build renders, instead of passing", async () => {
		// What the `ssr` project gets when @solidjs/vite-plugin runs without `ssr: true`: the browser
		// build of @solidjs/web, whose renderToStream logs an error and returns undefined.
		const browserBuild = join(dirname(require.resolve("@solidjs/web")), "web.js");
		const { renderToStream } = (await import(browserBuild)) as typeof SolidWeb;
		vi.doMock("@solidjs/web", async (original) => ({
			...(await original<typeof SolidWeb>()),
			renderToStream,
		}));
		vi.resetModules();
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});
		try {
			const server = await import("../src/toolchain/server.ts");
			const ProfileCard = await compiled(golden("ProfileCard.tsx"));
			await expect(server.renderToString(ProfileCard, {})).rejects.toThrow(
				"Solid's server render returned undefined, not HTML: @solidjs/web resolved to its browser build.",
			);
			expect(errors).toHaveBeenCalledWith(
				expect.objectContaining({
					message: expect.stringContaining("not supported in the browser"),
				}),
			);
		} finally {
			errors.mockRestore();
			vi.doUnmock("@solidjs/web");
			vi.resetModules();
		}
	});
});
