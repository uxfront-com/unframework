// The shared helper of the targets' `composable` tests (./composable-cases.ts): it finds a case
// under `pending/` or `cases/`, and fails on one in neither, with or without a `pending/`.
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { COMPOSABLE_CASES, locateCase } from "./composable-cases.ts";

const scratch = mkdtempSync(join(tmpdir(), "uf-composable-cases-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** An integration directory holding the given case directories. */
function corpus(name: string, directories: string[]): string {
  const root = join(scratch, name);
  for (const directory of directories) mkdirSync(join(root, directory), { recursive: true });
  mkdirSync(root, { recursive: true });
  return root;
}

describe("the composable cases", () => {
  it("lists each case once, by area and name", () => {
    expect(new Set(COMPOSABLE_CASES).size).toBe(COMPOSABLE_CASES.length);
    for (const id of COMPOSABLE_CASES) expect(id).toMatch(/^[a-z]+\/[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it("finds every listed case in the repository", () => {
    for (const id of COMPOSABLE_CASES) expect(locateCase(id).dir).toMatch(new RegExp(`/${id}$`));
  });

  it("reads a case from pending/ before it lands", () => {
    const root = corpus("pending", ["pending/composables/use-toggle", "cases"]);
    expect(locateCase("composables/use-toggle", root)).toEqual({
      id: "composables/use-toggle",
      root: join(root, "pending"),
      dir: join(root, "pending/composables/use-toggle"),
    });
  });

  it("reads a case from cases/ once pending/ is gone", () => {
    const root = corpus("landed", ["cases/composables/use-toggle"]);
    expect(locateCase("composables/use-toggle", root).dir).toBe(
      join(root, "cases/composables/use-toggle"),
    );
  });

  it("fails on a case in neither, with or without a pending/", () => {
    for (const root of [corpus("without", ["cases"]), corpus("with", ["pending", "cases"])]) {
      expect(() => locateCase("composables/use-toggle", root)).toThrow(
        "The case composables/use-toggle is in neither tests/integration/pending/ nor tests/integration/cases/.",
      );
    }
  });
});
