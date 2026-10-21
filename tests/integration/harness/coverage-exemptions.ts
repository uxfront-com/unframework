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

/**
 * IR kinds that no case has yet, by family, and why none can: a kind a milestone adds before
 * its corpus case.
 */
export const EXEMPT_KINDS: Readonly<Partial<Record<KindFamily, Readonly<Record<string, string>>>>> =
  {
    "code reference": {
      Import:
        "A read of a pass-through import (ADR-0063): the analyser lowers Styleframe's imports, and the case lands in layer 10 of M4.",
    },
  };

/** Catalogued diagnostic codes that no case triggers, and why none can. */
export const EXEMPT_CODES: Readonly<Record<string, string>> = {
  UF8001:
    "Raised by a crashing compiler plugin: the L1 canary triggers it, and no case installs plugins.",
  UF9001:
    "An internal compiler error: a case that triggers it is a compiler bug to fix, not to keep.",
  // M4's styling codes are catalogued before the analyser reports them (ADR-0063).
  UF5001: "The analyser accepts stylesheets, and the case lands in layer 4 of M4.",
  UF5002: "The analyser accepts stylesheets, and the case lands in layer 4 of M4.",
  UF5003: "The analyser accepts stylesheets, and the case lands in layer 4 of M4.",
  UF5004: "The scoper rejects selectors, and the case lands in layer 4 of M4.",
  UF5005: "The analyser accepts stylesheets, and the case lands in layer 4 of M4.",
  UF5006: "The analyser lowers Styleframe's imports, and the case lands in layer 10 of M4.",
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
  "scoped-styles": "No target attaches a scoped sheet yet: the cases land in layer 6 of M4.",
  "child-root-scope": "No target attaches a scoped sheet yet: the cases land in layer 6 of M4.",
  "slotted-styles": "No target attaches a scoped sheet yet: the cases land in layer 6 of M4.",
};
