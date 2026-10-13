// The Svelte quarantine (ADR-0057): Svelte's known failures, each with its reason and issue. Only
// entries whose target is "svelte" belong here, so each target lane edits its own file.
import type { QuarantineEntry } from "@unframework/testing/node";

/**
 * The cases of M3's core lane (components, slots, fallthrough, expose, models, context and
 * `<component is>`) that Svelte reports as UF1002 until its own M3 lane emits composition
 * (codegen's `compositionUse`): L1 finds an error no capability cell of Svelte's declares, or a fix
 * that recompiles to one. Every later layer has no output to check, and is skipped.
 */
const COMPOSITION: readonly string[] = [
  "components/acronym-names",
  "components/branch-content",
  "components/framework-names",
  "components/list-item-root",
  "components/list-rows",
  "components/local-sibling",
  "components/named-import",
  "components/props-and-events",
  "components/recursion",
  "components/three-levels",
  "context/fallback",
  "context/nested",
  "context/reactive",
  "context/static",
  "diagnostics/component-listener-option",
  "diagnostics/invalid-model",
  "diagnostics/invalid-v-model",
  "diagnostics/unknown-component",
  "dynamic/components",
  "dynamic/prop-union",
  "dynamic/tags",
  "expose/focus",
  "expose/several",
  "fallthrough/class-and-style",
  "fallthrough/inherit-attrs-false",
  "fallthrough/to-component-root",
  "models/checkbox",
  "models/checkbox-group",
  "models/component",
  "models/modifiers",
  "models/number",
  "models/radio",
  "models/select",
  "models/select-multiple",
  "models/several",
  "models/text-field",
  "models/textarea",
  "semantics/models",
  "slots/default",
  "slots/fallback",
  "slots/forwarding",
  "slots/in-list",
  "slots/named",
  "slots/presence",
  "slots/prop-names",
  "slots/scoped",
  "slots/scoped-default",
];

export const QUARANTINE: readonly QuarantineEntry[] = COMPOSITION.map((id) => ({
  case: id,
  target: "svelte",
  layer: "L1",
  reason: "Svelte reports composition (UF1002) until its M3 lane emits it.",
  issue: "UXF-316",
}));
