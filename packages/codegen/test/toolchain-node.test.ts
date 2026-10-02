import { spawnSync } from "node:child_process";
import {
  existsSync,
  globSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import {
  assertFilesToCheck,
  assertFilesToCompile,
  checkerFailed,
  diagnosticsByFile,
  resolveInstalled,
  resolveToolBin,
  runChecker,
} from "../src/toolchain-node/index.ts";
import type { CheckerRun } from "../src/toolchain-node/index.ts";

const temporaries: string[] = [];
afterAll(() => {
  for (const directory of temporaries.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
afterEach(() => vi.unstubAllEnvs());

/** A fresh directory under the OS's temporary directory, which macOS reaches through a symlink. */
function temporaryDir(): string {
  const directory = mkdtempSync(join(tmpdir(), "uf-toolchain-node-"));
  temporaries.push(directory);
  return directory;
}

/** Writes `files` (by relative path) under `root`, and returns `root`. */
function writeTree(root: string, files: Record<string, string>): string {
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), contents);
  }
  return root;
}

const manifest = (fields: object) => JSON.stringify(fields);

describe("resolveInstalled", () => {
  it("resolves packages and subpaths from the nearest node_modules upwards", () => {
    const root = writeTree(temporaryDir(), {
      "node_modules/tool/package.json": manifest({ name: "tool", main: "main.js" }),
      "node_modules/tool/main.js": "",
      "node_modules/@scope/kit/package.json": manifest({
        name: "@scope/kit",
        exports: { ".": "./index.js", "./sub": "./sub.js" },
      }),
      "node_modules/@scope/kit/index.js": "",
      "node_modules/@scope/kit/sub.js": "",
      "a/node_modules/near/package.json": manifest({ name: "near", main: "index.js" }),
      "a/node_modules/near/index.js": "",
      "a/b/.keep": "",
    });
    const nested = join(root, "a/b");
    // Node's resolution returns real paths.
    const real = realpathSync(root);
    expect(resolveInstalled(nested, "tool")).toBe(join(real, "node_modules/tool/main.js"));
    expect(resolveInstalled(nested, "@scope/kit/sub")).toBe(
      join(real, "node_modules/@scope/kit/sub.js"),
    );
    expect(resolveInstalled(nested, "near")).toBe(join(real, "a/node_modules/near/index.js"));
    expect(resolveInstalled(root, "near")).toBeUndefined();
    expect(resolveInstalled(nested, "absent")).toBeUndefined();
  });
});

describe("resolveToolBin", () => {
  const root = writeTree(temporaryDir(), {
    "node_modules/single/package.json": manifest({ name: "single", bin: "cli.js" }),
    "node_modules/multi/package.json": manifest({
      name: "multi",
      bin: { "multi-check": "bin/check.js", other: "bin/other.js" },
    }),
    "toolchain/package.json": manifest({ name: "toolchain", private: true }),
  });
  const toolchain = join(root, "toolchain");

  it("finds a package's bin script from the toolchain directory upwards", () => {
    expect(resolveToolBin(toolchain, "single", "single")).toBe(
      join(root, "node_modules/single/cli.js"),
    );
    expect(resolveToolBin(toolchain, "multi", "multi-check")).toBe(
      join(root, "node_modules/multi/bin/check.js"),
    );
  });

  it("rejects a package the toolchain directory does not install, or a bin it lacks", () => {
    expect(() => resolveToolBin(toolchain, "absent", "absent")).toThrow(
      `absent is not installed in ${toolchain}: the toolchain directory must provide it`,
    );
    expect(() => resolveToolBin(toolchain, "multi", "missing")).toThrow(
      `multi at ${join(root, "node_modules/multi")} has no "missing" bin.`,
    );
  });
});

describe("NODE_PATH", () => {
  it("is never searched, although Node's own resolution would find a package there", () => {
    const store = writeTree(temporaryDir(), {
      "node_modules/hoisted/package.json": manifest({
        name: "hoisted",
        main: "index.js",
        bin: "index.js",
      }),
      "node_modules/hoisted/index.js": "",
    });
    const toolchain = writeTree(temporaryDir(), { "package.json": "{}\n" });
    // NODE_PATH is read once, when Node starts, so the check runs in a process of its own.
    const resolveModule = new URL("../src/toolchain-node/resolve.ts", import.meta.url).href;
    const script = `
      import { createRequire } from "node:module";
      import { resolveInstalled, resolveToolBin } from ${JSON.stringify(resolveModule)};
      const toolchain = ${JSON.stringify(toolchain)};
      let bin;
      try { bin = resolveToolBin(toolchain, "hoisted", "hoisted"); } catch (error) { bin = error.message; }
      console.log(JSON.stringify({
        node: createRequire(toolchain + "/package.json").resolve("hoisted"),
        installed: resolveInstalled(toolchain, "hoisted") ?? null,
        bin,
      }));
    `;
    const child = spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
      env: { ...process.env, NODE_PATH: join(store, "node_modules") },
      encoding: "utf8",
    });
    expect(child.status, child.stderr).toBe(0);
    expect(JSON.parse(child.stdout)).toEqual({
      node: join(realpathSync(store), "node_modules/hoisted/index.js"),
      installed: null,
      bin: expect.stringContaining(`hoisted is not installed in ${toolchain}`),
    });
  });
});

