import { describe, expect, it } from "vitest";

import { buildFixture, declares } from "./fixture.ts";

// Qwik shares its helpers (ADR-0121): each is one module at the root of the tree. The directive
// runner stays inline in each component (R2), and imports the shared queue.
describe("shared helper modules: Qwik", () => {
  it("writes each helper once in _unframework/, and every component imports it", async () => {
    const written = await buildFixture("qwik");
    expect(Object.keys(written).filter((path) => path.startsWith("_unframework/"))).toEqual([
      "_unframework/queueHook.ts",
      "_unframework/scopeAttributes.ts",
      "_unframework/transition.ts",
    ]);
    // None below the root: one directory serves the whole tree.
    expect(Object.keys(written).filter((path) => path.includes("/_unframework/"))).toEqual([]);
    for (const component of ["cards/Card.tsx", "badges/Badge.tsx"]) {
      const contents = written[component]!;
      // An import that oxfmt wraps over several lines reads as one.
      const imports = contents.replaceAll(/\{[^}]*\}/g, (names) =>
        names.replaceAll(/\s+/g, " ").replace(/,? \}$/, " }"),
      );
      expect(imports, component).toContain(
        'import { queueHook } from "../_unframework/queueHook";',
      );
      expect(imports, component).toContain(
        'import { scopeAttributes } from "../_unframework/scopeAttributes";',
      );
      expect(imports, component).toContain(
        'import { type TransitionState, runTransition, stopTransition, transition } from "../_unframework/transition";',
      );
      for (const name of ["queueHook", "scopeAttributes", "transition", "runTransition"]) {
        expect(declares(contents, name), `${component} declares ${name}`).toBe(false);
      }
      expect(contents, component).not.toMatch(/^interface TransitionState\b/m);
      // The directive runner stays inline (R2).
      expect(declares(contents, "runDirective"), `${component} declares runDirective`).toBe(true);
    }
    // A helper module imports only its framework.
    for (const [path, contents] of Object.entries(written)) {
      if (!path.startsWith("_unframework/")) {
        continue;
      }
      for (const [, specifier] of contents.matchAll(/from "([^"]+)"/g)) {
        expect(specifier, path).toMatch(/^@qwik\.dev\/core(?:\/build)?$/);
      }
    }
  });
});
