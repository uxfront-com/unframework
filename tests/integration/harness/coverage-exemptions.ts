// What the coverage gate (plan §7.7) excuses, each with the reason. The gate derives coverage
// from the corpus; an entry here that the corpus covers fails the gate, so the lists only
// shrink as cases arrive.
import type { CapabilityName } from "@unframework/codegen";
import type { TargetName } from "@unframework/compiler";

/** The families of IR kinds the gate requires a case for (`KIND_RECORDS` in `coverage.ts`). */
export type KindFamily =
  | "node"
  | "attribute"
  | "binding"
  | "setup item"
  | "handler"
  | "watch source"
  | "code reference";

// Composition's contract lands before its lowering (ADR-0055): each entry names the M3 lane
// whose case removes it (the M3 plan's lanes).
const LAYER_2 = "M3's G lane (layer-2 cross-component checks) adds its first case.";

/**
 * Each target's M3 lane, which emits composition: until it lands, the target reports a case's
 * composition as UF1002 (its quarantine lists the cases), so its cells have no case yet.
 */
const LANES: Readonly<Record<Exclude<TargetName, "vue">, string>> = {
  react: "React's M3 lane (UXF-315) emits composition, and its cases cover the cell.",
  svelte: "Svelte's M3 lane (UXF-316) emits composition, and its cases cover the cell.",
  solid: "Solid's M3 lane (UXF-317) emits composition, and its cases cover the cell.",
  angular: "Angular's M3 lane (UXF-318) emits composition, and its cases cover the cell.",
  qwik: "Qwik's M3 lane (UXF-319) emits composition, and its cases cover the cell.",
  astro: "Astro's M3 lane (UXF-320) emits composition, and its cases cover the cell.",
};

/** The lanes of every target but those whose cell is unsupported. */
function lanesBut(
  ...unsupported: Exclude<TargetName, "vue">[]
): Partial<Record<TargetName, string>> {
  return Object.fromEntries(
    Object.entries(LANES).filter(([target]) => !unsupported.includes(target as never)),
  );
}

/**
 * IR kinds that no case has yet, by family, and why none can: a kind a milestone adds before
 * its corpus case.
 */
export const EXEMPT_KINDS: Readonly<Partial<Record<KindFamily, Readonly<Record<string, string>>>>> =
  {};

/** Catalogued diagnostic codes that no case triggers, and why none can. */
export const EXEMPT_CODES: Readonly<Record<string, string>> = {
  UF8001:
    "Raised by a crashing compiler plugin: the L1 canary triggers it, and no case installs plugins.",
  UF9001:
    "An internal compiler error: a case that triggers it is a compiler bug to fix, not to keep.",
  UF3035: LAYER_2,
  UF3036: LAYER_2,
  UF3037: LAYER_2,
  UF3038: LAYER_2,
  UF3039: LAYER_2,
};

/**
 * Capabilities that no case uses yet, on every target that supports them, or on the targets an
 * entry names.
 */
export const EXEMPT_CAPABILITIES: Readonly<
  Partial<Record<CapabilityName, string | Partial<Record<TargetName, string>>>>
> = {
  component: lanesBut(),
  "component-event": lanesBut("astro"),
  "default-slot": lanesBut(),
  "named-slot": lanesBut(),
  "scoped-slot": lanesBut(),
  "slot-fallback": lanesBut(),
  "default-slot-presence": lanesBut("angular", "qwik"),
  "slot-forwarding": lanesBut(),
  model: lanesBut(),
  "two-way-binding": lanesBut("astro"),
  "model-array": lanesBut("astro"),
  "model-modifiers": lanesBut("astro"),
  fallthrough: lanesBut(),
  expose: lanesBut("astro"),
  context: lanesBut("astro"),
  "reactive-context": lanesBut("astro"),
  "dynamic-component": lanesBut(),
};
