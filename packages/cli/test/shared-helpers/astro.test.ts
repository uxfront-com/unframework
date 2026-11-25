import { describe, expect, it } from "vitest";

import { buildFixture, declares } from "./fixture.ts";

// Astro shares its helpers (ADR-0121): each is one module at the root of the tree, which each
// component's frontmatter imports.
describe("shared helper modules: Astro", () => {
  it("writes each helper once in _unframework/, and every component imports it", async () => {
    const written = await buildFixture("astro");
    expect(Object.keys(written).filter((path) => path.startsWith("_unframework/"))).toEqual([
      "_unframework/scopeAttributes.ts",
    ]);
    // None below the root: one directory serves the whole tree.
    expect(Object.keys(written).filter((path) => path.includes("/_unframework/"))).toEqual([]);
    for (const component of ["cards/Card.astro", "badges/Badge.astro"]) {
      const contents = written[component]!;
      expect(contents).toContain(
        'import { scopeAttributes } from "../_unframework/scopeAttributes";',
      );
      expect(declares(contents, "scopeAttributes"), `${component} declares it`).toBe(false);
    }
    // A helper module imports nothing of ours.
    for (const [path, contents] of Object.entries(written)) {
      if (!path.startsWith("_unframework/")) {
        continue;
      }
      expect(contents, path).not.toMatch(/^import /m);
    }
  });
});
