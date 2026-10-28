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

/**
 * Each target's M3 lane, which emits composition: until it lands, the target reports a case's
 * composition as UF1002 (its quarantine lists the cases), so its cells have no case yet.
 */
const LANES: Readonly<Partial<Record<Exclude<TargetName, "vue">, string>>> = {};

/** The lanes of every target but those whose cell is unsupported. */
function lanesBut(
  ...unsupported: Exclude<TargetName, "vue">[]
): Partial<Record<TargetName, string>> {
  return Object.fromEntries(
    Object.entries(LANES).filter(([target]) => !unsupported.includes(target as never)),
  );
}

// M5's contract lands before what lowers and emits it (ADR-0067 to ADR-0070): each entry names
// the layer of M5 whose case removes it.
const COMPOSABLES =
  "No case uses a composable or a module value until every target emits them: the composable and module cases land in layer 38 of M5 (ADR-0069).";

/**
 * IR kinds that no case has yet, by family, and why none can: a kind a milestone adds before
 * its corpus case.
 */
export const EXEMPT_KINDS: Readonly<Partial<Record<KindFamily, Readonly<Record<string, string>>>>> =
  {
    binding: {
      // Layer 38 of M5.
      moduleConst: COMPOSABLES,
      import: COMPOSABLES,
      argument: COMPOSABLES,
      usedState: COMPOSABLES,
      usedDerived: COMPOSABLES,
      usedFn: COMPOSABLES,
      usedConst: COMPOSABLES,
    },
    "setup item": {
      // Layer 38 of M5.
      Use: COMPOSABLES,
    },
  };

/** Catalogued diagnostic codes that no case triggers, and why none can. */
export const EXEMPT_CODES: Readonly<Record<string, string>> = {
  UF8001:
    "Raised by a crashing compiler plugin: the L1 canary triggers it, and no case installs plugins.",
  UF9001:
    "An internal compiler error: a case that triggers it is a compiler bug to fix, not to keep.",
  // M5's codes are catalogued before the analyser reports them (ADR-0067 to ADR-0070). Layer 6
  // of M5 reads props types through the type oracle.
  // Layer 9 of M5 accepts generic components.
  // Layer 8 of M5 resolves child APIs and the corpus's types through the oracle.
  // Layer 10 of M5 imports shared modules.
  // Layer 14 of M5 emits cross-file types and generics on Vue.
  // Layer 32 of M5 builds the project graph.
  UF1205: "The project graph reports an import cycle, and the case lands in layer 32 of M5.",
  // Layer 38 of M5 lands the composable cases.
  UF2035: COMPOSABLES,
  UF2036: COMPOSABLES,
  UF4005: COMPOSABLES,
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
  composables: COMPOSABLES,
  "composable-effect-order": COMPOSABLES,
};
