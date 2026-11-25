import { describe, expect, it } from "vitest";

import { buildFixture, declares } from "./fixture.ts";

// React shares its helpers (ADR-0121): each is one module at the root of the tree.
describe("shared helper modules: React", () => {
  it("writes each helper once in _unframework/, and every component imports it", async () => {
    const written = await buildFixture("react");
    expect(Object.keys(written).filter((path) => path.startsWith("_unframework/"))).toEqual([
      "_unframework/Transition.tsx",
      "_unframework/cx.ts",
      "_unframework/queueHook.ts",
      "_unframework/scopeAttributes.ts",
      "_unframework/subscribeNothing.ts",
      "_unframework/useDirective.ts",
    ]);
    // None below the root: one directory serves the whole tree.
    expect(Object.keys(written).filter((path) => path.includes("/_unframework/"))).toEqual([]);
    for (const component of ["cards/Card.tsx", "badges/Badge.tsx"]) {
      const contents = written[component]!;
      for (const name of ["cx", "scopeAttributes", "Transition", "useDirective"]) {
        expect(contents, `${component} imports ${name}`).toContain(
          `import { ${name} } from "../_unframework/${name}";`,
        );
        expect(declares(contents, name), `${component} declares ${name}`).toBe(false);
      }
      expect(declares(contents, "queueHook")).toBe(false);
    }
    // A helper module imports the helpers it calls as its siblings, and nothing else of ours.
    expect(written["_unframework/useDirective.ts"]).toContain(
      'import { queueHook } from "./queueHook";',
    );
    expect(written["_unframework/Transition.tsx"]).toContain(
      'import { subscribeNothing } from "./subscribeNothing";',
    );
    for (const [path, contents] of Object.entries(written)) {
      if (!path.startsWith("_unframework/")) {
        continue;
      }
      for (const [, specifier] of contents.matchAll(/from "([^"]+)"/g)) {
        expect(specifier, path).toMatch(/^(?:react|react-dom|\.\/\w+)$/);
      }
    }
  });
});
