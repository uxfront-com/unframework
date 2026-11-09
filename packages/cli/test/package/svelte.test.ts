import { existsSync, mkdirSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { run, tree, write } from "../helpers.ts";
import { check, consumer, designSystem, inRepository, SOURCE_TREE } from "./helpers.ts";

const TOOLCHAIN = inRepository("tests/toolchains/svelte");

const svelte = (under?: string) =>
  designSystem({
    config: { targets: ["svelte"], package: { resolveFrom: TOOLCHAIN } },
    frameworks: ["svelte"],
    ...(under ? { under } : {}),
  });

const packaged = async (under?: string) => {
  const root = svelte(under);
  const { code, stderr } = await run(root, "build", "--package");
  expect(stderr).toBe("");
  expect(code).toBe(0);
  return root;
};

describe("build --package: Svelte", () => {
  it("keeps the components, turns modules into JS, and writes declarations", async () => {
    const root = await packaged();
    const files = tree(join(root, "dist", "package"));
    expect(Object.keys(files)).toEqual(
      [
        "package.json",
        "svelte/Card.svelte",
        "svelte/Card.svelte.d.ts",
        "svelte/Card.uf.tsx.css",
        "svelte/CardTitle.svelte",
        "svelte/CardTitle.svelte.d.ts",
        "svelte/index.d.ts",
        "svelte/index.js",
        "svelte/shared/format.d.ts",
        "svelte/shared/format.js",
        "svelte/useToggle.svelte.d.ts",
        "svelte/useToggle.svelte.js",
        ...SOURCE_TREE,
      ].toSorted(),
    );
    expect(files["svelte/Card.svelte"]).toEqual(tree(join(root, "dist", "svelte"))["Card.svelte"]);
    expect(files["svelte/shared/format.js"]).not.toContain(": string");
    expect(files["svelte/useToggle.svelte.js"]).toContain("$state");
    expect(files["svelte/CardTitle.svelte.d.ts"]).toContain("Component<");
    // The component keeps its sheet, and the declaration, which a strict consumer reads, doesn't.
    expect(files["svelte/Card.svelte"]).toContain("Card.uf.tsx.css");
    expect(files["svelte/Card.svelte.d.ts"]).not.toContain(".css");
    const manifest = JSON.parse(files["package.json"] ?? "");
    expect(manifest.exports["./svelte"]).toEqual({
      types: "./svelte/index.d.ts",
      svelte: "./svelte/index.js",
    });
    // Conditions match in order: `svelte` before `types` would hide the declarations.
    expect(Object.keys(manifest.exports["./svelte"])).toEqual(["types", "svelte"]);
    expect(manifest.peerDependencies).toEqual({ svelte: "^5.29.0" });
  });

  it.each(["R&D", "C++"])("gives the same package under a directory named %s", async (under) => {
    const expected = tree(join(await packaged(), "dist", "package"));
    expect(tree(join(await packaged(under), "dist", "package"))).toEqual(expected);
  });

  it("ignores the project's own Svelte config", async () => {
    const root = svelte();
    write(root, { "svelte.config.js": 'throw new Error("this config was read");\n' });
    const { code, stderr } = await run(root, "build", "--package");
    expect(stderr).toBe("");
    expect(code).toBe(0);
  });

  it("packages what only the project can declare: a passed-through module", async () => {
    const root = svelte();
    write(root, {
      "src/Styled.uf.tsx": `import { tone } from "virtual:styled";

import "virtual:styled.css";

export default function Styled() {
  return <p class={tone()}>Hi</p>;
}
`,
    });
    const { code, stderr } = await run(root, "build", "--package");
    expect(stderr).toBe("");
    expect(code).toBe(0);
    const files = tree(join(root, "dist", "package"));
    expect(files["svelte/Styled.svelte"]).toContain('"virtual:styled"');
    expect(files["svelte/Styled.svelte.d.ts"]).not.toContain("virtual:styled.css");
  });

  it("types a consumer that imports the subpath, and stops one that misuses it", async () => {
    const root = await packaged();
    const directory = consumer(root, "svelte", {
      "Consumer.svelte": `<script lang="ts">
  import type { ComponentProps } from "svelte";
  import { Card, useToggle } from "demo-ds/svelte";

  const toggle = useToggle(true);
  // @ts-expect-error label is a string.
  const misused: ComponentProps<typeof Card> = { label: 1 };
</script>

<Card label={String(toggle.on)} />
<Card {...misused} />
`,
    });
    const { code, output } = check("tests/toolchains/svelte", "svelte-check", [
      "--workspace",
      directory,
      "--tsconfig",
      join(directory, "tsconfig.json"),
      "--diagnostic-sources",
      "js",
      "--fail-on-warnings",
      "--output",
      "machine",
    ]);
    expect(output).toContain(" 0 ERRORS 0 WARNINGS");
    expect(code).toBe(0);
  });

  it("reports a syntax error as UF7009, and keeps the last good package", async () => {
    const root = await packaged();
    const before = tree(join(root, "dist", "package"));
    // A shared module is copied as written, and svelte-package would transpile it regardless.
    write(root, { "src/shared/format.ts": "export const formatLabel = (;\n" });
    const { code, stderr } = await run(root, "build", "--package");
    expect(code).toBe(1);
    expect(stderr).toContain("UF7009");
    expect(stderr).toContain("(svelte)");
    expect(stderr).toContain("dist/svelte/shared/format.ts");
    expect(stderr).not.toContain(".package-");
    expect(tree(join(root, "dist", "package"))).toEqual(before);
  });

  it("reports a declaration it couldn't write as UF7009, which svelte-package only warns of", async () => {
    const root = await packaged();
    const before = tree(join(root, "dist", "package"));
    write(root, {
      "src/shared/format.ts": `export const formatLabel = (label: string): string => label.trim();
export const Klass = class {
  private y = 1;
};
`,
    });
    const { code, stderr } = await run(root, "build", "--package");
    expect(code).toBe(1);
    expect(stderr).toContain("UF7009");
    expect(stderr).toContain("may not be private or protected");
    expect(stderr).toContain("dist/svelte/shared/format.ts");
    expect(stderr).not.toContain(".package-");
    expect(tree(join(root, "dist", "package"))).toEqual(before);
  });

  it("fires UF7008 for a missing svelte-package, before anything is written", async () => {
    const root = designSystem({ config: { targets: ["svelte"] }, frameworks: ["svelte"] });
    const { code, stderr } = await run(root, "build", "--package");
    expect(code).toBe(1);
    expect(stderr).toContain("UF7008");
    expect(stderr).toContain("(svelte)");
    // The package's name, not the file of it that this reads.
    expect(stderr).toContain("needs @sveltejs/package,");
    expect(existsSync(join(root, "dist"))).toBe(false);
  });

  it("fires UF7008 for a missing typescript, which the module check needs", async () => {
    const root = designSystem({ config: { targets: ["svelte"] }, frameworks: ["svelte"] });
    const link = join(root, "node_modules", "@sveltejs", "package");
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(join(TOOLCHAIN, "node_modules", "@sveltejs", "package"), link);
    const { code, stderr } = await run(root, "build", "--package");
    expect(code).toBe(1);
    expect(stderr).toContain("UF7008");
    expect(stderr).toContain("needs typescript,");
    expect(stderr).not.toContain("needs @sveltejs/package,");
    expect(existsSync(join(root, "dist"))).toBe(false);
  });

  it("fires UF7008 when the project has no Svelte, before anything is written", async () => {
    const root = designSystem({
      config: { targets: ["svelte"], package: { resolveFrom: TOOLCHAIN } },
    });
    const { code, stderr } = await run(root, "build", "--package");
    expect(code).toBe(1);
    expect(stderr).toContain("UF7008");
    expect(stderr).toContain("reads the framework's types from svelte");
    expect(existsSync(join(root, "dist"))).toBe(false);
  });
});
