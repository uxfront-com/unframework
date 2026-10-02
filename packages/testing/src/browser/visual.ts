// The browser half of L10: snapshot geometry, mark the container for the font audit, and hand
// both to `ufVisualCapture`, which captures, compares and applies the write policy in Node.
import { recordArtifact } from "vitest";
import type { RunnerTestCase } from "vitest";
import { commands } from "vitest/browser";
import type { Locator } from "vitest/browser";

import "../commands.ts";
import type { CaptureResult, PixelTolerance } from "../visual-types.ts";
import { captureGeometry } from "./geometry.ts";

let markers = 0;

/** Captures a settled container and compares it under the run's policy. */
export async function captureVisual(
  test: RunnerTestCase,
  input: {
    case: string;
    name: string;
    container: HTMLElement;
    locator: Locator;
    tolerance?: PixelTolerance;
  },
): Promise<CaptureResult> {
  const marker = `${Date.now().toString(36)}-${(markers += 1)}`;
  input.container.setAttribute("data-uf-capture", marker);
  try {
    const result = await commands.ufVisualCapture({
      element: input.locator.serialize(),
      case: input.case,
      name: input.name,
      geometry: captureGeometry(input.container),
      marker,
      ...(input.tolerance ? { tolerance: input.tolerance } : {}),
    });
    if (!result.pass && result.attachments.length) {
      // The artifact shape toMatchScreenshot uses, so reporters and the UI show the images.
      await recordArtifact(test, {
        type: "internal:toMatchScreenshot",
        kind: "visual-regression",
        message: result.message,
        attachments: result.attachments,
      });
    }
    return result;
  } finally {
    input.container.removeAttribute("data-uf-capture");
  }
}
