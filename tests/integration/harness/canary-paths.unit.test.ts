// The rule that decides whether a pull request runs the canaries (ADR-0073).
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CANARY_PATHS, runsCanaries } from "../scripts/canary-paths.ts";
import { ROOT } from "./paths.ts";

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

describe("the canary path filter", () => {
  it("prints the line $GITHUB_OUTPUT takes", () => {
    expect(
      runScript("packages/target-vue/src/script.ts\npackages/analyzer/src/a.ts\n"),
    ).toMatchObject({ status: 0, stdout: "canaries=false\n" });
    expect(
      runScript("packages/analyzer/src/a.ts\ntests/integration/harness/guard.ts\n"),
    ).toMatchObject({ status: 0, stdout: "canaries=true\n" });
    expect(runScript("")).toMatchObject({ status: 0, stdout: "canaries=false\n" });
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
