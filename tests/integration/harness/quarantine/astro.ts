// The Astro quarantine (ADR-0057): Astro's known failures, each with its reason and issue. Only
// entries whose target is "astro" belong here, so each target lane edits its own file.
import type { QuarantineEntry } from "@unframework/testing/node";

/**
 * The cases of M3's core lane (components, slots, fallthrough and expose) that Astro reports
 * as UF1002 until its own M3 lane emits composition (codegen's `compositionUse`): L1 finds an
 * error no capability cell of Astro's declares, or a fix that recompiles to one. Every later
 * layer has no output to check, and is skipped.
 */
const COMPOSITION: readonly string[] = [
  "components/branch-content",
  "components/list-item-root",
  "components/list-rows",
  "components/local-sibling",
  "components/named-import",
  "components/props-and-events",
  "components/recursion",
  "components/three-levels",
  "diagnostics/component-listener-option",
  "diagnostics/unknown-component",
  "expose/focus",
  "expose/several",
  "fallthrough/class-and-style",
  "fallthrough/inherit-attrs-false",
  "fallthrough/to-component-root",
  "slots/default",
  "slots/fallback",
  "slots/forwarding",
  "slots/in-list",
  "slots/named",
  "slots/presence",
  "slots/scoped",
];

export const QUARANTINE: readonly QuarantineEntry[] = COMPOSITION.map((id) => ({
  case: id,
  target: "astro",
  layer: "L1",
  reason: "Astro reports composition (UF1002) until its M3 lane emits it.",
  issue: "UXF-320",
}));
