import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { project, run, tree, write } from "./helpers.ts";

const SCAFFOLD = [
  "AGENTS.md",
  "src/Button.css",
  "src/Button.uf.tsx",
  "tsconfig.uf.json",
  "unframework.config.ts",
];

describe("init", () => {
  it("writes the scaffold, and names each file", async () => {
    const root = project({});
    const { code, stdout, stderr } = await run(root, "init");
    expect(code).toBe(0);
    expect(stderr).toBe("");
    const files = tree(root);
    expect(Object.keys(files)).toEqual(SCAFFOLD);
    for (const file of SCAFFOLD) expect(stdout).toContain(`Wrote ${file}\n`);
    expect(files["AGENTS.md"]).toContain("https://unframework.dev");
    expect(files["src/Button.uf.tsx"]).toContain('import "./Button.css";');
    expect(files["unframework.config.ts"]).toContain('from "unframework/config"');
  });

  it("writes the tsconfig ADR-0073 settles", async () => {
    const root = project({});
    await run(root, "init");
    expect(JSON.parse(readFileSync(join(root, "tsconfig.uf.json"), "utf8"))).toEqual({
      compilerOptions: {
        module: "esnext",
        moduleResolution: "bundler",
        strict: true,
        noEmit: true,
        allowImportingTsExtensions: true,
        jsx: "preserve",
        jsxImportSource: "unframework",
      },
      include: ["**/*.uf.tsx", "**/*.uf.ts"],
      exclude: ["dist"],
    });
  });

  it("writes an example that compiles on every target, with only a stylesheet's notes", async () => {
    const root = project({});
    await run(root, "init");
    // The config imports `unframework/config`, which this package can't resolve (the umbrella sits
    // above it): create-unframework's test runs it. With no config, `check` takes all seven targets.
    rmSync(join(root, "unframework.config.ts"));
    const { code, stdout } = await run(root, "check", "--format", "json");
    expect(code).toBe(0);
    const notes = JSON.parse(stdout) as { code: string; severity: string; target: string }[];
    expect(notes.map(({ code: id, severity, target }) => [id, severity, target])).toEqual([
      ["UF4002", "info", "angular"],
      ["UF4002", "info", "qwik"],
    ]);
  });

  it.each(SCAFFOLD)("refuses to overwrite %s, and writes nothing", async (file) => {
    const root = project({ [file]: "mine\n" });
    const { code, stdout, stderr } = await run(root, "init");
    expect(code).toBe(2);
    expect(stdout).toBe("");
    expect(stderr).toContain(file);
    expect(stderr).toContain("--force");
    expect(tree(root)).toEqual({ [file]: "mine\n" });
  });

  it("names every file it refuses to overwrite", async () => {
    const root = project({ "AGENTS.md": "mine\n", "tsconfig.uf.json": "{}\n" });
    const { stderr } = await run(root, "init");
    expect(stderr).toContain("AGENTS.md, tsconfig.uf.json");
  });

  it("names a directory in a file's place with the rest", async () => {
    const root = project({ "AGENTS.md": "mine\n" });
    mkdirSync(join(root, "tsconfig.uf.json"));
    const { stderr } = await run(root, "init");
    expect(stderr).toContain("AGENTS.md, tsconfig.uf.json");
  });

  it("counts a dangling symlink as a file", async () => {
    const root = project({});
    symlinkSync(join(root, "elsewhere.md"), join(root, "AGENTS.md"));
    expect((await run(root, "init")).code).toBe(2);
    expect(existsSync(join(root, "elsewhere.md"))).toBe(false);
  });

  it.each(["unframework.config.mts", "unframework.config.js", "unframework.config.mjs"])(
    "refuses beside %s, which the .ts file would shadow",
    async (config) => {
      const root = project({ [config]: "export default {};\n" });
      const { code, stderr } = await run(root, "init");
      expect(code).toBe(2);
      expect(stderr).toContain(config);
      expect(tree(root)).toEqual({ [config]: "export default {};\n" });
    },
  );

  it("overwrites with --force, and leaves other files alone", async () => {
    const root = project({
      "AGENTS.md": "mine\n",
      "src/Button.uf.tsx": "mine\n",
      "src/Other.uf.tsx": "mine\n",
      "unframework.config.mjs": "export default {};\n",
    });
    const { code, stderr } = await run(root, "init", "--force");
    expect(code).toBe(0);
    expect(stderr).toBe("");
    const files = tree(root);
    expect(Object.keys(files)).toEqual([
      "AGENTS.md",
      "src/Button.css",
      "src/Button.uf.tsx",
      "src/Other.uf.tsx",
      "tsconfig.uf.json",
      "unframework.config.mjs",
      "unframework.config.ts",
    ]);
    expect(files["AGENTS.md"]).toContain("https://unframework.dev");
    expect(files["src/Button.uf.tsx"]).toContain('import "./Button.css";');
    expect(files["src/Other.uf.tsx"]).toBe("mine\n");
    expect(files["unframework.config.mjs"]).toBe("export default {};\n");
  });

  it("replaces a symlink with --force, and leaves what it points at", async () => {
    const root = project({ "shared.md": "mine\n" });
    symlinkSync(join(root, "shared.md"), join(root, "AGENTS.md"));
    expect((await run(root, "init", "--force")).code).toBe(0);
    expect(readFileSync(join(root, "shared.md"), "utf8")).toBe("mine\n");
    expect(readFileSync(join(root, "AGENTS.md"), "utf8")).toContain("https://unframework.dev");
  });

  it("gives the same files with and without --force", async () => {
    const root = project({});
    await run(root, "init");
    const first = tree(root);
    write(root, { "AGENTS.md": "mine\n" });
    await run(root, "init", "--force");
    expect(tree(root)).toEqual(first);
  });

  it.each([[[]], [["--force"]]])("exits 2 on a directory in a file's place, %j", async (flags) => {
    const root = project({});
    mkdirSync(join(root, "tsconfig.uf.json"));
    const { code, stderr } = await run(root, "init", ...flags);
    expect(code).toBe(2);
    expect(stderr).toContain("tsconfig.uf.json");
    expect(tree(root)).toEqual({});
  });

  it.each([[[]], [["--force"]]])("exits 2 when src is a file, %j", async (flags) => {
    const root = project({});
    writeFileSync(join(root, "src"), "mine\n");
    const { code } = await run(root, "init", ...flags);
    expect(code).toBe(2);
    expect(tree(root)).toEqual({ src: "mine\n" });
  });

  it("exits 2 on anything but --force", async () => {
    const root = project({});
    expect((await run(root, "init", "here")).code).toBe(2);
    expect((await run(root, "init", "--nope")).code).toBe(2);
    expect(tree(root)).toEqual({});
  });

  it("appears in the usage", async () => {
    const { stdout } = await run(".", "--help");
    expect(stdout).toContain("init [--force]");
  });
});
