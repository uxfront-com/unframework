// The rules that decide whether a pull request runs the canaries (ADR-0073) and the test jobs
// (ADR-0084).
import { spawnSync } from "node:child_process";
import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CANARY_PATHS,
  DOCS_PATHS,
  globToRegExp,
  runsCanaries,
  runsTests,
  TESTED_DOCS,
} from "../scripts/canary-paths.ts";
import { REPO_ROOT, ROOT } from "./paths.ts";

/** A file for each entry of the list. */
const ON_THE_LIST: readonly (readonly [string, string])[] = [
  [".github/workflows/ci.yml", ".github/workflows/ci.yml"],
  ["tests/integration/harness/**", "tests/integration/harness/guard.ts"],
  ["tests/integration/harness/**", "tests/integration/harness/quarantine/vue.ts"],
  ["tests/integration/scripts/**", "tests/integration/scripts/canary-paths.ts"],
  ["tests/integration/*.ts", "tests/integration/vitest.config.ts"],
  ["tests/integration/*.ts", "tests/integration/styleframe.config.ts"],
  ["tests/integration/*.d.ts", "tests/integration/fixture-engine.d.ts"],
  ["tests/integration/tsconfig*.json", "tests/integration/tsconfig.json"],
  ["tests/integration/tsconfig*.json", "tests/integration/tsconfig.cases.json"],
  ["tests/integration/package.json", "tests/integration/package.json"],
  ["tests/integration/cases/**/*.test.ts", "tests/integration/cases/state/counter/spec.test.ts"],
  ["tests/integration/cases/**/case.json", "tests/integration/cases/state/counter/case.json"],
  ["packages/testing/**", "packages/testing/src/index.ts"],
  ["packages/compiler/**", "packages/compiler/src/index.ts"],
  ["packages/unplugin/**", "packages/unplugin/src/index.ts"],
  ["packages/codegen/src/toolchain.ts", "packages/codegen/src/toolchain.ts"],
  ["packages/codegen/src/toolchain-node/**", "packages/codegen/src/toolchain-node/index.ts"],
  ["packages/codegen/src/toolchain-browser/**", "packages/codegen/src/toolchain-browser/index.ts"],
  ["packages/target-*/src/toolchain/**", "packages/target-vue/src/toolchain/index.ts"],
  ["tests/toolchains/**", "tests/toolchains/vue/tsconfig.json"],
  ["package.json", "package.json"],
  ["pnpm-workspace.yaml", "pnpm-workspace.yaml"],
  ["pnpm-lock.yaml", "pnpm-lock.yaml"],
];

/** What CI's `changes` job does: the names on stdin, the output's line on stdout. */
function runScript(input: string): { status: number | null; stdout: string } {
  return spawnSync(process.execPath, [join(ROOT, "scripts", "canary-paths.ts")], {
    input,
    encoding: "utf8",
  });
}

/** PR #147's files: the docs pages, an ADR, the plan and a README under a listed package. */
const PR_147: readonly string[] = [
  "apps/web/content/docs/4.tooling/3.bundler-plugin.md",
  "apps/web/content/docs/4.tooling/4.packaging.md",
  "docs/adrs/0079-the-e2e-apps-and-packed-tarballs.md",
  "docs/plan.md",
  "packages/unplugin/README.md",
];

/** The changes that are documentation alone: neither the canaries nor the tests run. */
const DOCS_ONLY: readonly (readonly [string, readonly string[]])[] = [
  ["PR #147's files", PR_147],
  ["a README under a listed package", ["packages/testing/README.md"]],
  ["the harness's README", ["tests/integration/README.md"]],
  ["an asset of the docs site", ["apps/web/content/docs/logo.svg"]],
  ["a Markdown name git quotes", [String.raw`"docs/caf\303\251.md"`]],
];

