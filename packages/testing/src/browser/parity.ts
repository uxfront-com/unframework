// `view.expectParity(name)`: the shared-expectation layers of one scenario (DESIGN §4.3).
//   L7   the normalised DOM and Playwright's ARIA snapshot, against __expected__/dom|aria.<name>.*
//   L10  geometry, then pixels, through the visual command
//   L11  axe-core on the container: no violations, or exactly the case's declared rules
// Each layer is recorded separately in `task.meta.uf`; the test then fails with every message.
import axe from "axe-core";
import { inject, TestRunner } from "vitest";
import type { RunnerTestCase } from "vitest";
import { commands } from "vitest/browser";
import type { Locator } from "vitest/browser";

import "../commands.ts";
import { caseOfFile } from "../harness.ts";
import { checkLayers } from "../layers.ts";
import { KEBAB_CASE } from "../node/names.ts";
import { LIVE_REFERENCE_SKIP } from "../visual-types.ts";
import type { PixelTolerance } from "../visual-types.ts";
import { captureVisual } from "./visual.ts";

/** Options for `expectParity`. */
export interface ParityOptions {
  /** A pixel tolerance for this scenario. Zero by default; any tolerance needs a reason. */
  tolerance?: PixelTolerance;
}

/** What `expectParity` needs from a mounted view. */
export interface ParityView {
  target: string;
  container: HTMLElement;
  locator: Locator;
  html(): string;
  settle(): Promise<void>;
}

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

/** Runs L7, L10 and L11 for one scenario of the current test's case. */
export async function expectParity(
  view: ParityView,
  name: string,
  options: ParityOptions = {},
): Promise<void> {
  if (!KEBAB_CASE.test(name)) {
    throw new Error(
      `expectParity("${name}"): a scenario name is kebab-case (words of a-z and 0-9 joined by single hyphens), such as "after-click".`,
    );
  }
  if (options.tolerance && !options.tolerance.reason.trim()) {
    throw new Error(`expectParity("${name}"): a pixel tolerance needs a reason.`);
  }
  const test = TestRunner.getCurrentTest<RunnerTestCase | undefined>();
  if (!test) throw new Error("expectParity must be called inside a test.");
  const harness = inject("ufHarness");
  const caseId = caseOfFile(test.file.filepath, harness);
  const declaredAxe = harness.cases[caseId]?.axe ?? [];
  await view.settle();

  await checkLayers(
    test,
    { case: caseId, target: view.target, quarantine: harness.quarantine },
    {
      async L7() {
        const failures: string[] = [];
        const dom = await commands.ufArtefact({
          case: caseId,
          file: `dom.${name}.html`,
          contents: asFile(view.html()),
        });
        if (!dom.pass) failures.push(dom.message);
        const snapshot = await commands.ufAriaSnapshot(view.locator.serialize());
        const aria = await commands.ufArtefact({
          case: caseId,
          file: `aria.${name}.yaml`,
          contents: asFile(snapshot),
        });
        if (!aria.pass) failures.push(aria.message);
        if (failures.length) throw new Error(failures.join("\n\n"));
      },
      async L10() {
        const result = await captureVisual(test, {
          case: caseId,
          name,
          container: view.container,
          locator: view.locator,
          ...(options.tolerance ? { tolerance: options.tolerance } : {}),
        });
        if (!result.pass) {
          throw new Error(`${result.outcome} (${result.mode}, ${result.role}): ${result.message}`);
        }
        return result.outcome === "published-reference" ? { skip: LIVE_REFERENCE_SKIP } : undefined;
      },
      async L11() {
        const results = await axe.run(view.container, AXE_OPTIONS);
        const actual = [...new Set(results.violations.map((violation) => violation.id))].sort();
        const expected = [...new Set(declaredAxe)].sort();
        if (actual.join("\n") === expected.join("\n")) return;
        const unexpected = results.violations.filter(
          (violation) => !expected.includes(violation.id),
        );
        const missing = expected.filter((id) => !actual.includes(id));
        const lines = unexpected.map(
          (violation) =>
            `  ${violation.id} (${violation.impact ?? "no impact"}): ${violation.help} at ${violation.nodes
              .map((node) => node.target.join(" "))
              .join(", ")}`,
        );
        if (missing.length) {
          lines.push(`  declared in case.json but not reported: ${missing.join(", ")}`);
        }
        throw new Error(
          `axe-core violations differ from case.json's "axe" list:\n${lines.join("\n")}`,
        );
      },
    },
  );
}

/** Artefacts are text files with exactly one trailing newline. */
function asFile(text: string): string {
  return `${text.replace(/\n+$/, "")}\n`;
}
