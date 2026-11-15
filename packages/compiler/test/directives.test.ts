// A `.uf.ts` module's directives (ADR-0099): each compiles to one module per target, named and
// exported in its framework's idiom, and a component that applies one imports it from there.
// Astro runs no hook, so it writes no file for one, and its component imports none.
import { describe, expect, it } from "vitest";

import { compile, createFileResolver, TARGET_NAMES } from "../src/index.ts";
import type { TargetName } from "../src/index.ts";

const TRAP = `import { defineDirective } from "@uxfront/unframework";

const FOCUSABLE = "button";

export const vFocusTrap = defineDirective<boolean>({
  mounted(el, active) {
    if (active) el.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  },
});
`;

/** What each target names a directive's module, and what the module exports. */
const MODULES: Record<TargetName, { path: string; export: string } | undefined> = {
  vue: {
    path: "vFocusTrap.ts",
    export: "export const vFocusTrap: ObjectDirective<HTMLElement, boolean>",
  },
  react: { path: "vFocusTrap.ts", export: "export const vFocusTrap = {" },
  svelte: {
    path: "vFocusTrap.svelte.ts",
    export: "export function vFocusTrap(getValue: () => boolean): Attachment<HTMLElement>",
  },
  solid: {
    path: "vFocusTrap.ts",
    export: "export function vFocusTrap(getValue: () => boolean): (element: HTMLElement) => void",
  },
  angular: { path: "v-focus-trap.ts", export: "export class VFocusTrap {" },
  qwik: { path: "vFocusTrap.ts", export: "export const vFocusTrap = {" },
  astro: undefined,
};

describe("a module of directives on each target", () => {
  it.each(TARGET_NAMES)(
    "%s writes the directive's module as its framework's idiom",
    async (target) => {
      const result = await compile(TRAP, { filename: "focusTrap.uf.ts", targets: [target] });
      expect(result.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
      const files = result.outputs[target] ?? [];
      const expected = MODULES[target];
      if (!expected) {
        expect(files).toEqual([]);
        return;
      }
      expect(files.map(({ path }) => path)).toEqual([expected.path]);
      expect(files[0]!.contents).toContain(expected.export);
      // The constant its hook reads comes with it, as a composable's does (ADR-0070).
      expect(files[0]!.contents).toContain('const FOCUSABLE = "button";');
    },
  );

  it("writes no `use:` on Solid, which Solid 2 drops", async () => {
    const result = await compile(
      'import { vFocusTrap } from "./focusTrap.uf.ts";\nexport default function A() {\n  return <div v-focus-trap={true}>a</div>;\n}\n',
      {
        filename: "A.uf.tsx",
        targets: ["solid"],
        resolve: createFileResolver({
          root: "/project",
          readFile: (path) =>
            Promise.resolve(path === "/project/focusTrap.uf.ts" ? TRAP : undefined),
        }),
      },
    );
    expect(result.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
    const contents = result.outputs.solid?.[0]?.contents ?? "";
    expect(contents).toContain("ref={vFocusTrap(() => true)}");
    expect(contents).not.toContain("use:");
  });
});