/** Output files to check: they must exist, wherever they are. */
const outputDir = writeTree(temporaryDir(), { "A.vue": "", "B.vue": "" });
const outputs = { a: join(outputDir, "A.vue"), b: join(outputDir, "B.vue") };

/** A toolchain directory with a fake checker that prints what it was run with. */
function toolchainWithChecker(options: { tsconfig?: boolean } = {}): {
  directory: string;
  bin: string;
} {
  const directory = writeTree(temporaryDir(), {
    ...((options.tsconfig ?? true) ? { "tsconfig.json": "{}\n" } : {}),
    "checker.cjs": [
      'const { readFileSync } = require("node:fs");',
      "const tsconfig = process.argv.at(-1);",
      "process.stdout.write(JSON.stringify({",
      "  cwd: process.cwd(),",
      "  args: process.argv.slice(2),",
      '  config: JSON.parse(readFileSync(tsconfig, "utf8")),',
      "  env: {",
      "    NODE_OPTIONS: process.env.NODE_OPTIONS ?? null,",
      "    NODE_PATH: process.env.NODE_PATH ?? null,",
      "    NO_COLOR: process.env.NO_COLOR,",
      "    FORCE_COLOR: process.env.FORCE_COLOR,",
      "  },",
      "}));",
      'process.stderr.write("a note");',
      "process.exitCode = 3;",
      "",
    ].join("\n"),
  });
  return { directory, bin: join(directory, "checker.cjs") };
}

describe("runChecker", () => {
  it("runs the checker in the toolchain directory over a tsconfig that extends its own", async () => {
    // The test runner's settings, which must not reach the checker.
    vi.stubEnv("NODE_OPTIONS", "--no-deprecation");
    vi.stubEnv("NODE_PATH", "/hoisted/store/node_modules");
    const { directory, bin } = toolchainWithChecker();
    const files = Object.values(outputs);
    const run = await runChecker(directory, bin, files, (tsconfig) => ["--project", tsconfig]);

    const cwd = realpathSync(directory);
    expect(run.cwd).toBe(cwd);
    expect(relative(cwd, run.tsconfig)).toMatch(/^\.uf-tmp\/typecheck-[^/]+\/tsconfig\.json$/);
    expect({ ...run, stdout: JSON.parse(run.stdout) }).toEqual({
      cwd,
      tsconfig: run.tsconfig,
      code: 3,
      signal: null,
      stderr: "a note",
      stdout: {
        cwd,
        args: ["--project", run.tsconfig],
        config: { extends: join(cwd, "tsconfig.json"), include: [], files },
        env: { NODE_OPTIONS: null, NODE_PATH: null, NO_COLOR: "1", FORCE_COLOR: "0" },
      },
    });
    expect(readdirSync(join(directory, ".uf-tmp"))).toEqual([]);
  });

  it("removes the temporary tsconfig when the run cannot complete", async () => {
    const { directory, bin } = toolchainWithChecker();
    await expect(
      runChecker(directory, bin, [outputs.a], () => {
        throw new Error("no arguments");
      }),
    ).rejects.toThrow("no arguments");
    expect(readdirSync(join(directory, ".uf-tmp"))).toEqual([]);
  });

  it("rejects what it cannot check before starting anything", async () => {
    const { directory, bin } = toolchainWithChecker();
    const args = vi.fn(() => []);
    await expect(runChecker(directory, bin, [], args)).rejects.toThrow(
      "typecheck received no files: a check over nothing proves nothing.",
    );
    await expect(runChecker(directory, bin, ["Hello.vue"], args)).rejects.toThrow(
      /needs absolute paths, got: Hello\.vue/,
    );
    await expect(runChecker(directory, bin, [outputs.a, "/virtual/B.vue"], args)).rejects.toThrow(
      "typecheck received files that do not exist:\n/virtual/B.vue",
    );
    const bare = toolchainWithChecker({ tsconfig: false });
    await expect(runChecker(bare.directory, bare.bin, [outputs.a], args)).rejects.toThrow(
      `${join(bare.directory, "tsconfig.json")} does not exist`,
    );
    expect(args).not.toHaveBeenCalled();
    expect(existsSync(join(directory, ".uf-tmp"))).toBe(false);
  });
});

