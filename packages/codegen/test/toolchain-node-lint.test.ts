// The L5 runners (ADR-0042): first against stand-in linters, which print exactly what each
// case needs, so every rule of ADR-0028's bar is proven on its own; then against the
// workspace's real oxlint, so the flags and the report's shape are oxlint's own.
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import type { ToolchainMessage } from "../src/index.ts";
import { lintWithEslint, lintWithOxlint, mergeLintResults } from "../src/toolchain-node/index.ts";

const temporaries: string[] = [];
afterAll(() => {
  for (const directory of temporaries.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
afterEach(() => vi.unstubAllEnvs());

/** A fresh directory under the OS's temporary directory, which macOS reaches through a symlink. */
function temporaryDir(): string {
  const directory = mkdtempSync(join(tmpdir(), "uf-lint-"));
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

/** Output files to lint, in two directories, as the caller spells them (through the symlink). */
const outputs = writeTree(temporaryDir(), { "a/A.tsx": "", "a/b/B.tsx": "", "c/C.tsx": "" });
const files = {
  a: join(outputs, "a/A.tsx"),
  b: join(outputs, "a/b/B.tsx"),
  c: join(outputs, "c/C.tsx"),
};
/** The paths the linters see: real ones. */
const real = {
  a: realpathSync(files.a),
  b: realpathSync(files.b),
  c: realpathSync(files.c),
};

/** How a stand-in linter ends: what it prints, and its exit code or signal. */
interface Behaviour {
  stdout?: unknown;
  stderr?: string;
  code?: number;
  signal?: NodeJS.Signals;
}

/** What a stand-in linter was run with. */
interface Invocation {
  args: string[];
  cwd: string;
  env: { NODE_OPTIONS: string | null; NODE_PATH: string | null; NO_COLOR?: string };
}

/**
 * A toolchain directory with a stand-in oxlint that records how it was run and prints what
 * `behaviour` says (`stdout` as given when it is a string, as JSON otherwise).
 */
function oxlintToolchain(behaviour: Behaviour, config = true): string {
  return writeTree(temporaryDir(), {
    ...(config ? { "output.oxlintrc.json": "{}\n" } : {}),
    "behaviour.json": JSON.stringify(behaviour),
    "node_modules/oxlint/package.json": JSON.stringify({
      name: "oxlint",
      bin: { oxlint: "bin/oxlint" },
    }),
    "node_modules/oxlint/bin/oxlint": [
      'const { readFileSync, writeFileSync } = require("node:fs");',
      'const { join } = require("node:path");',
      'const root = join(__dirname, "../../..");',
      'writeFileSync(join(root, "invocation.json"), JSON.stringify({',
      "  args: process.argv.slice(2),",
      "  cwd: process.cwd(),",
      "  env: {",
      "    NODE_OPTIONS: process.env.NODE_OPTIONS ?? null,",
      "    NODE_PATH: process.env.NODE_PATH ?? null,",
      "    NO_COLOR: process.env.NO_COLOR,",
      "  },",
      "}));",
      'const behaviour = JSON.parse(readFileSync(join(root, "behaviour.json"), "utf8"));',
      "if (behaviour.signal) process.kill(process.pid, behaviour.signal);",
      "const out = behaviour.stdout;",
      'process.stdout.write(typeof out === "string" ? out : JSON.stringify(out ?? ""));',
      'process.stderr.write(behaviour.stderr ?? "");',
      "process.exitCode = behaviour.code ?? 0;",
      "",
    ].join("\n"),
  });
}

const invocation = (toolchainDir: string) =>
  JSON.parse(readFileSync(join(toolchainDir, "invocation.json"), "utf8")) as Invocation;

/** An oxlint JSON report over the given files. */
const report = (diagnostics: object[], count = 3) => ({
  diagnostics,
  number_of_files: count,
  number_of_rules: 100,
  threads_count: 1,
  start_time: 0.01,
});

/** One oxlint diagnostic. */
const problem = (
  filename: string,
  fields: { code?: string; message: string; help?: string; line?: number; column?: number },
) => ({
  message: fields.message,
  ...(fields.code ? { code: fields.code } : {}),
  severity: "error",
  ...(fields.help ? { help: fields.help } : {}),
  filename,
  labels:
    fields.line === undefined
      ? []
      : [{ span: { offset: 0, length: 1, line: fields.line, column: fields.column ?? 1 } }],
});

const lintOx = (toolchainDir: string, given: readonly string[] = Object.values(files)) =>
  lintWithOxlint(given, { toolchainDir, root: toolchainDir });

describe("lintWithOxlint", () => {
  it("runs oxlint from the toolchain directory with its configuration alone", async () => {
    // The test runner's settings, which must not reach the linter.
    vi.stubEnv("NODE_OPTIONS", "--no-deprecation");
    vi.stubEnv("NODE_PATH", "/hoisted/store/node_modules");
    const toolchainDir = oxlintToolchain({ stdout: report([]) });
    const results = await lintOx(toolchainDir);
    expect(Object.fromEntries(results)).toEqual({ [files.a]: [], [files.b]: [], [files.c]: [] });
    expect(invocation(toolchainDir)).toEqual({
      cwd: realpathSync(toolchainDir),
      args: [
        `--config=${join(toolchainDir, "output.oxlintrc.json")}`,
        "--disable-nested-config",
        "--format=json",
        "--deny-warnings",
        "--report-unused-disable-directives-severity=error",
        real.a,
        real.b,
        real.c,
      ],
      env: { NODE_OPTIONS: null, NODE_PATH: null, NO_COLOR: "1" },
    });
  });

  it("reports each problem against the file as the caller spells it, in a stable order", async () => {
    const elsewhere = join(outputs, "helper.ts");
    const toolchainDir = oxlintToolchain({
      code: 1,
      stdout: report([
        problem(real.b, { code: "react(jsx-key)", message: "Missing key.", line: 4, column: 9 }),
        problem(real.a, {
          code: "eslint(no-debugger)",
          message: "`debugger` statement is not allowed",
          help: "Remove the debugger statement",
          line: 2,
          column: 3,
        }),
        problem(real.b, { code: "solid(prefer-for)", message: "Use <For>.", line: 1, column: 1 }),
        problem(real.b, { message: "Unexpected token.", line: 4, column: 2 }),
        problem(real.a, { message: "Unused oxlint-disable directive.", line: 1, column: 1 }),
        problem(elsewhere, { code: "typescript(no-misused-new)", message: "No.", line: 1 }),
      ]),
    });
    expect(Object.fromEntries(await lintOx(toolchainDir))).toEqual({
      [files.a]: [
        { message: "Unused oxlint-disable directive.", line: 1, column: 1 },
        {
          message: "`debugger` statement is not allowed. Remove the debugger statement",
          line: 2,
          column: 3,
          code: "no-debugger",
        },
      ],
      [files.b]: [
        { message: "Use <For>.", line: 1, column: 1, code: "solid/prefer-for" },
        { message: "Unexpected token.", line: 4, column: 2 },
        { message: "Missing key.", line: 4, column: 9, code: "react/jsx-key" },
      ],
      [files.c]: [],
      [elsewhere]: [{ message: "No.", line: 1, column: 1, code: "typescript/no-misused-new" }],
    });
  });

  it("rejects a run that did not end with its report", async () => {
    const cases: [Behaviour, RegExp][] = [
      [
        { code: 1, stdout: "Failed to parse oxlint configuration file.\n" },
        /oxlint exited with code 1: it printed output this toolchain cannot read\.\nFailed to parse oxlint configuration file\./,
      ],
      [
        { code: 1, stdout: `No files found to lint.\n${JSON.stringify(report([], 0))}` },
        /it printed output this toolchain cannot read/,
      ],
      [{ stdout: { diagnostics: "none" } }, /its report does not have the shape/],
      [{ stdout: report([]), stderr: "thread 'main' panicked" }, /it wrote to stderr\.\n/],
      [{ signal: "SIGKILL" }, /oxlint was killed by SIGKILL: it did not finish\./],
    ];
    for (const [behaviour, error] of cases) {
      await expect(lintOx(oxlintToolchain(behaviour))).rejects.toThrow(error);
    }
  });

  it("rejects a run that skipped a file, or whose JS plugin failed", async () => {
    await expect(lintOx(oxlintToolchain({ stdout: report([], 2) }))).rejects.toThrow(
      "it linted 2 of the 3 files it was given, so it skipped some.",
    );
    const failure = problem(real.a, {
      message:
        "Error running JS plugin.\nFile path: A.tsx\nError: You have used a rule which requires type information",
    });
    await expect(lintOx(oxlintToolchain({ code: 1, stdout: report([failure]) }))).rejects.toThrow(
      "a JS plugin failed, so its rules did not run.",
    );
  });

  it("rejects an exit code that disagrees with the report", async () => {
    const debuggerProblem = problem(real.a, {
      code: "eslint(no-debugger)",
      message: "No.",
      line: 1,
    });
    await expect(
      lintOx(oxlintToolchain({ code: 0, stdout: report([debuggerProblem]) })),
    ).rejects.toThrow("its exit code disagrees with the 1 problem(s) it reported.");
    await expect(lintOx(oxlintToolchain({ code: 1, stdout: report([]) }))).rejects.toThrow(
      "its exit code disagrees with the 0 problem(s) it reported.",
    );
    await expect(
      lintOx(oxlintToolchain({ code: 2, stdout: report([debuggerProblem]) })),
    ).rejects.toThrow("oxlint exited with code 2: its exit code disagrees");
  });

  it("refuses what it cannot lint before starting anything", async () => {
    const toolchainDir = oxlintToolchain({ stdout: report([]) });
    await expect(lintOx(toolchainDir, [])).rejects.toThrow(
      "lint received no files: a check over nothing proves nothing.",
    );
    await expect(lintOx(toolchainDir, ["A.tsx"])).rejects.toThrow(
      "lint needs absolute paths, got: A.tsx",
    );
    await expect(lintOx(toolchainDir, [files.a, "/virtual/Gone.tsx"])).rejects.toThrow(
      "lint received files that do not exist:\n/virtual/Gone.tsx",
    );
    const bare = oxlintToolchain({ stdout: report([]) }, false);
    await expect(lintOx(bare)).rejects.toThrow(
      `${join(bare, "output.oxlintrc.json")} does not exist: oxlint lints with the toolchain's configuration.`,
    );
    const empty = writeTree(temporaryDir(), { "output.oxlintrc.json": "{}\n" });
    await expect(lintOx(empty)).rejects.toThrow(`oxlint is not installed in ${empty}`);
  });
});

/**
 * A toolchain directory with a stand-in ESLint 10, whose API records how it was used and
 * answers what `behaviour` says: `results`, by default a clean result for each file.
 */
function eslintToolchain(
  behaviour: { results?: unknown; throw?: string; stderr?: string },
  version = "10.11.0",
): string {
  return writeTree(temporaryDir(), {
    "eslint.config.js": "export default [];\n",
    "behaviour.json": JSON.stringify(behaviour),
    "node_modules/eslint/package.json": JSON.stringify({
      name: "eslint",
      version,
      exports: { ".": "./lib/api.js", "./package.json": "./package.json" },
    }),
    "node_modules/eslint/lib/api.js": [
      'const { readFileSync, writeFileSync } = require("node:fs");',
      'const { join } = require("node:path");',
      'const root = join(__dirname, "../../..");',
      "class ESLint {",
      "  constructor(options) {",
      "    this.options = options;",
      "  }",
      "  async lintFiles(files) {",
      '    writeFileSync(join(root, "invocation.json"), JSON.stringify({',
      "      options: this.options,",
      "      files,",
      "      cwd: process.cwd(),",
      "      env: {",
      "        NODE_OPTIONS: process.env.NODE_OPTIONS ?? null,",
      "        NODE_PATH: process.env.NODE_PATH ?? null,",
      "      },",
      "    }));",
      '    const behaviour = JSON.parse(readFileSync(join(root, "behaviour.json"), "utf8"));',
      "    if (behaviour.throw) throw new Error(behaviour.throw);",
      "    if (behaviour.stderr) process.stderr.write(behaviour.stderr);",
      "    return behaviour.results ?? files.map((filePath) => ({",
      "      filePath, messages: [], suppressedMessages: [],",
      "    }));",
      "  }",
      "}",
      "module.exports = { ESLint };",
      "",
    ].join("\n"),
  });
}

/** One file's ESLint result. */
const result = (filePath: string, messages: object[] = [], suppressedMessages: object[] = []) => ({
  filePath,
  messages,
  suppressedMessages,
});

const lintEs = (toolchainDir: string, given: readonly string[] = Object.values(files)) =>
  lintWithEslint(given, { toolchainDir, root: toolchainDir });

describe("lintWithEslint", () => {
  it("runs ESLint's API from the toolchain directory, based where the files are", async () => {
    vi.stubEnv("NODE_OPTIONS", "--no-deprecation");
    vi.stubEnv("NODE_PATH", "/hoisted/store/node_modules");
    const toolchainDir = eslintToolchain({});
    const results = await lintEs(toolchainDir);
    expect(Object.fromEntries(results)).toEqual({ [files.a]: [], [files.b]: [], [files.c]: [] });
    expect(invocation(toolchainDir)).toEqual({
      options: {
        // The files' common ancestor, which ESLint lints nothing outside of.
        cwd: realpathSync(outputs),
        overrideConfigFile: realpathSync(join(toolchainDir, "eslint.config.js")),
        overrideConfig: { linterOptions: { noInlineConfig: true } },
        warnIgnored: true,
        cache: false,
      },
      files: [real.a, real.b, real.c],
      cwd: realpathSync(toolchainDir),
      env: { NODE_OPTIONS: null, NODE_PATH: null },
    });
    // One file: its own directory.
    await lintEs(toolchainDir, [files.b]);
    expect((invocation(toolchainDir) as unknown as { options: { cwd: string } }).options.cwd).toBe(
      dirname(real.b),
    );
  });

  it("reports each message against the file as the caller spells it, in a stable order", async () => {
    const toolchainDir = eslintToolchain({
      results: [
        result(real.a, [
          { ruleId: "vue/attributes-order", severity: 2, message: "Order.", line: 3, column: 5 },
          { ruleId: "vue/no-v-html", severity: 1, message: "XSS.", line: 2, column: 1 },
        ]),
        result(real.b, [
          {
            ruleId: null,
            severity: 2,
            fatal: true,
            message: "Parsing error: x.",
            line: 1,
            column: 4,
          },
        ]),
        result(
          real.c,
          [],
          [
            {
              ruleId: "svelte/no-at-html-tags",
              severity: 2,
              message: "Hidden.",
              line: 7,
              column: 1,
            },
          ],
        ),
      ],
    });
    expect(Object.fromEntries(await lintEs(toolchainDir))).toEqual({
      [files.a]: [
        { message: "warning: XSS.", line: 2, column: 1, code: "vue/no-v-html" },
        { message: "Order.", line: 3, column: 5, code: "vue/attributes-order" },
      ],
      [files.b]: [{ message: "Parsing error: x.", line: 1, column: 4 }],
      [files.c]: [
        { message: "suppressed: Hidden.", line: 7, column: 1, code: "svelte/no-at-html-tags" },
      ],
    });
  });

  it("rejects a file it did not lint", async () => {
    const ignored = eslintToolchain({
      results: [
        result(real.a),
        result(real.b, [
          { ruleId: null, severity: 1, message: "File ignored because outside of base path." },
        ]),
        result(real.c),
      ],
    });
    await expect(lintEs(ignored)).rejects.toThrow(
      `it skipped ${real.b}: File ignored because outside of base path.`,
    );
    const missing = eslintToolchain({ results: [result(real.a), result(real.c)] });
    await expect(lintEs(missing)).rejects.toThrow(`it returned no results for ${real.b}.`);
  });

  it("rejects a run that did not end with its results", async () => {
    await expect(
      lintEs(eslintToolchain({ throw: "Cannot find package 'eslint-plugin-vue'" })),
    ).rejects.toThrow(
      /ESLint exited with code 1: it could not lint the files\.\n[\s\S]*Cannot find package 'eslint-plugin-vue'/,
    );
    await expect(lintEs(eslintToolchain({ stderr: "a plugin's warning" }))).rejects.toThrow(
      /ESLint exited with code 0: it wrote to stderr\.\n[\s\S]*a plugin's warning/,
    );
    await expect(
      lintEs(eslintToolchain({ results: [{ filePath: real.a, messages: "none" }] })),
    ).rejects.toThrow("its results do not have the shape this toolchain reads.");
  });

  it("refuses what it cannot run before starting anything", async () => {
    const old = eslintToolchain({}, "8.57.0");
    await expect(lintEs(old)).rejects.toThrow(
      `Expected ESLint 9 or later for ${old}, found 8.57.0`,
    );
    const empty = writeTree(temporaryDir(), { "eslint.config.js": "export default [];\n" });
    await expect(lintEs(empty)).rejects.toThrow(`eslint is not installed in ${empty}`);
    const bare = writeTree(temporaryDir(), {});
    await expect(lintEs(bare)).rejects.toThrow(
      `${join(bare, "eslint.config.js")} does not exist: ESLint lints with the toolchain's configuration.`,
    );
    await expect(lintEs(eslintToolchain({}), [])).rejects.toThrow("lint received no files");
  });
});

/** A message at `line` from rule `code`. */
const at = (line: number, code: string): ToolchainMessage => ({ message: code, line, code });

describe("mergeLintResults", () => {
  it("keeps every run's messages per path, in a stable order", () => {
    expect(
      Object.fromEntries(
        mergeLintResults([
          new Map([
            ["/A.vue", [at(3, "no-debugger")]],
            ["/B.vue", []],
          ]),
          new Map([
            ["/A.vue", [at(1, "vue/no-v-html"), at(3, "vue/attributes-order")]],
            ["/B.vue", []],
            ["/eslint.config.js", [{ message: "elsewhere" }]],
          ]),
        ]),
      ),
    ).toEqual({
      "/A.vue": [at(1, "vue/no-v-html"), at(3, "no-debugger"), at(3, "vue/attributes-order")],
      "/B.vue": [],
      "/eslint.config.js": [{ message: "elsewhere" }],
    });
  });
});

describe("lintWithOxlint with the real oxlint", { timeout: 60_000 }, () => {
  /** A toolchain directory that installs the workspace's own oxlint, with `config`. */
  function realToolchain(config: object): string {
    const oxlint = dirname(createRequire(import.meta.url).resolve("oxlint/package.json"));
    const toolchainDir = writeTree(temporaryDir(), {
      "package.json": `{ "name": "private", "private": true }\n`,
      "output.oxlintrc.json": JSON.stringify(config),
    });
    mkdirSync(join(toolchainDir, "node_modules"));
    symlinkSync(oxlint, join(toolchainDir, "node_modules/oxlint"), "dir");
    return toolchainDir;
  }

  const scratch = temporaryDir();
  const write = (name: string, contents: string) => {
    const path = join(scratch, name);
    writeFileSync(path, contents);
    return path;
  };
  const baseline = { plugins: ["eslint", "unicorn"], categories: { correctness: "error" } };

  it("reports rules by their configuration names, syntax errors and unused directives", async () => {
    const toolchainDir = realToolchain(baseline);
    const clean = write("Clean.ts", "export const one = 1;\n");
    const flagged = write(
      "Flagged.ts",
      "// oxlint-disable-next-line no-debugger\nexport const two = 2;\nexport function f(): void {\n  debugger;\n}\n",
    );
    const broken = write("Broken.tsx", "export const p = <p>;\n");
    const results = await lintOx(toolchainDir, [clean, flagged, broken]);
    expect(Object.fromEntries(results)).toEqual({
      [clean]: [],
      [flagged]: [
        expect.objectContaining({
          line: 1,
          column: 1,
          message: expect.stringMatching(/^Unused oxlint-disable directive/),
        }),
        expect.objectContaining({ line: 4, column: 3, code: "no-debugger" }),
      ],
      [broken]: [expect.objectContaining({ message: expect.stringMatching(/^Unexpected token/) })],
    });
    expect(results.get(broken)![0]).not.toHaveProperty("code");
  });

  it("rejects a configuration it cannot load, and a file it does not lint", async () => {
    const unknownRule = realToolchain({ rules: { "react/not-a-rule": "error" } });
    const file = write("File.ts", "export const one = 1;\n");
    await expect(lintOx(unknownRule, [file])).rejects.toThrow(
      /it printed output this toolchain cannot read/,
    );
    const missingPlugin = realToolchain({ jsPlugins: ["eslint-plugin-missing"], rules: {} });
    await expect(lintOx(missingPlugin, [file])).rejects.toThrow(/cannot read/);
    // oxlint skips a file it cannot parse as a language it knows.
    const text = write("notes.txt", "debugger;\n");
    await expect(lintOx(realToolchain(baseline), [file, text])).rejects.toThrow(
      "it linted 1 of the 2 files it was given, so it skipped some.",
    );
  });
});
