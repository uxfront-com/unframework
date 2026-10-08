// The quarantine (plan §7.7): known failures, each tied to an issue. A quarantined
// (case, target, layer) still runs and must still fail; it is recorded as quarantined(issue)
// instead of failing the test. Once it passes, the entry is stale and fails the test until it
// is removed (`settleOutcome` in @unframework/testing), so this list only shrinks.
import { LAYERS } from "@unframework/testing/node";
import type { LayerName, QuarantineEntry } from "@unframework/testing/node";

/** Empty: every live layer is green on every target. */
export const QUARANTINE: readonly QuarantineEntry[] = [];

/**
 * The layers a quarantine entry may name: the live ones, where a failure can occur. M1 made L5
 * (lint, ADR-0042) and L8 (behaviour, ADR-0043) live; M2 made L9 (interaction traces, ADR-0050).
 */
export const LIVE_LAYERS: readonly LayerName[] = [
  "L1",
  "L2",
  "L3",
  "L4",
  "L5",
  "L6",
  "L7",
  "L8",
  "L9",
  "L10",
  "L11",
  "L13",
];

/**
 * Checks quarantine entries against the corpus and returns every problem: an unknown case,
 * target or layer would quarantine nothing and could never go stale, and an entry without a
 * reason or an issue cannot be followed up.
 */
export function validateQuarantine(
  entries: readonly QuarantineEntry[],
  known: { cases: readonly string[]; targets: readonly string[] },
): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const key = `${entry.case} › ${entry.target} › ${entry.layer}`;
    if (!known.cases.includes(entry.case)) problems.push(`${key}: no case "${entry.case}".`);
    if (!known.targets.includes(entry.target))
      problems.push(`${key}: no target "${entry.target}".`);
    if (!LAYERS.includes(entry.layer)) problems.push(`${key}: no layer "${entry.layer}".`);
    else if (!LIVE_LAYERS.includes(entry.layer))
      problems.push(`${key}: ${entry.layer} is not live, so it cannot fail.`);
    if (!entry.reason.trim()) problems.push(`${key}: needs a reason.`);
    if (!entry.issue.trim()) problems.push(`${key}: needs an issue.`);
    if (seen.has(key)) problems.push(`${key}: listed twice.`);
    seen.add(key);
  }
  return problems;
}