describe("the files a gate is given", () => {
  it("are never none: a check over nothing proves nothing", () => {
    expect(() => assertFilesToCompile([])).toThrow(
      "frameworkCompile received no files: a check over nothing proves nothing.",
    );
    expect(() => assertFilesToCompile([{ path: "/virtual/A.vue", contents: "" }])).not.toThrow();
    expect(() => assertFilesToCheck([])).toThrow(
      "typecheck received no files: a check over nothing proves nothing.",
    );
  });

  it("exist, by absolute path, when they are type-checked", () => {
    expect(() => assertFilesToCheck(["A.vue"])).toThrow(
      "typecheck needs absolute paths, got: A.vue",
    );
    expect(() => assertFilesToCheck([outputs.a, "/virtual/Gone.vue"])).toThrow(
      "typecheck received files that do not exist:\n/virtual/Gone.vue",
    );
    expect(() => assertFilesToCheck(Object.values(outputs))).not.toThrow();
  });
});

/** A finished checker run, as `runChecker` returns it. */
const checkerRun = (fields: Partial<CheckerRun>): CheckerRun => ({
  cwd: "/toolchain",
  tsconfig: "/toolchain/.uf-tmp/typecheck-x/tsconfig.json",
  code: 0,
  signal: null,
  stdout: "",
  stderr: "",
  ...fields,
});

describe("checker results", () => {
  const tsconfig = "/toolchain/.uf-tmp/typecheck-x/tsconfig.json";
  const message = (text: string) => ({ message: text, line: 1, column: 1, code: "TS2322" });

  it("have an entry for every requested file, clean or not", () => {
    expect([...diagnosticsByFile(["/a.ts", "/b.ts"], tsconfig).results]).toEqual([
      ["/a.ts", []],
      ["/b.ts", []],
    ]);
  });

  it("key a file the checker saw through a symlink by the path it was given", () => {
    const real = writeTree(temporaryDir(), { "A.ts": "", "Other.ts": "" });
    const link = `${real}-link`;
    temporaries.push(link);
    symlinkSync(real, link, "dir");
    const given = join(link, "A.ts");
    const diagnostics = diagnosticsByFile([given], tsconfig);
    diagnostics.add(join(realpathSync(real), "A.ts"), message("through the link"));
    diagnostics.add(given, message("as given"));
    expect(diagnostics.results.get(given)).toEqual([
      message("through the link"),
      message("as given"),
    ]);
    expect(diagnostics.results.size).toBe(1);
  });

  it("keep every other diagnostic: other files by path, file-less ones by the tsconfig", () => {
    const diagnostics = diagnosticsByFile(["/project/A.ts"], tsconfig);
    diagnostics.add("/project/helper.ts", message("in an imported file"));
    diagnostics.add("/toolchain/tsconfig.json", message("an unknown option"));
    diagnostics.add(undefined, message("a global error"));
    diagnostics.add(undefined, message("another one"));
    expect(Object.fromEntries(diagnostics.results)).toEqual({
      "/project/A.ts": [],
      "/project/helper.ts": [message("in an imported file")],
      "/toolchain/tsconfig.json": [message("an unknown option")],
      [tsconfig]: [message("a global error"), message("another one")],
    });
  });

  it("fail with everything the checker printed", () => {
    expect(
      checkerFailed(
        "vue-tsc",
        checkerRun({ code: 2, stdout: "out\n", stderr: "err\n" }),
        "it failed.",
      ).message,
    ).toBe("vue-tsc exited with code 2: it failed.\nout\nerr");
    expect(
      checkerFailed(
        "svelte-check",
        checkerRun({ code: null, signal: "SIGKILL" }),
        "it did not finish.",
      ).message,
    ).toBe("svelte-check was killed by SIGKILL: it did not finish. (no output)");
  });
});

describe("codegen's main entry", () => {
  it("imports no Node API, and not this subpath", () => {
    const src = fileURLToPath(new URL("../src", import.meta.url));
    const offenders = globSync("**/*.ts", { cwd: src })
      .filter((file) => !file.startsWith("toolchain-node/"))
      .filter((file) =>
        /\bfrom\s+["'](?:node:|\.{1,2}\/toolchain-node)|\bimport\(\s*["']node:/.test(
          readFileSync(join(src, file), "utf8"),
        ),
      );
    expect(offenders).toEqual([]);
  });
});
