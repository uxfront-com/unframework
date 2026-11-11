import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
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
    expect(files["src/Button.uf.tsx"]).toContain('import "./Button.css";');
    expect(files["unframework.config.ts"]).toContain('from "@uxfront/unframework/config"');
    for (const target of ["react", "vue", "svelte", "solid", "angular", "qwik", "astro"]) {
      expect(files["unframework.config.ts"]).toContain(`"${target}"`);
    }
    for (const line of [
      "https://unframework.dev",
      "`unframework check`",
      "`unframework explain <code>`",
      "`unframework build`",
      "`tsc --noEmit -p tsconfig.uf.json`",
    ]) {
      expect(files["AGENTS.md"]).toContain(line);
    }
  });

  it("writes the tsconfig ADR-0080 settles", async () => {
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
        jsxImportSource: "@uxfront/unframework",
      },
      include: ["**/*.uf.tsx", "**/*.uf.ts"],
      exclude: ["dist"],
    });
  });

  it("writes an example that compiles on every target, with only a stylesheet's notes", async () => {
    const root = project({});
    await run(root, "init");
    // The config imports `@uxfront/unframework/config`, which this package can't resolve (the umbrella sits
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
    expect(stderr).toContain(`In the way: ${file}.`);
    expect(stderr).toContain(`--force overwrites ${file}.`);
    expect(tree(root)).toEqual({ [file]: "mine\n" });
    // `tree` lists files, so a directory left behind takes its own look.
    expect(readdirSync(root)).toEqual([file.split("/")[0]]);
  });

  it("names every file it refuses to overwrite", async () => {
    const root = project({ "AGENTS.md": "mine\n", "tsconfig.uf.json": "{}\n" });
    const { stderr } = await run(root, "init");
    expect(stderr).toContain("In the way: AGENTS.md, tsconfig.uf.json.");
  });

  it("names a directory in a file's place with the rest", async () => {
    const root = project({ "AGENTS.md": "mine\n" });
    mkdirSync(join(root, "tsconfig.uf.json"));
    const { stderr } = await run(root, "init");
    expect(stderr).toContain("In the way: AGENTS.md, tsconfig.uf.json.");
    expect(stderr).toContain("--force overwrites AGENTS.md.");
    expect(stderr).toContain(
      "--force can't replace a directory, so remove tsconfig.uf.json first.",
    );
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
      expect(stderr).toContain(`In the way: ${config}.`);
      expect(stderr).toContain(
        `--force keeps ${config}, but unframework.config.ts takes precedence.`,
      );
      expect(stderr).not.toContain("--force overwrites");
      expect(tree(root)).toEqual({ [config]: "export default {};\n" });
      expect(readdirSync(root)).toEqual([config]);
    },
  );

  it("lists every config it keeps", async () => {
    const root = project({
      "unframework.config.js": "export default {};\n",
      "unframework.config.mjs": "export default {};\n",
    });
    const kept = "unframework.config.js, unframework.config.mjs, but unframework.config.ts";
    expect((await run(root, "init")).stderr).toContain(`--force keeps ${kept}`);
    expect((await run(root, "init", "--force")).stderr).toContain(`Kept ${kept}`);
  });

  it("overwrites with --force, and leaves other files alone", async () => {
    const root = project({
      "AGENTS.md": "mine\n",
      "src/Button.uf.tsx": "mine\n",
      "src/Other.uf.tsx": "mine\n",
      "unframework.config.mjs": "export default {};\n",
    });
    const { code, stderr } = await run(root, "init", "--force");
    expect(code).toBe(0);
    expect(stderr).toBe(
      "Kept unframework.config.mjs, but unframework.config.ts takes precedence.\n",
    );
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

  it("says nothing on standard error with --force and no other config", async () => {
    const root = project({ "AGENTS.md": "mine\n" });
    expect((await run(root, "init", "--force")).stderr).toBe("");
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
    expect(stderr).toContain("--force can't replace a directory");
    expect(tree(root)).toEqual({});
    expect(readdirSync(root)).toEqual(["tsconfig.uf.json"]);
  });

  it.each([[[]], [["--force"]]])("exits 2 when src is a file, %j", async (flags) => {
    const root = project({});
    writeFileSync(join(root, "src"), "mine\n");
    const { code } = await run(root, "init", ...flags);
    expect(code).toBe(2);
    expect(tree(root)).toEqual({ src: "mine\n" });
    expect(readdirSync(root)).toEqual(["src"]);
  });

  it("exits 2 on anything but --force", async () => {
    const root = project({});
    expect((await run(root, "init", "here")).code).toBe(2);
    expect((await run(root, "init", "--nope")).code).toBe(2);
    expect(readdirSync(root)).toEqual([]);
  });

  it("appears in the usage", async () => {
    const { stdout } = await run(".", "--help");
    expect(stdout).toContain("init [--force]");
  });
});
