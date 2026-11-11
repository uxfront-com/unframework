import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import config from "../../../oxlint.config.ts";
import { root } from "./workspace.ts";

/**
 * The lint rule that holds the corpus's specs to the public API of @unframework.dev/testing
 * (ADR-0085), run through oxlint itself: its patterns are oxlint's (Rust regular expressions with
 * no lookahead, `group` patterns merged into one list), so only oxlint can say what they refuse.
 * The override is copied into a throwaway project outside the repository, with a spec at a
 * corpus path, so nothing is written under `tests/integration/cases`.
 */
const CASES = "tests/integration/cases/**/*.{ts,tsx}";
const SPEC = "tests/integration/cases/state/counter/probe.test.ts";

/** Specifiers the rule refuses: a subpath, another package, the harness's or a package's code. */
const REFUSED: readonly string[] = [
  "@unframework.dev/testing/harness",
  "@unframework.dev/testing/setup",
  "@unframework.dev/testing/node",
  "@unframework.dev/compiler",
  "@unframework.dev/ir",
  "@unframework.dev/testingx",
  "@unframework.dev/testing-harness",
  "../../../harness/cases.ts",
  "../../../scripts/run.ts",
  "./../../../harness/cases.ts",
  "../../../../integration/harness/cases.ts",
  "../../../../../tests/integration/harness/cases.ts",
  "../../../../../packages/testing/src/layers.ts",
];

/** Specifiers it lets through: the public API, the authoring stubs, a case's own sources. */
const ALLOWED: readonly string[] = [
  "@unframework.dev/testing",
  "@uxfront/unframework",
  "vitest",
  "./Counter.uf.tsx",
  "../../props/primitives/Primitives.uf.tsx",
  "./harness-parent.uf.tsx",
];

const project = mkdtempSync(join(tmpdir(), "uf-corpus-imports-"));
afterAll(() => rmSync(project, { recursive: true, force: true }));

/** The specifiers oxlint reports `no-restricted-imports` for, one import per line of the spec. */
function refusedBy(specifiers: readonly string[]): string[] {
  const override = config.overrides?.find((entry) => entry.files.includes(CASES));
  if (!override) throw new Error(`oxlint.config.ts has no override for ${CASES}.`);
  writeFileSync(
    join(project, ".oxlintrc.json"),
    JSON.stringify({ overrides: [{ files: [CASES], rules: override.rules }] }),
  );
  mkdirSync(join(project, SPEC, ".."), { recursive: true });
  writeFileSync(
    join(project, SPEC),
    specifiers.map((specifier) => `import ${JSON.stringify(specifier)};\n`).join(""),
  );
  const run = spawnSync(
    join(root, "node_modules/.bin/oxlint"),
    ["-c", ".oxlintrc.json", "--format", "json", SPEC],
    { cwd: project, encoding: "utf8" },
  );
  const report = JSON.parse(run.stdout) as {
    diagnostics: { code: string; labels: { span: { line: number } }[] }[];
  };
  return report.diagnostics
    .filter((diagnostic) => diagnostic.code === "eslint(no-restricted-imports)")
    .map((diagnostic) => specifiers[diagnostic.labels[0]!.span.line - 1]!)
    .toSorted();
}

describe("the corpus's import rule", () => {
  it("refuses every import outside the public API", () => {
    expect(refusedBy(REFUSED)).toEqual([...REFUSED].toSorted());
  });

  it("lets the public API and a case's own sources through", () => {
    expect(refusedBy(ALLOWED)).toEqual([]);
  });
});
