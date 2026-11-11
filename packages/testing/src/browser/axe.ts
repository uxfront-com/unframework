// axe-core as L11 runs it, shared by `expectParity` and the `toHaveNoAxeViolations` matcher, so a
// spec's own accessibility assertion judges an element exactly as the layer does (ADR-0085).
import axe from "axe-core";

/**
 * axe runs on the mount container, so its page-level rules (one `<main>`, a level-one heading,
 * a bypass block) do not apply: they need the whole page as their context. `region` (all
 * content inside landmarks) is the page's structure too: the page that renders a component
 * places it in its landmarks, which the component cannot do for itself, so it is off. Every
 * rule about the component's own markup, its own landmarks included, stays on.
 */
const AXE_OPTIONS = {
  resultTypes: ["violations"],
  rules: { region: { enabled: false } },
} satisfies axe.RunOptions;

/** How an element's axe violations compare with the rules it is expected to break. */
export interface AxeComparison {
  /** The reported rules are exactly the expected ones. */
  pass: boolean;
  /**
   * One line for each reported rule that was not expected, with its impact, its help and the
   * elements it failed on.
   */
  unexpected: string[];
  /** The expected rules axe did not report. */
  missing: string[];
}

/**
 * Runs axe-core on `element` with L11's options, and compares the rules it reports with
 * `expected`, the rule ids the element is known to break (case.json's `axe` for L11).
 */
export async function compareAxe(
  element: Element,
  expected: readonly string[],
): Promise<AxeComparison> {
  const results = await axe.run(element, AXE_OPTIONS);
  const actual = [...new Set(results.violations.map((violation) => violation.id))].sort();
  const wanted = [...new Set(expected)].sort();
  if (actual.join("\n") === wanted.join("\n")) return { pass: true, unexpected: [], missing: [] };
  const unexpected = results.violations
    .filter((violation) => !wanted.includes(violation.id))
    .map(
      (violation) =>
        `  ${violation.id} (${violation.impact ?? "no impact"}): ${violation.help} at ${violation.nodes
          .map((node) => node.target.join(" "))
          .join(", ")}`,
    );
  const missing = wanted.filter((id) => !actual.includes(id));
  return { pass: false, unexpected, missing };
}
