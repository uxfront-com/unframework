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

/**
 * IR kinds that no case has yet, by family, and why none can: a kind a milestone adds before
 * its corpus case. Empty while the corpus has every kind.
 */
export const EXEMPT_KINDS: Readonly<Partial<Record<KindFamily, Readonly<Record<string, string>>>>> =
  {};

/** Catalogued diagnostic codes that no case triggers, and why none can. */
export const EXEMPT_CODES: Readonly<Record<string, string>> = {
  UF8001:
    "Raised by a crashing compiler plugin: the L1 canary triggers it, and no case installs plugins.",
  UF9001:
    "An internal compiler error: a case that triggers it is a compiler bug to fix, not to keep.",
};

/** Capabilities that no case uses yet, on any target that supports them. */
export const EXEMPT_CAPABILITIES: Readonly<Partial<Record<CapabilityName, string>>> = {
  listbox:
    "Vue, the reference target, cannot render a single-selection list box on its client (ADR-0033), so no case can hold one while Vue writes the shared expectations. M3's form cases add one, with `requires` to skip Vue and another reviewed source of expectations.",
};
