// Every committed IR golden passes `validateModule` (plan §5.3): `compile()` validates what a
// plugin's `ir` hook returns with it, so a module the schema's validator cannot read makes every
// such hook fail (UF8001), the canaries' included. The schema check alone does not read a golden.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { validateModule } from "@unframework.dev/ir";
import { describe, expect, it } from "vitest";

const CASES = join(import.meta.dirname, "..", "cases");

/** Each `__output__/ir*.json` under the cases, relative to the cases directory. */
function goldens(): string[] {
  return readdirSync(CASES, { recursive: true, encoding: "utf8" })
    .filter((path) => /(^|[/\\])__output__[/\\]ir(\.[A-Za-z0-9]+)?\.json$/.test(path))
    .toSorted();
}

describe("the IR goldens", () => {
  it("are found", () => {
    expect(goldens().length).toBeGreaterThan(300);
  });

  it("each pass validateModule", () => {
    const failures = goldens().flatMap((path) => {
      const module: unknown = JSON.parse(readFileSync(join(CASES, path), "utf8"));
      try {
        const errors = validateModule(module);
        return errors.length ? [`${path}: ${JSON.stringify(errors[0])}`] : [];
      } catch (error) {
        return [`${path}: throws ${error instanceof Error ? error.message : String(error)}`];
      }
    });
    expect(failures).toEqual([]);
  });
});
