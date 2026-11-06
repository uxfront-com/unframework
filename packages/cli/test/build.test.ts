import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { compile, createFileResolver, createSyntacticOracle } from "@unframework/compiler";
import { describe, expect, it } from "vitest";

import { project, run, tree, write } from "./helpers.ts";

const TARGETS = ["react", "vue", "svelte", "solid", "angular", "qwik", "astro"] as const;

const CARD = `import { CardTitle } from "./CardTitle.uf.tsx";
import { formatLabel } from "./shared/format.ts";

import "./Card.css";

export default function Card(props: { label: string }) {
  return (
    <div class="card">
      <CardTitle label={formatLabel(props.label)} />
    </div>
  );
}
`;

const CARD_TITLE = `export function CardTitle(props: { label: string }) {
  return <h2>{props.label}</h2>;
}
`;

const FIXTURE = {
  "src/Card.uf.tsx": CARD,
  "src/CardTitle.uf.tsx": CARD_TITLE,
  "src/Card.css": ".card {\n  color: red;\n}\n",
  "src/shared/format.ts":
    "// Keep this comment.\nexport const formatLabel = (label: string): string => label.trim();\n",
  "src/forms/Field.uf.tsx": `import Card from "../Card.uf.tsx";

export default function Field() {
  return <Card label="Name" />;
}
`,
  "src/useToggle.uf.ts": `import { ref } from "unframework";

export function useToggle(initial: boolean) {
  const on = ref(initial);
  return { on };
}
`,
};

const SOURCES = [
  "src/Card.uf.tsx",
  "src/CardTitle.uf.tsx",
  "src/forms/Field.uf.tsx",
  "src/useToggle.uf.ts",
];
const COMMENT = /\/\/# sourceMappingURL=[^\n]+\.map\n$/;

const readFile = async (path: string) => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
};

