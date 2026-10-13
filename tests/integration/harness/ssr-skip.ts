// When the server render (L6) is skipped by capability (ADR-0050): the browser layers skip each
// test that requires a capability its target lacks, and L6, which renders a case's scenarios
// before any test acts, skips a case whose every test requires one. A behavioural capability
// never skips it: it changes what code does in the browser, not what the server renders, so a
// case whose every test requires `interactivity` still checks Astro's server render.
import { BEHAVIOURAL_CAPABILITIES } from "@unframework/codegen";
import type { CapabilityCell, CapabilityName } from "@unframework/codegen";
import { requiresSkip } from "@unframework/testing/node";

/**
 * Why a case's server render is skipped on a target: the first capability that every test of
 * the case requires, that is not behavioural, and that the target's cell leaves unsupported
 * (`requires context: …`). Nothing when the case has no tests, or no such capability.
 */
export function ssrSkip(
  tests: readonly { requires: readonly string[] }[],
  cells: Readonly<Partial<Record<string, CapabilityCell>>>,
): string | undefined {
  const [first, ...rest] = tests;
  for (const name of first?.requires ?? []) {
    if (BEHAVIOURAL_CAPABILITIES.has(name as CapabilityName)) continue;
    if (!rest.every((test) => test.requires.includes(name))) continue;
    const cell = cells[name];
    if (cell?.support === "unsupported") return requiresSkip(name, cell.reason);
  }
  return undefined;
}
