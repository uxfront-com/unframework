// The browser commands the parity layers call (`@unframework/testing/node` implements them).
// Types only: the browser side imports them through the `vitest/browser` augmentation.
import type { CaptureRequest, CaptureResult } from "./visual-types.ts";

/** A shared expectation the browser computed, to settle under the write policy (DESIGN §4.4). */
export interface ArtefactRequest {
  case: string;
  /** The file name under `__expected__/`, such as `dom.initial.html`. */
  file: string;
  contents: string;
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

declare module "vitest/browser" {
  interface BrowserCommands {
    /** Settles a shared `__expected__` artefact under the run's write policy. */
    ufArtefact: (request: ArtefactRequest) => Promise<ArtefactResult>;
    /** Playwright's ARIA snapshot of the element a locator points at. */
    ufAriaSnapshot: (locator: SerializedLocatorLike) => Promise<string>;
    /** L10: font audit, stable capture, geometry then pixels, under the write policy. */
    ufVisualCapture: (request: CaptureRequest) => Promise<CaptureResult>;
  }
}
