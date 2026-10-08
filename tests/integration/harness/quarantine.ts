// The quarantine (plan §7.7): known failures, each tied to an issue. A quarantined
// (case, target, layer) still runs and must still fail; it is recorded as quarantined(issue)
// instead of failing the test. Once it passes, the entry is stale and fails the test until it
// is removed (`settleOutcome` in @unframework/testing), so this list only shrinks. Each target
// keeps its entries in its own file, `quarantine/<target>.ts`, so target lanes never edit the
// same list (ADR-0057); this module joins them.
import type { TargetName } from "@unframework/compiler";
import { LAYERS } from "@unframework/testing/node";
import type { LayerName, QuarantineEntry } from "@unframework/testing/node";

import { QUARANTINE as ANGULAR } from "./quarantine/angular.ts";
import { QUARANTINE as ASTRO } from "./quarantine/astro.ts";
import { QUARANTINE as QWIK } from "./quarantine/qwik.ts";
import { QUARANTINE as REACT } from "./quarantine/react.ts";
import { QUARANTINE as SOLID } from "./quarantine/solid.ts";
import { QUARANTINE as SVELTE } from "./quarantine/svelte.ts";
import { QUARANTINE as VUE } from "./quarantine/vue.ts";

/** Each target's file of entries, by target. */
export const QUARANTINE_FILES: Readonly<Record<TargetName, readonly QuarantineEntry[]>> = {
  react: REACT,
  vue: VUE,
  svelte: SVELTE,
  solid: SOLID,
  angular: ANGULAR,
  qwik: QWIK,
  astro: ASTRO,
};

/**
 * Every target's entries, in one list. Throws when a file holds an entry of another target: a
 * lane that empties its own file must see every entry it owns.
 */
export function joinQuarantine(
  files: Readonly<Record<string, readonly QuarantineEntry[]>>,
): QuarantineEntry[] {
  const misfiled = Object.entries(files).flatMap(([target, entries]) =>
    entries
      .filter((entry) => entry.target !== target)
      .map(
        (entry) =>
          `${entry.case} › ${entry.target} › ${entry.layer} is in quarantine/${target}.ts: move it to quarantine/${entry.target}.ts.`,
      ),
  );
  if (misfiled.length)
    throw new Error(`[uf] Misfiled quarantine entries:\n  ${misfiled.join("\n  ")}`);
  return Object.values(files).flat();
}

/** Every known failure, from every target's file. */
export const QUARANTINE: readonly QuarantineEntry[] = joinQuarantine(QUARANTINE_FILES);

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
