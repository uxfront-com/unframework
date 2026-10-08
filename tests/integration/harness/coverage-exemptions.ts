// What the coverage gate (plan §7.7) excuses, each with the reason. The gate derives coverage
// from the corpus; an entry here that the corpus covers fails the gate, so the lists only
// shrink as cases arrive.
import type { CapabilityName } from "@unframework/codegen";

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
const COMPONENTS = "M3's E1 lane (components, slots, fallthrough and expose) adds its first case.";
const MODELS = "M3's E2 lane (models, context and `<component is>`) adds its first case.";
const LAYER_2 = "M3's G lane (layer-2 cross-component checks) adds its first case.";

/**
 * IR kinds that no case has yet, by family, and why none can: a kind a milestone adds before
 * its corpus case.
 */
export const EXEMPT_KINDS: Readonly<Partial<Record<KindFamily, Readonly<Record<string, string>>>>> =
  {
    node: {
      Component: COMPONENTS,
      SlotOutlet: COMPONENTS,
      Dynamic: MODELS,
    },
    attribute: {
      Model: MODELS,
      Prop: COMPONENTS,
      Listener: COMPONENTS,
      ModelBinding: MODELS,
    },
    binding: {
      model: MODELS,
      slots: COMPONENTS,
      slotScope: COMPONENTS,
      context: MODELS,
      component: MODELS,
    },
    "setup item": {
      Model: MODELS,
      Provide: MODELS,
      Inject: MODELS,
    },
    "code reference": {
      Slot: COMPONENTS,
    },
  };

/** Catalogued diagnostic codes that no case triggers, and why none can. */
export const EXEMPT_CODES: Readonly<Record<string, string>> = {
  UF8001:
    "Raised by a crashing compiler plugin: the L1 canary triggers it, and no case installs plugins.",
  UF9001:
    "An internal compiler error: a case that triggers it is a compiler bug to fix, not to keep.",
  UF1202: COMPONENTS,
  UF2028: MODELS,
  UF2029: COMPONENTS,
  UF2030: COMPONENTS,
  UF2031: COMPONENTS,
  UF2032: MODELS,
  UF2033: MODELS,
  UF2034: MODELS,
  UF3035: LAYER_2,
  UF3036: LAYER_2,
  UF3037: LAYER_2,
  UF3038: LAYER_2,
  UF3039: LAYER_2,
  UF3040: COMPONENTS,
  UF3041: COMPONENTS,
  UF3042: MODELS,
  UF3043: COMPONENTS,
  UF3044: MODELS,
  UF3045: COMPONENTS,
  UF3046: COMPONENTS,
  UF3047: COMPONENTS,
  UF3048: COMPONENTS,
  UF3049: COMPONENTS,
};

/** Capabilities that no case uses yet, on any target that supports them. */
export const EXEMPT_CAPABILITIES: Readonly<Partial<Record<CapabilityName, string>>> = {
  listbox:
    "Vue, the reference target, cannot render a single-selection list box on its client (ADR-0033), so no case can hold one while Vue writes the shared expectations. M3's form cases add one, with `requires` to skip Vue and another reviewed source of expectations.",
  component: COMPONENTS,
  "component-event": COMPONENTS,
  "default-slot": COMPONENTS,
  "named-slot": COMPONENTS,
  "scoped-slot": COMPONENTS,
  "slot-fallback": COMPONENTS,
  "default-slot-presence": COMPONENTS,
  "slot-forwarding": COMPONENTS,
  model: MODELS,
  "two-way-binding": MODELS,
  "model-array": MODELS,
  "model-modifiers": MODELS,
  fallthrough: COMPONENTS,
  "contextual-root": COMPONENTS,
  expose: COMPONENTS,
  context: MODELS,
  "reactive-context": MODELS,
  "dynamic-component": MODELS,
};
