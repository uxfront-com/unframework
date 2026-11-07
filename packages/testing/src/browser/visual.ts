// The browser half of L10: snapshot geometry, mark the container for the font audit, and hand
// both to `ufVisualCapture`, which captures, compares and applies the write policy in Node. Both
// see each run of adjacent text nodes as one node (./text-runs.ts, ADR-0044).
import type { CaptureResult, PixelTolerance } from "../visual-types.ts";
import { captureGeometry } from "./geometry.ts";
import { host } from "./host.ts";
import type { HostTest, Locator } from "./host.ts";
import { withMergedTextRuns } from "./text-runs.ts";

let markers = 0;

/** Captures a settled container and compares it under the run's policy. */
export async function captureVisual(
  test: HostTest,
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
    // Geometry and pixels of the same merged tree; the tree is restored before anything else
    // runs (L11, the spec's assertions, a rerender).
    const result = await withMergedTextRuns(input.container, () =>
      host().commands.ufVisualCapture({
        element: input.locator.serialize(),
        case: input.case,
        name: input.name,
        geometry: captureGeometry(input.container),
        marker,
        ...(input.tolerance ? { tolerance: input.tolerance } : {}),
      }),
    );
    if (!result.pass && result.attachments.length) {
      await host().recordVisualFailure(test, {
        message: result.message,
        attachments: result.attachments,
      });
    }
    return result;
  } finally {
    input.container.removeAttribute("data-uf-capture");
  }
}
