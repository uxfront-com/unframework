import { existsSync, readdirSync, readFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { project, run, tree, write } from "../helpers.ts";
import { designSystem, inRepository, SOURCE_TREE } from "./helpers.ts";

const REACT = inRepository("packages/target-react");

const manifestOf = (root: string) =>
  JSON.parse(readFileSync(join(root, "dist", "package", "package.json"), "utf8"));

describe("build --package: the manifest", () => {
  it("takes the name, version and license from the project, and nothing else", async () => {
    const root = designSystem({
      config: { targets: ["astro"] },
      manifest: JSON.stringify({
        name: "@acme/ds",
        version: "4.5.6",
        license: "Apache-2.0",
        private: true,
        scripts: { build: "unframework build" },
        dependencies: { lodash: "*" },
      }),
    });
    expect((await run(root, "build", "--package")).code).toBe(0);
    expect(manifestOf(root)).toEqual({
      name: "@acme/ds",
      version: "4.5.6",
      license: "Apache-2.0",
      type: "module",
      exports: {
        "./astro": "./astro/index.ts",
        "./source/*": "./source/*",
        "./package.json": "./package.json",
      },
      peerDependencies: { astro: "^7.0.0" },
      peerDependenciesMeta: { astro: { optional: true } },
    });
  });

  it("leaves out a license the project doesn't have", async () => {
    const root = designSystem({
      config: { targets: ["astro"] },
      manifest: JSON.stringify({ name: "ds", version: "1.0.0" }),
    });
    expect((await run(root, "build", "--package")).code).toBe(0);
    expect(manifestOf(root)).not.toHaveProperty("license");
  });

  it("lists targets in one order, whatever order the config gives", async () => {
    const root = designSystem({
      config: {
        targets: ["vue", "astro", "react", "solid"],
        package: {
          targets: ["vue", "solid", "react", "astro"],
          resolveFrom: {
            react: REACT,
            solid: inRepository("packages/target-solid"),
            vue: inRepository("tests/toolchains/vue"),
          },
        },
      },
      frameworks: ["react", "@types/react", "solid-js", "vue"],
    });
    const { code, stderr } = await run(root, "build", "--package");
    expect(stderr).toBe("");
    expect(code).toBe(0);
    const { exports, peerDependencies, peerDependenciesMeta } = manifestOf(root);
    expect(Object.keys(exports)).toEqual([
      "./astro",
      "./react",
      "./solid",
      "./vue",
      "./source/*",
      "./package.json",
    ]);
    expect(peerDependencies).toEqual({
      astro: "^7.0.0",
      react: "^19.2.0",
      "solid-js": "^1.9.0",
      vue: "^3.5.0",
    });
    expect(Object.values(peerDependenciesMeta)).toEqual(Array(4).fill({ optional: true }));
  });

  it("packages only package.targets, and still builds every target's tree", async () => {
    const root = designSystem({
      config: { targets: ["astro", "svelte"], package: { targets: ["astro"] } },
    });
    expect((await run(root, "build", "--package")).code).toBe(0);
    expect(existsSync(join(root, "dist", "svelte", "Card.svelte"))).toBe(true);
    expect(readdirSync(join(root, "dist", "package")).toSorted()).toEqual([
      "astro",
      "package.json",
      "source",
    ]);
    expect(manifestOf(root).peerDependencies).toEqual({ astro: "^7.0.0" });
  });

  it("ships what the sources read, under source/", async () => {
    const root = designSystem({ config: { targets: ["astro"] } });
    expect((await run(root, "build", "--package")).code).toBe(0);
    const files = tree(join(root, "dist", "package"));
    expect(Object.keys(files).filter((file) => file.startsWith("source/"))).toEqual(SOURCE_TREE);
    expect(files["source/shared/format.ts"]).toBe(
      readFileSync(join(root, "src", "shared", "format.ts"), "utf8"),
    );
  });

  it("leaves a package a source reads types from to its own install", async () => {
    const root = designSystem({
      config: { targets: ["astro"] },
      files: {
        "node_modules/tones/package.json": '{ "name": "tones", "types": "index.d.ts" }',
        "node_modules/tones/index.d.ts": 'export type Tone = "calm" | "loud";\n',
        "src/Toned.uf.tsx": `import type { Tone } from "tones";

export default function Toned(props: { tone?: Tone }) {
  return <p>{props.tone}</p>;
}
`,
      },
    });
    const { code, stderr } = await run(root, "build", "--package");
    expect(stderr).toBe("");
    expect(code).toBe(0);
    expect(existsSync(join(root, "dist", "package", "source", "Toned.uf.tsx"))).toBe(true);
    expect(Object.keys(tree(join(root, "dist", "package", "source"))).join()).not.toContain("pkg:");
  });

  it("gives equal packages for equal inputs, and leaves no scratch directory", async () => {
    const root = designSystem({
      config: { targets: ["react"], package: { resolveFrom: REACT } },
      frameworks: ["react", "@types/react"],
    });
    expect((await run(root, "build", "--package")).code).toBe(0);
    const first = tree(join(root, "dist", "package"));
    expect((await run(root, "build", "--package")).code).toBe(0);
    expect(tree(join(root, "dist", "package"))).toEqual(first);
    expect(readdirSync(join(root, "dist")).toSorted()).toEqual(["package", "react"]);
  });

  it("replaces an earlier package, so a target left out goes", async () => {
    const root = designSystem({
      config: { targets: ["astro"] },
      files: { "dist/package/stale.txt": "left over\n" },
    });
    expect((await run(root, "build", "--package")).code).toBe(0);
    expect(existsSync(join(root, "dist", "package", "stale.txt"))).toBe(false);
  });

  it("writes no package without the flag", async () => {
    const root = designSystem({ config: { targets: ["astro"] } });
    expect((await run(root, "build")).code).toBe(0);
    expect(existsSync(join(root, "dist", "package"))).toBe(false);
  });

  it.each([
    ["no package.json", null, "package.json"],
    ["a package.json that doesn't parse", "{", "package.json"],
    ["no name", JSON.stringify({ version: "1.0.0" }), '"name"'],
    ["no version", JSON.stringify({ name: "ds" }), '"version"'],
    ["an empty name", JSON.stringify({ name: "", version: "1.0.0" }), '"name"'],
  ])("exits 2 and writes nothing with %s", async (_, manifest, named) => {
    const root = designSystem({ config: { targets: ["astro"] }, manifest });
    const { code, stderr } = await run(root, "build", "--package");
    expect(code).toBe(2);
    expect(stderr).toContain(named);
    expect(existsSync(join(root, "dist"))).toBe(false);
  });

  it("refuses a source that reads a file ./source/* couldn't hold", async () => {
    const root = designSystem({
      config: { targets: ["astro"] },
      files: {
        "theme.css": ".theme {\n  color: red;\n}\n",
        "src/Themed.uf.tsx": `import "../theme.css";

export default function Themed() {
  return <p class="theme">Hi</p>;
}
`,
      },
    });
    const { code, stderr } = await run(root, "build", "--package");
    expect(code).toBe(2);
    expect(stderr).toContain("theme.css");
    expect(existsSync(join(root, "dist"))).toBe(false);
  });

  it("packages a project reached through a symbolic link", async () => {
    const root = designSystem({
      config: { targets: ["react"], package: { resolveFrom: REACT } },
      frameworks: ["react", "@types/react"],
    });
    const link = join(project({}), "linked");
    symlinkSync(root, link);
    const { code, stderr } = await run(link, "build", "--package");
    expect(stderr).toBe("");
    expect(code).toBe(0);
    expect(existsSync(join(root, "dist", "package", "react", "Card.d.ts"))).toBe(true);
  });

  it("refuses to clean a package directory that holds a file a source reads", async () => {
    const root = designSystem({
      config: { targets: ["astro"] },
      files: {
        "dist/package/held.css": ".held {\n  color: red;\n}\n",
        "src/Held.uf.tsx": `import "../dist/package/held.css";

export default function Held() {
  return <p class="held">Hi</p>;
}
`,
      },
    });
    const { code, stderr } = await run(root, "build", "--package");
    expect(code).toBe(2);
    expect(stderr).toContain("UF7002");
    expect(stderr).toContain("held.css");
    expect(existsSync(join(root, "dist", "package", "held.css"))).toBe(true);
  });

  it("refuses to clean a package directory that holds a source", async () => {
    const root = designSystem({
      config: { targets: ["astro"], srcDir: "dist/package" },
      files: { "dist/package/Solo.uf.tsx": "export function Solo() {\n  return <p>Hi</p>;\n}\n" },
    });
    const { code, stderr } = await run(root, "build", "--package");
    expect(code).toBe(2);
    expect(stderr).toContain("UF7002");
    expect(stderr).toContain("/outDir");
    expect(existsSync(join(root, "dist", "package", "Solo.uf.tsx"))).toBe(true);
  });
});

describe("build --package: UF7008", () => {
  it("fires for a packager that isn't installed, before anything is written", async () => {
    const root = designSystem({
      config: { targets: ["react"], package: { resolveFrom: "." } },
    });
    const { code, stderr } = await run(root, "build", "--package");
    expect(code).toBe(1);
    expect(stderr).toContain("UF7008");
    expect(stderr).toContain("(react)");
    expect(stderr).toContain("tsdown");
    expect(existsSync(join(root, "dist"))).toBe(false);
  });

  it("names each module Solid needs beside tsdown", async () => {
    const root = designSystem({
      config: { targets: ["solid"], package: { resolveFrom: REACT } },
      frameworks: ["solid-js"],
    });
    const { code, stderr } = await run(root, "build", "--package");
    expect(code).toBe(1);
    expect(stderr).toContain("UF7008");
    expect(stderr).toContain("babel-preset-solid");
  });

  it("reads a per-target resolveFrom, with the project's root for the rest", async () => {
    const root = designSystem({
      config: {
        targets: ["react", "vue"],
        package: { resolveFrom: { react: REACT } },
      },
      frameworks: ["react", "@types/react", "vue"],
    });
    const { code, stderr } = await run(root, "build", "--package");
    expect(code).toBe(1);
    expect(stderr).toContain("(vue)");
    expect(stderr).toContain("vue-tsc");
    expect(stderr).not.toContain("(react)");
  });

  it("fires when the project has no types for what the declarations infer", async () => {
    const root = designSystem({ config: { targets: ["react"], package: { resolveFrom: REACT } } });
    const { code, stderr } = await run(root, "build", "--package");
    expect(code).toBe(1);
    expect(stderr).toContain("UF7008");
    expect(stderr).toContain("@types/react");
    expect(existsSync(join(root, "dist"))).toBe(false);
  });

  it("fires for a target with no packager yet", async () => {
    const root = designSystem({ config: { targets: ["svelte"] } });
    const { code, stderr } = await run(root, "build", "--package");
    expect(code).toBe(1);
    expect(stderr).toContain("UF7008");
    expect(stderr).toContain("(svelte)");
    expect(stderr).toContain("package.targets");
    expect(existsSync(join(root, "dist"))).toBe(false);
  });
});

describe("build --package: UF7009", () => {
  it("carries tsdown's own error, and keeps the last good package", async () => {
    const config = { targets: ["react"], package: { resolveFrom: REACT } };
    const frameworks = ["react", "@types/react"];
    const root = designSystem({ config, frameworks });
    expect((await run(root, "build", "--package")).code).toBe(0);
    const before = tree(join(root, "dist", "package"));

    // A shared module is copied as written, so only the packager reads this.
    write(root, { "src/shared/format.ts": "export const formatLabel = (;\n" });
    const { code, stderr } = await run(root, "build", "--package");
    expect(code).toBe(1);
    expect(stderr).toContain("UF7009");
    expect(stderr).toContain("(react)");
    // Its own error, naming the tree the build wrote, without a stack or the scratch directory.
    expect(stderr).toContain("dist/react/shared/format.ts");
    expect(stderr).not.toContain(".package-");
    expect(stderr).not.toMatch(/^\s+at /m);
    expect(tree(join(root, "dist", "package"))).toEqual(before);
    expect(readdirSync(join(root, "dist")).toSorted()).toEqual(["package", "react"]);
  });
});