/** What `compile()` emits for the fixture, by each target's path, as the tree mirrors `src`. */
async function compiled(root: string, target: (typeof TARGETS)[number]) {
  const typeOracle = createSyntacticOracle({ root, readFile });
  const resolve = createFileResolver({ root, readFile, typeOracle });
  const files: Record<string, string> = {};
  for (const source of SOURCES) {
    const { diagnostics, outputs } = await compile(readFileSync(join(root, source), "utf8"), {
      filename: source,
      targets: [target],
      resolve,
      typeOracle,
      sourceMap: true,
    });
    expect(diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
    const directory = relative("src", source).replace(/[^/]*$/, "");
    for (const output of outputs[target] ?? []) {
      files[join(directory, output.path)] = output.contents;
    }
  }
  await typeOracle.dispose();
  return files;
}

describe("build", () => {
  it("writes every target's files as compile() gives them, but for the comment", async () => {
    const root = project(FIXTURE);
    expect(await run(root, "build")).toMatchObject({ code: 0, stdout: "" });
    for (const target of TARGETS) {
      const written = tree(join(root, "dist", target));
      const expected = await compiled(root, target);
      expect(Object.keys(expected).length).toBeGreaterThan(3);
      for (const [path, contents] of Object.entries(expected)) {
        expect(written[path]?.replace(COMMENT, ""), `${target} ${path}`).toBe(contents);
      }
      const others = Object.keys(written).filter(
        (path) => !(path in expected) && path !== "index.ts" && !path.endsWith(".map"),
      );
      expect(others).toEqual([]);
    }
  });

  it("gives a JS or TS output a sidecar and a comment, and any other file neither", async () => {
    const root = project(FIXTURE);
    await run(root, "build");
    const react = tree(join(root, "dist/react"));
    expect(react["Card.tsx"]).toMatch(/\n\/\/# sourceMappingURL=Card\.tsx\.map\n$/);
    expect(react["Card.tsx.map"]).toBeDefined();
    expect(react["Card.uf.tsx.css"]).not.toContain("sourceMappingURL");
    expect(react["Card.uf.tsx.css.map"]).toBeUndefined();
    const vue = tree(join(root, "dist/vue"));
    expect(vue["Card.vue"]).not.toContain("sourceMappingURL");
    expect(vue["Card.vue.map"]).toBeUndefined();
  });

  it("writes a shared module's copy unchanged, since the project gives it no map", async () => {
    const root = project(FIXTURE);
    await run(root, "build");
    const react = tree(join(root, "dist/react"));
    expect(react["shared/format.ts"]).toBe(FIXTURE["src/shared/format.ts"]);
    expect(react["shared/format.ts.map"]).toBeUndefined();
  });

  it("names the source in a sidecar from where the file was written", async () => {
    const root = project(FIXTURE);
    await run(root, "build");
    const map = JSON.parse(readFileSync(join(root, "dist/react/forms/Field.tsx.map"), "utf8"));
    expect(map.sources).toEqual(["../../../src/forms/Field.uf.tsx"]);
    expect(map.sourcesContent).toEqual([FIXTURE["src/forms/Field.uf.tsx"]]);
    expect(map.version).toBe(3);
  });

  it("gives identical bytes on a second run and in another directory (P8)", async () => {
    const first = project(FIXTURE);
    await run(first, "build");
    const before = tree(join(first, "dist"));
    expect(await run(first, "build")).toMatchObject({ code: 0 });
    expect(tree(join(first, "dist"))).toEqual(before);
    const second = project(FIXTURE);
    await run(second, "build");
    expect(tree(join(second, "dist"))).toEqual(before);
    expect(JSON.stringify(before)).not.toContain(first);
  });

  it("writes a barrel per target in that target's import form", async () => {
    const root = project(FIXTURE);
    await run(root, "build");
    const barrel = (target: string) => readFileSync(join(root, "dist", target, "index.ts"), "utf8");
    expect(barrel("react")).toBe(
      [
        'export { CardTitle } from "./CardTitle";',
        'export { default as Card } from "./Card";',
        'export { default as Field } from "./forms/Field";',
        'export { useToggle } from "./useToggle";',
        "",
      ].join("\n"),
    );
    expect(barrel("vue")).toBe(
      [
        'export { default as Card } from "./Card.vue";',
        'export { default as CardTitle } from "./CardTitle.vue";',
        'export { default as Field } from "./forms/Field.vue";',
        'export { useToggle } from "./useToggle";',
        "",
      ].join("\n"),
    );
    expect(barrel("svelte")).toContain('export { useToggle } from "./useToggle.svelte";');
    expect(barrel("svelte")).toContain('export { default as Card } from "./Card.svelte";');
    expect(barrel("astro")).toContain('export { default as Card } from "./Card.astro";');
    expect(barrel("angular")).toContain('export { CardTitle } from "./card-title";');
    expect(barrel("angular")).toContain('export { useToggle } from "./use-toggle";');
  });

  it("exports an aliased component under its alias, and leaves a private one out", async () => {
    const root = project({
      "src/Box.uf.tsx": `function Inner() {
  return <i>inner</i>;
}

function Box() {
  return (
    <b>
      <Inner />
    </b>
  );
}

export { Box as Crate };
`,
      "unframework.config.mjs": 'export default { targets: ["react", "vue"] };\n',
    });
    expect(await run(root, "build")).toMatchObject({ code: 0 });
    const barrel = (target: string) => readFileSync(join(root, "dist", target, "index.ts"), "utf8");
    expect(barrel("react")).toBe('export { Crate } from "./Box";\n');
    expect(barrel("vue")).toBe('export { default as Crate } from "./Box.vue";\n');
  });

  it("writes one barrel line for a component exported twice under one name", async () => {
    const root = project({
      "src/Card.uf.tsx": `export default function Card() {
  return <i />;
}

export { Card };
`,
      "unframework.config.mjs": 'export default { targets: ["react", "vue"] };\n',
    });
    expect(await run(root, "build")).toMatchObject({ code: 0 });
    const barrel = (target: string) => readFileSync(join(root, "dist", target, "index.ts"), "utf8");
    expect(barrel("react")).toBe('export { default as Card } from "./Card";\n');
    expect(barrel("vue")).toBe('export { default as Card } from "./Card.vue";\n');
  });

  it("cleans each configured target's directory and leaves the rest of outDir", async () => {
    const root = project({
      ...FIXTURE,
      "unframework.config.mjs": 'export default { targets: ["vue"] };\n',
      "dist/vue/stale.txt": "stale",
      "dist/react/kept.txt": "kept",
      "dist/kept.txt": "kept",
    });
    expect(await run(root, "build")).toMatchObject({ code: 0 });
    expect(existsSync(join(root, "dist/vue/stale.txt"))).toBe(false);
    expect(existsSync(join(root, "dist/vue/Card.vue"))).toBe(true);
    expect(readFileSync(join(root, "dist/react/kept.txt"), "utf8")).toBe("kept");
    expect(readFileSync(join(root, "dist/kept.txt"), "utf8")).toBe("kept");
  });

  it("honours srcDir, outDir and targets, and skips node_modules and outDir", async () => {
    const root = project({
      "unframework.config.mjs":
        'export default { targets: ["react"], srcDir: ".", outDir: "out" };\n',
      "A.uf.tsx": "export default function A() {\n  return <i />;\n}\n",
      "node_modules/dep/B.uf.tsx": "broken <",
      "out/package/C.uf.tsx": "broken <",
      "Directory.uf.ts/kept.txt": "a directory named like a source is no source",
    });
    expect(await run(root, "build")).toMatchObject({ code: 0 });
    expect(Object.keys(tree(join(root, "out/react")))).toEqual(["A.tsx", "A.tsx.map", "index.ts"]);
    expect(existsSync(join(root, "dist"))).toBe(false);
  });

  it("exits 1 on an error diagnostic, and leaves the last build in place", async () => {
    const root = project(FIXTURE);
    await run(root, "build");
    const before = tree(join(root, "dist"));
    write(root, {
      "src/Bad.uf.tsx":
        'import { useState } from "react";\nexport default function Bad() {\n  return <i />;\n}\n',
    });
    const { code, stderr } = await run(root, "build");
    expect(code).toBe(1);
    expect(stderr).toContain("error[UF1201]");
    expect(stderr).toContain("src/Bad.uf.tsx:1:");
    expect(tree(join(root, "dist"))).toEqual(before);
  });

  it("reports no sources as UF7007, and exits 1", async () => {
    const { code, stderr } = await run(project({}), "build");
    expect(code).toBe(1);
    expect(stderr).toContain("error[UF7007]");
    expect(stderr).toContain("under src");
  });

  it("reports two modules that write one file as UF1104", async () => {
    const root = project({
      "unframework.config.mjs": 'export default { targets: ["react"] };\n',
      "src/One.uf.tsx": "export function Same() {\n  return <i>one</i>;\n}\n",
      "src/Two.uf.tsx": "export function Same() {\n  return <i>two</i>;\n}\n",
    });
    const { code, stderr } = await run(root, "build");
    expect(code).toBe(1);
    expect(stderr).toContain("error[UF1104]");
    expect(stderr).toContain("would both write Same.tsx");
    expect(existsSync(join(root, "dist"))).toBe(false);
  });

  it("reports two modules that differ only in case as UF1104", async () => {
    const root = project({
      "unframework.config.mjs": 'export default { targets: ["react"] };\n',
      "src/One.uf.tsx": "export function Same() {\n  return <i>one</i>;\n}\n",
      "src/Two.uf.tsx": "export function SAME() {\n  return <i>two</i>;\n}\n",
    });
    const { code, stderr } = await run(root, "build");
    expect(code).toBe(1);
    expect(stderr).toContain("would both write SAME.tsx");
  });

  it("reports a component whose file the barrel's import would reach as UF1104", async () => {
    const root = project({
      "unframework.config.mjs": 'export default { targets: ["react"] };\n',
      "src/Index.uf.tsx": "export default function Index() {\n  return <i />;\n}\n",
    });
    const { code, stderr } = await run(root, "build");
    expect(code).toBe(1);
    expect(stderr).toContain("would both write index.ts");
    expect(stderr).toContain("src/Index.uf.tsx");
  });

  it("reports two components of one name in two directories as UF1104, from the barrel", async () => {
    const root = project({
      "unframework.config.mjs": 'export default { targets: ["react"] };\n',
      "src/a/Same.uf.tsx": "export default function Same() {\n  return <i>a</i>;\n}\n",
      "src/b/Same.uf.tsx": "export default function Same() {\n  return <i>b</i>;\n}\n",
    });
    const { code, stderr } = await run(root, "build");
    expect(code).toBe(1);
    expect(stderr).toContain("error[UF1104]");
    expect(stderr).toContain("export Same from both ./a/Same and ./b/Same");
  });

  it("reports a shared module that would overwrite the barrel as UF1104", async () => {
    const root = project({
      "unframework.config.mjs": 'export default { targets: ["react"] };\n',
      "src/Card.uf.tsx": `import { x } from "./index.ts";

export default function Card() {
  return <i>{x}</i>;
}
`,
      "src/index.ts": "export const x = 1;\n",
    });
    const { code, stderr } = await run(root, "build");
    expect(code).toBe(1);
    expect(stderr).toContain("error[UF1104]");
    expect(stderr).toContain("would both write index.ts");
  });

  it("refuses to clean a directory that holds the sources", async () => {
    const root = project({
      "unframework.config.mjs":
        'export default { targets: ["react"], srcDir: "dist/react/src" };\n',
      "dist/react/src/A.uf.tsx": "export default function A() {\n  return <i />;\n}\n",
    });
    const { code, stderr } = await run(root, "build");
    expect(code).toBe(2);
    expect(stderr).toContain("error[UF7002]");
    expect(stderr).toContain('"/outDir"');
    expect(existsSync(join(root, "dist/react/src/A.uf.tsx"))).toBe(true);
  });

  it("refuses an outDir whose target directory holds a source", async () => {
    const root = project({
      "unframework.config.mjs": 'export default { targets: ["react"], outDir: "src" };\n',
      "src/react/A.uf.tsx": "export default function A() {\n  return <i />;\n}\n",
    });
    const { code, stderr } = await run(root, "build");
    expect(code).toBe(2);
    expect(stderr).toContain("holds src/react/A.uf.tsx");
    expect(existsSync(join(root, "src/react/A.uf.tsx"))).toBe(true);
  });

  it("refuses an outDir that would clean the project", async () => {
    const parent = project({
      "react/unframework.config.mjs": 'export default { targets: ["react"], outDir: ".." };\n',
      "react/src/A.uf.tsx": "export default function A() {\n  return <i />;\n}\n",
    });
    const { code, stderr } = await run(join(parent, "react"), "build");
    expect(code).toBe(2);
    expect(stderr).toContain("holds the project");
    expect(existsSync(join(parent, "react/src/A.uf.tsx"))).toBe(true);
  });

  it("refuses a shared module outside srcDir, which would leave the target's directory", async () => {
    const root = project({
      "unframework.config.mjs": 'export default { targets: ["react"] };\n',
      "src/A.uf.tsx": `import { x } from "../lib/x.ts";

export default function A() {
  return <i>{x}</i>;
}
`,
      "lib/x.ts": "export const x = 1;\n",
    });
    const { code, stderr } = await run(root, "build");
    expect(code).toBe(2);
    expect(stderr).toContain("error[UF7002]");
    expect(stderr).toContain('"/srcDir"');
    expect(stderr).toContain("../lib/x.ts");
    expect(existsSync(join(root, "dist"))).toBe(false);
  });

  it("refuses a child outside srcDir, whose output no tree would hold", async () => {
    const root = project({
      "unframework.config.mjs": 'export default { targets: ["react"] };\n',
      "src/A.uf.tsx": `import Child from "../lib/Child.uf.tsx";

export default function A() {
  return <Child />;
}
`,
      "lib/Child.uf.tsx": "export default function Child() {\n  return <i />;\n}\n",
    });
    const { code, stderr } = await run(root, "build");
    expect(code).toBe(2);
    expect(stderr).toContain("../lib/Child.uf.tsx");
  });

  it("exits 2 with a message when outDir can't be written", async () => {
    const root = project({
      ...FIXTURE,
      "unframework.config.mjs": 'export default { targets: ["react"] };\n',
      dist: "a file",
    });
    const { code, stderr } = await run(root, "build");
    expect(code).toBe(2);
    expect(stderr).toContain("unframework build:");
  });

  it("takes tsgo's oracle from --type-oracle, and from the config", async () => {
    const source = {
      "src/A.uf.tsx": `type Base = { label: string };

export default function A(props: { [K in keyof Base]: Base[K] }) {
  return <i>{props.label}</i>;
}
`,
    };
    const config = 'export default { targets: ["react"] };\n';
    const syntactic = project({ ...source, "unframework.config.mjs": config });
    const refused = await run(syntactic, "build");
    expect(refused.code).toBe(1);
    expect(refused.stderr).toContain("error[UF6002]");
    const flag = project({ ...source, "unframework.config.mjs": config });
    expect(await run(flag, "build", "--type-oracle", "tsgo")).toMatchObject({ code: 0 });
    const configured = project({
      ...source,
      "unframework.config.mjs": 'export default { targets: ["react"], typeOracle: "tsgo" };\n',
    });
    expect(await run(configured, "build")).toMatchObject({ code: 0 });
  }, 60_000);
});
