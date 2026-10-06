// What the coverage gate (plan §7.7) excuses, each with the reason. The gate derives coverage
// from the corpus; an entry here that the corpus covers fails the gate, so the lists only
// shrink as cases arrive.
import type { CapabilityName } from "@unframework/codegen";

/** Catalogued diagnostic codes that no case triggers, and why none can. */
export const EXEMPT_CODES: Readonly<Record<string, string>> = {
  UF4001:
    "Only two cells are unsupported: Astro's interactivity, which no case uses before M2's event cases trigger it, and Vue's listbox, which no case can use while Vue, the reference target, writes the shared expectations (ADR-0033); the compiler's tests cover it.",
  UF8001:
    "Raised by a crashing compiler plugin: the L1 canary triggers it, and no case installs plugins.",
  UF9001:
    "An internal compiler error: a case that triggers it is a compiler bug to fix, not to keep.",
};

/** Capabilities that no case uses yet, on any target that supports them. */
export const EXEMPT_CAPABILITIES: Readonly<Partial<Record<CapabilityName, string>>> = {
  interactivity: "M0 and M1 cases are static; M2 adds the first interactive cases (events, state).",
  listbox:
    "Vue, the reference target, cannot render a single-selection list box on its client (ADR-0033), so no case can hold one while Vue writes the shared expectations. M3's form cases add one, with `requires` to skip Vue and another reviewed source of expectations.",
};
