// The browser commands the parity layers call. They run in Vitest's main process and read the
// calling project's target and harness context per call (`test.provide`), so one set serves
// every project of a run. Register them with `test.browser.commands: browserCommands`.
import { readdirSync } from "node:fs";
import { join } from "node:path";

import type {
  ArtefactRequest,
  ArtefactResult,
  ComponentEventsRequest,
  ComponentEventsResult,
  InputRequest,
  InputResult,
  SerializedLocatorLike,
} from "../commands.ts";
import { caseDirectory, projectHarness } from "./context.ts";
import type { CommandProject } from "./context.ts";
import { sharedArtefactContext } from "./context.ts";
import { compiledEvents } from "./events.ts";
import { KEBAB_CASE } from "./names.ts";
import { settleArtefact } from "./policy.ts";
import { VIEWPORT } from "./viewport.ts";
import { ufVisualCapture } from "./visual.ts";

/**
 * The shared expectations the browser may settle: `dom.<name>.html` and `aria.<name>.yaml` (L7)
 * and `trace.<name>.json` (L9).
 */
const BROWSER_ARTEFACT = /^(?:dom\.(.*)\.html|aria\.(.*)\.yaml|trace\.(.*)\.json)$/;

/** Whether a file is a browser artefact of a scenario with a {@link KEBAB_CASE} name. */
function isBrowserArtefact(file: string): boolean {
  const match = BROWSER_ARTEFACT.exec(file);
  const scenario = match?.[1] ?? match?.[2] ?? match?.[3];
  return scenario !== undefined && KEBAB_CASE.test(scenario);
}

/**
 * `ufArtefact`: settles a shared expectation the browser computed (L7, L9). Contents of `null`
 * say the scenario has no such file: only a trace may be absent, when no step led to it.
 */
export function ufArtefact(context: CommandProject, request: ArtefactRequest): ArtefactResult {
  const { target, harness } = projectHarness(context);
  if (!isBrowserArtefact(request.file)) {
    throw new Error(
      `[uf] "${request.file}" is not a browser artefact (dom.<name>.html, aria.<name>.yaml, trace.<name>.json).`,
    );
  }
  if (request.contents === null && !request.file.startsWith("trace.")) {
    throw new Error(`[uf] "${request.file}" always has contents: only a trace may be absent.`);
  }
  const path = join(caseDirectory(harness, request.case), "__expected__", request.file);
  const outcome = settleArtefact(
    path,
    request.contents ?? undefined,
    sharedArtefactContext(harness, target),
  );
  return { pass: outcome.pass, status: outcome.status, message: outcome.message };
}

/** What the ARIA and focus commands need from Vitest's command context (Playwright provider). */
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

/** What the focus command needs from Vitest's command context (Playwright provider). */
export interface FocusCommandContext {
  iframe: { locator(selector: string): { focus(): Promise<void> } };
}

/**
 * `ufFocus`: focuses the element a locator points at, as Playwright's `locator.focus()` does
 * (`view.user.focus`), waiting for it within the action timeout. Vitest's `userEvent` has no
 * focus action.
 */
export function ufFocus(
  context: FocusCommandContext,
  locator: SerializedLocatorLike,
): Promise<void> {
  return context.iframe.locator(locator.selector).focus();
}

/** What the input command needs from Vitest's command context (Playwright provider). */
export interface InputContext {
  page: {
    mouse: {
      down(options: { clickCount: number }): Promise<void>;
      up(options: { clickCount: number }): Promise<void>;
      wheel(deltaX: number, deltaY: number): Promise<void>;
    };
    keyboard: {
      down(key: string): Promise<void>;
      up(key: string): Promise<void>;
      insertText(text: string): Promise<void>;
    };
  };
  iframe: {
    locator(selector: string): {
      isEnabled(): Promise<boolean>;
      hover(options: { position?: { x: number; y: number } }): Promise<void>;
    };
  };
}

/**
 * `ufInput`: dispatches one input of a `view.user` action, so the browser side can settle the
 * page between two inputs, as the time between a person's would let it (ADR-0050). The move is
 * Playwright's hover: it waits until the element is visible, stable and the one under the point,
 * then moves the mouse to the point Playwright's click would press; a move before a click then
 * refuses a disabled element, which that click would wait on until it timed out. The presses
 * and releases happen where the mouse is, as in Playwright's click. A key is Playwright's
 * keyboard's, and a character its US layout lacks is inserted as text with no key, as Vitest's
 * `userEvent.keyboard` does: its release does nothing.
 */
