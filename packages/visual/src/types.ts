// What the visual run's browser and Node halves exchange: types only, so the browser imports this
// file for the command's types without loading any Node code.
import type { CaptureRequest, CaptureResult } from "@unframework.dev/testing/node";

/** What the visual run provides to each of its browser projects, as `ufVisual`. */
export interface VisualContext {
  /** The run directory (absolute): the captures and failures go under `<out>/<example id>/`. */
  out: string;
  /** Every example of the run, by id: its file (absolute) and its name. */
  examples: Record<string, { file: string; name: string }>;
}

/** What the browser sends: a capture, and the example it shows. */
export interface ExampleCaptureRequest extends CaptureRequest {
  example: string;
}

declare module "vitest" {
  interface ProvidedContext {
    /** The visual run's browser projects: where the examples are and where their images go. */
    ufVisual?: VisualContext;
  }
}

declare module "vitest/browser" {
  interface BrowserCommands {
    ufExampleCapture(request: ExampleCaptureRequest): Promise<CaptureResult>;
  }
}
