// The browser commands the parity layers call. They run in Vitest's main process and read the
// calling project's target and harness context per call (`test.provide`), so one set serves
// every project of a run. Register them with `test.browser.commands: browserCommands`.
import { join } from "node:path";

import type { ArtefactRequest, ArtefactResult, SerializedLocatorLike } from "../commands.ts";
import { caseDirectory, projectHarness, sharedArtefactContext } from "./context.ts";
import type { CommandProject } from "./context.ts";
import { KEBAB_CASE } from "./names.ts";
import { settleArtefact } from "./policy.ts";
import { ufVisualCapture } from "./visual.ts";

/** The shared expectations the browser may settle: `dom.<name>.html` and `aria.<name>.yaml`. */
const BROWSER_ARTEFACT = /^(?:dom\.(.*)\.html|aria\.(.*)\.yaml)$/;

/** Whether a file is a browser artefact of a scenario with a {@link KEBAB_CASE} name. */
function isBrowserArtefact(file: string): boolean {
  const match = BROWSER_ARTEFACT.exec(file);
  const scenario = match?.[1] ?? match?.[2];
  return scenario !== undefined && KEBAB_CASE.test(scenario);
}

/** `ufArtefact`: settles a shared expectation the browser computed (L7). */
export function ufArtefact(context: CommandProject, request: ArtefactRequest): ArtefactResult {
  const { target, harness } = projectHarness(context);
  if (!isBrowserArtefact(request.file)) {
    throw new Error(
      `[uf] "${request.file}" is not a browser artefact (dom.<name>.html, aria.<name>.yaml).`,
    );
  }
  const path = join(caseDirectory(harness, request.case), "__expected__", request.file);
  const outcome = settleArtefact(path, request.contents, sharedArtefactContext(harness, target));
  return { pass: outcome.pass, status: outcome.status, message: outcome.message };
}

/** What the ARIA command needs from Vitest's command context (Playwright provider). */
export interface AriaCommandContext {
  iframe: { locator(selector: string): { ariaSnapshot(): Promise<string> } };
}

/** `ufAriaSnapshot`: Playwright's ARIA snapshot of the element a locator points at (L7). */
export function ufAriaSnapshot(
  context: AriaCommandContext,
  locator: SerializedLocatorLike,
): Promise<string> {
  return context.iframe.locator(locator.selector).ariaSnapshot();
}

/** Every command the testing API needs, keyed by the name the browser calls. */
export const browserCommands: {
  ufArtefact: typeof ufArtefact;
  ufAriaSnapshot: typeof ufAriaSnapshot;
  ufVisualCapture: typeof ufVisualCapture;
} = { ufArtefact, ufAriaSnapshot, ufVisualCapture };
