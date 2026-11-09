import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  symlinkSync,
} from "node:fs";
import { dirname, join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { project, run, tree, write } from "../helpers.ts";
import { designSystem, inRepository, SOURCE_TREE } from "./helpers.ts";

const REACT = inRepository("packages/target-react");

/** A shared module with a type a declaration can't name, which TS4023 names by its module. */
const UNNAMEABLE = {
  "src/shared/a.ts": `interface Hidden {
  size: number;
}

export function make(): Hidden {
  return { size: 1 };
}
`,
  "src/shared/format.ts": `import { make } from "./a";

export const formatLabel = (label: string): string => label.trim();
export const made = make();
`,
};

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

  it("leaves out the license field when the project has none", async () => {
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

  it("cleans a module's own name, and leaves what the bundler adds working", async () => {
    const root = designSystem({
      config: { targets: ["react"], package: { resolveFrom: REACT } },
      frameworks: ["react", "@types/react"],
      files: {
        "src/shared/a$b&c.ts": 'export const odd = "odd";\n',
        // A namespace taken as a value brings in the bundler's own helper, under a null byte.
        "src/shared/format.ts": `import * as names from "./a$b&c";

export const formatLabel = (label: string): string => label.trim() + Object.keys(names).join();
`,
      },
    });
    const { code, stderr } = await run(root, "build", "--package");
    expect(stderr).toBe("");
    expect(code).toBe(0);
    expect(existsSync(join(root, "dist", "package", "react", "shared", "a_b_c.js"))).toBe(true);
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

  it("keeps the build's environment out of the JS (P8)", async () => {
    const root = designSystem({
      config: { targets: ["react"], package: { resolveFrom: REACT } },
      frameworks: ["react", "@types/react"],
      files: {
        "src/shared/format.ts": `export const formatLabel = (label: string): string =>
  label.trim() + (process.env.TSDOWN_LEAK ?? "");
`,
      },
    });
    expect((await run(root, "build", "--package")).code).toBe(0);
    const unset = tree(join(root, "dist", "package"));
    vi.stubEnv("TSDOWN_LEAK", "leak-value");
    expect((await run(root, "build", "--package")).code).toBe(0);
    vi.unstubAllEnvs();
    expect(tree(join(root, "dist", "package"))).toEqual(unset);
  });

  it("gives the package a directory's usual mode", async () => {
    const root = designSystem({ config: { targets: ["astro"] } });
    expect((await run(root, "build", "--package")).code).toBe(0);
    expect(statSync(join(root, "dist", "package")).mode).toBe(
      statSync(join(root, "dist", "astro")).mode,
    );
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

  it("names babel-preset-solid, which Solid needs beside tsdown", async () => {
    const root = designSystem({
      config: { targets: ["solid"], package: { resolveFrom: REACT } },
      frameworks: ["solid-js"],
    });
    const { code, stderr } = await run(root, "build", "--package");
    expect(code).toBe(1);
    expect(stderr).toContain("UF7008");
    expect(stderr).toContain("babel-preset-solid");
    expect(stderr).not.toContain("@babel/core");
  });

  it("names @babel/core, which Solid also needs", async () => {
    const root = designSystem({ config: { targets: ["solid"] }, frameworks: ["solid-js"] });
    const installed = inRepository("packages/target-solid/node_modules");
    for (const name of ["tsdown", "babel-preset-solid"]) {
      const link = join(root, "node_modules", name);
      mkdirSync(dirname(link), { recursive: true });
      symlinkSync(join(installed, name), link);
    }
    const { code, stderr } = await run(root, "build", "--package");
    expect(code).toBe(1);
    expect(stderr).toContain("UF7008");
    expect(stderr).toContain("@babel/core");
    expect(existsSync(join(root, "dist"))).toBe(false);
  });

  it("names solid-js when the project has no Solid", async () => {
    const root = designSystem({
      config: {
        targets: ["solid"],
        package: { resolveFrom: inRepository("packages/target-solid") },
      },
    });
    const { code, stderr } = await run(root, "build", "--package");
    expect(code).toBe(1);
    expect(stderr).toContain("UF7008");
    expect(stderr).toContain("solid-js");
    expect(existsSync(join(root, "dist"))).toBe(false);
  });

  it.each(["dist", "dist/nested"])(
    "reads the types from where a link leads, for %s",
    async (outDir) => {
      const root = designSystem({
        config: { targets: ["react"], outDir, package: { resolveFrom: REACT } },
        frameworks: ["react", "@types/react"],
      });
      symlinkSync(project({}), join(root, "dist"));
      const { code, stderr } = await run(root, "build", "--package");
      expect(code).toBe(1);
      expect(stderr).toContain("UF7008");
      expect(stderr).toContain("@types/react");
      // Named from the project, as no machine's own path belongs in a report.
      expect(stderr).toContain("doesn't resolve from ../");
      expect(existsSync(join(root, outDir, "package"))).toBe(false);
    },
  );

  it("reads the types from outDir, not the project's root", async () => {
    const root = designSystem({
      config: { targets: ["react"], outDir: "../built", package: { resolveFrom: REACT } },
      frameworks: ["react", "@types/react"],
    });
    const { code, stderr } = await run(root, "build", "--package");
    expect(code).toBe(1);
    expect(stderr).toContain("@types/react");
  });

  it("follows a link inside the project, and finds the types", async () => {
    const root = designSystem({
      config: { targets: ["react"], package: { resolveFrom: REACT } },
      frameworks: ["react", "@types/react"],
    });
    mkdirSync(join(root, "out"));
    symlinkSync(join(root, "out"), join(root, "dist"));
    const { code, stderr } = await run(root, "build", "--package");
    expect(stderr).toBe("");
    expect(code).toBe(0);
    expect(readFileSync(join(root, "out", "package", "react", "Card.d.ts"), "utf8")).toContain(
      "JSX.Element",
    );
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

  it("fires when the project has no Vue, before anything is written", async () => {
    const root = designSystem({
      config: { targets: ["vue"], package: { resolveFrom: inRepository("tests/toolchains/vue") } },
    });
    const { code, stderr } = await run(root, "build", "--package");
    expect(code).toBe(1);
    expect(stderr).toContain("UF7008");
    expect(stderr).toContain("(vue)");
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

  it("leaves another TypeScript's errors to tsdown", async () => {
    const root = designSystem({
      config: { targets: ["react"] },
      frameworks: ["@types/react"],
      files: {
        "node_modules/typescript/package.json":
          '{ "name": "typescript", "version": "6.0.2", "bin": { "tsc": "missing.js" } }',
        "node_modules/tsdown/package.json": '{ "name": "tsdown", "main": "index.mjs" }',
        "node_modules/tsdown/index.mjs": `export async function build(config) {
  if (config.dts) throw new Error("the generator failed in a module");
}
`,
      },
    });
    const { code, stderr } = await run(root, "build", "--package");
    expect(code).toBe(1);
    expect(stderr).toContain("the generator failed in a module");
  });

  it.each([
    ["react", REACT, ["react", "@types/react"]],
    ["vue", inRepository("tests/toolchains/vue"), ["vue"]],
  ] as const)(
    "names another module in the %s tree, not the scratch one",
    async (target, from, frameworks) => {
      const root = designSystem({
        config: { targets: [target], package: { resolveFrom: from } },
        frameworks,
        files: UNNAMEABLE,
      });
      const { code, stderr } = await run(root, "build", "--package");
      expect(code).toBe(1);
      expect(stderr).toContain("UF7009");
      expect(stderr).toContain(`from external module "dist/${target}/shared/a"`);
      expect(stderr).not.toContain(".package-");
      expect(stderr).not.toContain(realpathSync(root));
    },
  );

  it("maps a path once, for a tree that starts like the scratch copy", async () => {
    const root = designSystem({
      config: { targets: ["react"], outDir: "in", package: { resolveFrom: REACT } },
      frameworks: ["react", "@types/react"],
      files: UNNAMEABLE,
    });
    const { code, stderr } = await run(root, "build", "--package");
    expect(code).toBe(1);
    expect(stderr).toContain("in/react/shared/format.ts(");
    expect(stderr).toContain('from external module "in/react/shared/a"');
  });

  it.each(["check in", "C++"])(
    "maps the scratch path under a directory named %s",
    async (under) => {
      const root = designSystem({
        config: { targets: ["react"], package: { resolveFrom: REACT } },
        frameworks: ["react", "@types/react"],
        files: UNNAMEABLE,
        under,
      });
      const { code, stderr } = await run(root, "build", "--package");
      expect(code).toBe(1);
      expect(stderr).toContain('from external module "dist/react/shared/a"');
      expect(stderr).toContain("dist/react/shared/format.ts(");
      expect(stderr).not.toContain(".package-");
      expect(stderr).not.toContain(realpathSync(root));
      expect(stderr).not.toContain("check dist");
    },
  );

  it("leaves a directory alone that only ends like the scratch copy", async () => {
    const root = designSystem({
      config: { targets: ["react"], package: { resolveFrom: REACT } },
      frameworks: ["react", "@types/react"],
      files: {
        "src/shared/plugin/a.ts": UNNAMEABLE["src/shared/a.ts"],
        "src/shared/plugin/b.ts": 'import { make } from "./a";\n\nexport const made = make();\n',
        "src/shared/format.ts": `export { made } from "./plugin/b";

export const formatLabel = (label: string): string => label.trim();
`,
      },
    });
    const { code, stderr } = await run(root, "build", "--package");
    expect(code).toBe(1);
    expect(stderr).toContain("dist/react/shared/plugin/b.ts(");
    expect(stderr).toContain('from external module "dist/react/shared/plugin/a"');
  });

  it("writes a tree's path as it is, whatever it holds", async () => {
    const root = designSystem({
      config: { targets: ["react"], outDir: "$&", package: { resolveFrom: REACT } },
      frameworks: ["react", "@types/react"],
      files: UNNAMEABLE,
    });
    const { code, stderr } = await run(root, "build", "--package");
    expect(code).toBe(1);
    expect(stderr).toContain('from external module "$&/react/shared/a"');
  });

  it("carries what tsgo reports, on standard error and past no io", async () => {
    const root = designSystem({
      config: { targets: ["react"], package: { resolveFrom: REACT } },
      frameworks: ["react", "@types/react"],
      files: {
        "src/shared/format.ts": `export const formatLabel = (label: string): string => label.trim();
export const Klass = class {
  private y = 1;
};
`,
      },
    });
    const { status, stdout, stderr } = spawnSync(
      process.execPath,
      [inRepository("packages/unframework/bin/unframework.js"), "build", "--package"],
      { cwd: root, encoding: "utf8" },
    );
    expect(status).toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toContain("UF7009");
    expect(stderr).toContain("dist/react/shared/format.ts(2,14): error TS4094");
    expect(stderr).not.toContain(".package-");
  });
});