describe("the canary path filter", () => {
  it("prints the lines $GITHUB_OUTPUT takes", () => {
    expect(
      runScript("packages/target-vue/src/script.ts\npackages/analyzer/src/a.ts\n"),
    ).toMatchObject({ status: 0, stdout: "canaries=false\ntests=true\n" });
    expect(
      runScript("packages/analyzer/src/a.ts\ntests/integration/harness/guard.ts\n"),
    ).toMatchObject({ status: 0, stdout: "canaries=true\ntests=true\n" });
    // stdin ends in a newline, so its last line is empty: that line is no file outside the docs.
    expect(runScript(`${PR_147.join("\n")}\n`)).toMatchObject({
      status: 0,
      stdout: "canaries=false\ntests=false\n",
    });
    expect(runScript("")).toMatchObject({ status: 0, stdout: "canaries=false\ntests=true\n" });
  });

  it.each<readonly [string, boolean, boolean, readonly string[]]>([
    ...DOCS_ONLY.map(([name, files]) => [name, false, false, files] as const),
    [
      "the diagnostics page, which tests/repo compares with the catalogue",
      false,
      true,
      ["apps/web/content/docs/3.reference/2.diagnostics.md"],
    ],
    [
      "the targets page, which tests/repo renders from the targets' cells",
      false,
      true,
      ["apps/web/content/docs/3.reference/1.targets.md"],
    ],
    [
      "a Markdown file in a case, which listCases reads",
      false,
      true,
      ["tests/integration/cases/state/counter/notes.md"],
    ],
    ["a page and a source file", false, true, ["docs/plan.md", "packages/analyzer/src/a.ts"]],
    ["a target's emit code", false, true, ["packages/target-vue/src/script.ts"]],
    ["a harness file", true, true, ["tests/integration/harness/guard.ts"]],
    [
      "a harness name git quotes",
      true,
      true,
      [String.raw`"tests/integration/harness/caf\303\251.ts"`],
    ],
    ["no file", false, true, []],
  ])("for %s, decides canaries=%s and tests=%s", (_, canaries, tests, files) => {
    expect(runsCanaries(files)).toBe(canaries);
    expect(runsTests(files)).toBe(tests);
    expect(runScript(files.map((file) => `${file}\n`).join(""))).toMatchObject({
      status: 0,
      stdout: `canaries=${canaries}\ntests=${tests}\n`,
    });
  });

  // The canaries job keeps its own gate (ADR-0073), so it must sit inside the tests' gate: a
  // docs path added to CANARY_PATHS fails here.
  it("never runs the canaries without the tests", () => {
    for (const [glob, file] of ON_THE_LIST) expect(runsTests([file]), glob).toBe(true);
    for (const [name, files] of DOCS_ONLY) expect(runsCanaries(files), name).toBe(false);
  });

  it("never lets Markdown run the canaries, even under a listed path", () => {
    expect(
      runsCanaries(["packages/unplugin/README.md", "tests/integration/harness/NOTES.md"]),
    ).toBe(false);
    expect(DOCS_PATHS).toContain("**/*.md");
  });

  // TESTED_DOCS holds every page a test reads. A test that reads another page under the docs
  // site or the corpus must add it there, or a change to that page alone would skip the test.
  // This file names pages as data, so it is left out.
  it("lists every page a test reads in TESTED_DOCS", () => {
    const tested = TESTED_DOCS.map(globToRegExp);
    const named = new Set<string>();
    const unlisted: string[] = [];
    const files = globSync("**/*.test.ts", {
      cwd: REPO_ROOT,
      exclude: ["**/node_modules", "**/.git", "packages/compiler-v1"],
    });
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      if (file === join("tests", "integration", "harness", "canary-paths.unit.test.ts")) continue;
      const text = readFileSync(join(REPO_ROOT, file), "utf8");
      for (const [, path] of text.matchAll(
        /["'`]((?:apps\/web\/content|tests\/integration\/cases)\/[^"'`\s]*\.md)["'`]/g,
      )) {
        named.add(path!);
        if (!tested.some((pattern) => pattern.test(path!))) unlisted.push(`${file}: ${path!}`);
      }
    }
    // The two pages tests/repo reads, so the search finds what it looks for.
    expect(named).toContain("apps/web/content/docs/3.reference/1.targets.md");
    expect(named).toContain("apps/web/content/docs/3.reference/2.diagnostics.md");
    expect(unlisted).toEqual([]);
  });

  it.each([
    ["a target's emit code", ["packages/target-vue/src/script.ts"]],
    ["a target's tests", ["packages/target-qwik/test/emit.test.ts"]],
    ["the analyser", ["packages/analyzer/src/expressions.ts"]],
    [
      "emit code and tests of several targets",
      ["packages/target-react/src/emit.ts", "packages/target-solid/test/emit.test.ts"],
    ],
    [
      "emit code, tests and the analyser",
      [
        "packages/target-vue/src/script.ts",
        "packages/target-qwik/test/emit.test.ts",
        "packages/analyzer/src/expressions.ts",
      ],
    ],
  ])("skips the canaries for %s", (_, files) => {
    expect(runsCanaries(files)).toBe(false);
  });

  it.each(ON_THE_LIST)("runs the canaries for %s (%s)", (glob, file) => {
    expect(CANARY_PATHS).toContain(glob);
    expect(runsCanaries([file])).toBe(true);
  });

  it("runs the canaries when one file of many is on the list", () => {
    expect(
      runsCanaries(["packages/target-vue/src/script.ts", "tests/integration/harness/guard.ts"]),
    ).toBe(true);
  });

  it("has a case above for every entry of the list", () => {
    expect(new Set(ON_THE_LIST.map(([glob]) => glob))).toEqual(new Set(CANARY_PATHS));
  });

  it("skips the canaries for an empty list", () => {
    expect(runsCanaries([])).toBe(false);
  });

  it("leaves out the corpus's generated files and case sources, and the other compile packages", () => {
    expect(
      runsCanaries([
        "tests/integration/cases/state/counter/Counter.uf.tsx",
        "tests/integration/cases/state/counter/__output__/vue/Counter.vue",
        "tests/integration/cases/state/counter/__expected__/default.dom.html",
        "packages/ir/src/types.ts",
        "packages/parser/src/index.ts",
        "packages/diagnostics/src/catalogue.ts",
        "packages/type-oracle/src/index.ts",
        "packages/type-oracle-tsgo/src/index.ts",
        "packages/codegen/src/target.ts",
        "packages/unframework/src/index.ts",
        ".github/workflows/nightly.yml",
        "apps/web/content/docs/index.md",
      ]),
    ).toBe(false);
  });

  it("matches `*` within one path segment, and whole names", () => {
    expect(
      runsCanaries([
        // Below the package root, so neither the package's own files nor the root's manifest.
        "tests/integration/cases/state/counter/helper.ts",
        "apps/web/package.json",
        "packages/target-vue/package.json",
        "packages/testing-extra/src/index.ts",
        "packages/target-vue/src/toolchain.ts",
        "tests/integration/harness.ts.bak",
        "pnpm-lockXyaml",
      ]),
    ).toBe(false);
  });

  it("reads a path that git quotes, so an unusual name never skips the canaries", () => {
    expect(runsCanaries([String.raw`"tests/integration/harness/caf\303\251.ts"`])).toBe(true);
    expect(runsCanaries([String.raw`"tests/integration/caf\303\251.ts"`])).toBe(true);
    expect(runsCanaries([String.raw`"packages/target-vue/src/caf\303\251.ts"`])).toBe(false);
  });
});
