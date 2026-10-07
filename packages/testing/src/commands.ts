// The browser commands the parity layers call (`@unframework/testing/node` implements them).
// Types only: the browser side imports them through the `vitest/browser` augmentation.
import type { MountEvent } from "@unframework/codegen";

import type { CaptureRequest, CaptureResult } from "./visual-types.ts";

/** A shared expectation the browser computed, to settle under the write policy (ADR-0029). */
export interface ArtefactRequest {
  case: string;
  /** The file name under `__expected__/`, such as `dom.initial.html` or `trace.after-click.json`. */
  file: string;
  /**
   * The file's contents, or `null` where the scenario must have none (a trace without steps): the
   * file must then not exist, and the reference deletes it in update mode.
   */
  contents: string | null;
}

/** How an artefact was settled. */
export interface ArtefactResult {
  pass: boolean;
  /** `matched`, `written`, `missing`, `missing-reference` or `mismatch`. */
  status: string;
  /** Why it failed, with a diff; empty when it passed. */
  message: string;
}

/** A Vitest locator as commands receive it. */
export interface SerializedLocatorLike {
  selector: string;
  locator: string;
}

/** Which case's component `ufComponentEvents` describes. */
export interface ComponentEventsRequest {
  case: string;
}

/** The events the component a case's spec mounts declares, from the module the project compiled. */
export interface ComponentEventsResult {
  events: MountEvent[];
}

/**
 * One input of a person's action, which `ufInput` dispatches alone (ADR-0050): the pointer moved
 * onto an element (as Playwright's hover moves it, after its checks), a mouse button's press or
 * release (the `clickCount`-th of a multiple click), a step of the wheel, a key's press or
 * release.
 */
export type InputRequest =
  | {
      kind: "move";
      locator: SerializedLocatorLike;
      /** The point to move to, from the element's top left corner; its centre by default. */
      position?: { x: number; y: number };
      /** Whether a click follows, which refuses a disabled element, or only the move. */
      check: "click" | "hover";
    }
  | { kind: "press" | "release"; clickCount: number }
  | { kind: "wheel"; deltaX: number; deltaY: number }
  /** A key Playwright names (`Enter`, `Shift`), or one character (`text`). */
  | { kind: "keydown" | "keyup"; key: string; text: boolean };

/** What an input did: a character the keyboard layout lacks is inserted as text, with no key. */
export interface InputResult {
  inserted: boolean;
}

declare module "vitest/browser" {
  interface BrowserCommands {
    /** Settles a shared `__expected__` artefact under the run's write policy. */
    ufArtefact: (request: ArtefactRequest) => Promise<ArtefactResult>;
    /** Playwright's ARIA snapshot of the element a locator points at. */
    ufAriaSnapshot: (locator: SerializedLocatorLike) => Promise<string>;
    /** L10: font audit, stable capture, geometry then pixels, under the write policy. */
    ufVisualCapture: (request: CaptureRequest) => Promise<CaptureResult>;
    /** Moves the focus to the element a locator points at, as Playwright's `focus` does. */
    ufFocus: (locator: SerializedLocatorLike) => Promise<void>;
    /** Dispatches one input of a `view.user` action through Playwright's mouse or keyboard. */
    ufInput: (request: InputRequest) => Promise<InputResult>;
    /** Moves the mouse to the corner of the viewport, off every mount root, between tests. */
    ufResetInput: () => Promise<void>;
    /** The events a case's component declares, as the project's compile of it says (ADR-0050). */
    ufComponentEvents: (request: ComponentEventsRequest) => Promise<ComponentEventsResult>;
  }
}
