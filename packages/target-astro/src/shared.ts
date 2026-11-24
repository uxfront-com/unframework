// Astro's shared helper modules (ADR-0121): each helper of an emulated capability is one module in
// the output tree's `_unframework/` directory, and each component that uses it imports it in its
// frontmatter by a relative path. Neither helper imports anything, so its text depends only on
// the helper (R1). `uniqueId` stays inline, since it reads `Astro.locals` (R3), and so does the
// fallthrough helper `withoutScope`, which the plan of UXF-982 decides on.
import type { EmitContext } from "@unframework.dev/codegen";

import { scopeAttributesHelper, styleObjectHelper } from "./frontmatter.ts";

/** A helper Astro shares, by the name its module exports. */
export type SharedHelper = "scopeAttributes" | "styleObject";

/** Exports the declaration of `name` in a helper's code: `function cx(` → `export function cx(`. */
function exported(code: string, name: string): string {
  return code.replace(new RegExp(`^function ${name}\\b`, "m"), `export function ${name}`);
}

/** Every module Astro shares: its file in `_unframework/`, and its text. */
const MODULES: Readonly<Record<SharedHelper, { file: string; code: string }>> = {
  scopeAttributes: {
    file: "scopeAttributes.ts",
    code: exported(scopeAttributesHelper("scopeAttributes"), "scopeAttributes"),
  },
  styleObject: {
    file: "styleObject.ts",
    code: exported(styleObjectHelper("styleObject"), "styleObject"),
  },
};

/**
 * Puts a shared helper in its module through `helper`, for the output at `from`, and gives the
 * specifier its frontmatter imports it by, without `.ts`, as Astro imports a `.ts` module.
 */
export function sharedHelper(
  helper: NonNullable<EmitContext["helper"]>,
  from: string,
): (name: SharedHelper) => string {
  return (name) => {
    const { file, code } = MODULES[name];
    return helper(file, `${code}\n`, from).replace(/\.ts$/, "");
  };
}
