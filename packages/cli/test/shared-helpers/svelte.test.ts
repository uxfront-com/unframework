import { describe, expect, it } from "vitest";

import { buildFixture, declares } from "./fixture.ts";

// Svelte shares its helpers (ADR-0121): each is one module at the root of the tree, which each
// component's instance script imports. The transition set is one module, which exports `enter`
// and `leave` and keeps `transitionClasses` and `transitionRuns` to itself.
describe("shared helper modules: Svelte", () => {
  it("writes each helper once in _unframework/, and every component imports it", async () => {
    const written = await buildFixture("svelte");
    expect(Object.keys(written).filter((path) => path.startsWith("_unframework/"))).toEqual([
      "_unframework/scopeAttributes.ts",
      "_unframework/transition.ts",
    ]);
    // None below the root: one directory serves the whole tree.
    expect(Object.keys(written).filter((path) => path.includes("/_unframework/"))).toEqual([]);
    for (const component of ["cards/Card.svelte", "badges/Badge.svelte"]) {
      const contents = written[component]!;
      expect(contents).toContain(
        'import { scopeAttributes } from "../_unframework/scopeAttributes";',
      );
      expect(contents).toContain('import { enter, leave } from "../_unframework/transition";');
      for (const name of ["scopeAttributes", "enter", "leave", "transitionClasses"]) {
        expect(declares(contents, name), `${component} declares ${name}`).toBe(false);
      }
      expect(declares(contents, "transitionRuns")).toBe(false);
      // The transition module imports `TransitionConfig` itself.
      expect(contents).not.toContain("TransitionConfig");
    }
    const transition = written["_unframework/transition.ts"]!;
    expect(transition).toMatch(/^export function enter\(/m);
    expect(transition).toMatch(/^export function leave\(/m);
    expect(transition).toMatch(/^function transitionClasses\(/m);
    expect(transition).toMatch(/^const transitionRuns = /m);
    // A helper module imports only its framework, and nothing else of ours.
    for (const [path, contents] of Object.entries(written)) {
      if (!path.startsWith("_unframework/")) continue;
      for (const [, specifier] of contents.matchAll(/from "([^"]+)"/g)) {
        expect(specifier, path).toMatch(/^(?:svelte(?:\/[\w-]+)?|\.\/\w+)$/);
      }
    }
  });
});