export async function ufInput(context: InputContext, request: InputRequest): Promise<InputResult> {
  const { mouse, keyboard } = context.page;
  switch (request.kind) {
    case "move": {
      const target = context.iframe.locator(request.locator.selector);
      await target.hover(request.position ? { position: request.position } : {});
      // Checked once the element is there, never by a trial click: Playwright tries one by
      // pressing and releasing the mouse, which a listener the page added to the window before
      // Playwright's own blocking one would see.
      if (request.check === "click" && !(await target.isEnabled())) {
        throw new Error(
          `${request.locator.locator} is disabled: a click on it would do nothing. Click it once it is enabled.`,
        );
      }
      return { inserted: false };
    }
    case "press":
      await mouse.down({ clickCount: request.clickCount });
      return { inserted: false };
    case "release":
      await mouse.up({ clickCount: request.clickCount });
      return { inserted: false };
    case "wheel":
      await mouse.wheel(request.deltaX, request.deltaY);
      return { inserted: false };
    case "keydown":
      try {
        await keyboard.down(request.key);
        return { inserted: false };
      } catch (error) {
        if (!request.text || !UNKNOWN_KEY.test(String(error))) throw error;
        await keyboard.insertText(request.key);
        return { inserted: true };
      }
    case "keyup":
      await keyboard.up(request.key);
      return { inserted: false };
    default: {
      // The browser side builds every request, so this is a request a newer kind would add.
      const unknown: never = request;
      throw new TypeError(`ufInput: no input is ${JSON.stringify(unknown)}.`);
    }
  }
}

/** Playwright's refusal of a key its keyboard layout does not have. */
const UNKNOWN_KEY = /Unknown key: /;

/** What the input reset needs from Vitest's command context (Playwright provider). */
export interface InputCommandContext {
  page: { mouse: { move(x: number, y: number): Promise<void> } };
  frame(): Promise<{
    frameElement(): Promise<{
      boundingBox(): Promise<{ x: number; y: number; width: number; height: number } | null>;
    }>;
  }>;
}

/**
 * `ufResetInput`: moves the mouse to the bottom right corner of the tester frame, off every mount
 * root (they sit at the top left), so the next test starts with nothing hovered. Vitest's
 * `unhover` hovers the body's centre instead, which is inside any wide root. The browser side
 * releases the keys and the focus (see `resetInput`).
 */
export async function ufResetInput(context: InputCommandContext): Promise<void> {
  const frame = await context.frame();
  const box = await (await frame.frameElement()).boundingBox();
  const { width, height } = box ?? VIEWPORT;
  await context.page.mouse.move((box?.x ?? 0) + width - 1, (box?.y ?? 0) + height - 1);
}

/**
 * `ufComponentEvents`: the events the component of a case declares, from the project's own
 * compile of the case's main `.uf.tsx` (`recordCompiledModule`), so a mount listens to exactly
 * those (an undeclared `onX` would fall through to Vue's root as a native listener). The main
 * source is the case's only one, or the one its `case.json` names (ADR-0057): the spec mounts
 * it, and its children's events reach only it.
 */
export function ufComponentEvents(
  context: CommandProject,
  request: ComponentEventsRequest,
): ComponentEventsResult {
  const { target, harness } = projectHarness(context);
  const directory = caseDirectory(harness, request.case);
  const main = harness.cases[request.case]?.main;
  const sources = readdirSync(directory).filter((file) => file.endsWith(".uf.tsx"));
  if (main === undefined ? sources.length !== 1 : !sources.includes(main)) {
    throw new Error(
      main === undefined
        ? `[uf] Case ${request.case} must hold one .uf.tsx input, or name its main one in case.json, to mount; found ${sources.length}.`
        : `[uf] Case ${request.case} names ${main} as its main input, which it does not hold.`,
    );
  }
  return { events: compiledEvents(join(directory, main ?? sources[0]!), target) };
}

/** Every command the testing API needs, keyed by the name the browser calls. */
export const browserCommands: {
  ufArtefact: typeof ufArtefact;
  ufAriaSnapshot: typeof ufAriaSnapshot;
  ufVisualCapture: typeof ufVisualCapture;
  ufFocus: typeof ufFocus;
  ufInput: typeof ufInput;
  ufResetInput: typeof ufResetInput;
  ufComponentEvents: typeof ufComponentEvents;
} = {
  ufArtefact,
  ufAriaSnapshot,
  ufVisualCapture,
  ufFocus,
  ufInput,
  ufResetInput,
  ufComponentEvents,
};
