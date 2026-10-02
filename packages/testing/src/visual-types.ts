// The shapes the browser and the `ufVisualCapture` command exchange (L10), and how L10 reads them.

/**
 * L10's skip reason for the reference with live pixels: its capture is the expectation the
 * followers compare against, so nothing was compared, and a pass would claim otherwise.
 */
export const LIVE_REFERENCE_SKIP = "live pixels: the reference's capture is this run's expectation";

/** `[x, y, width, height]`, relative to the capture container. */
export type GeometryBox = [x: number, y: number, width: number, height: number];

/** One element (its border box and computed styles) or text node (one box per line fragment). */
export interface GeometryNode {
  box: GeometryBox | GeometryBox[];
  style?: Record<string, string>;
}

/** The committed `__expected__/geometry.<name>.json`. */
export interface GeometrySnapshot {
  version: 1;
  nodes: Record<string, GeometryNode>;
}

/** A pixel tolerance; zero by default, and never without a reason. */
export interface PixelTolerance {
  maxDiffPixels: number;
  reason: string;
}

/** What the browser sends to `ufVisualCapture`. */
export interface CaptureRequest {
  /** The serialised locator of the capture container. */
  element: { selector: string; locator: string };
  case: string;
  /** The scenario, such as `"initial"`. */
  name: string;
  /** Captured in the browser right before the command. */
  geometry: GeometrySnapshot;
  /** The marker attribute value on the container, which the font audit queries. */
  marker: string;
  tolerance?: PixelTolerance;
}

/** How a capture ended. */
export type CaptureOutcome =
  | "matched"
  | "matched-within-tolerance"
  /** The reference with live pixels: its capture is the expectation, so there is nothing to compare. */
  | "published-reference"
  | "wrote-reference"
  /** Update mode outside the baseline environment: the committed baselines are not written. */
  | "refused-write"
  | "missing-artefact"
  | "missing-reference-capture"
  | "geometry-mismatch"
  | "pixel-mismatch"
  | "size-mismatch"
  | "font-fallback"
  | "unstable";

/** An image a failed capture leaves behind, in the shape Vitest's visual artifacts use. */
export interface CaptureAttachment {
  name: "reference" | "actual" | "diff";
  path: string;
  width: number;
  height: number;
}

/** What `ufVisualCapture` returns. */
export interface CaptureResult {
  pass: boolean;
  /** `check+baseline`, `update+live`, …: how the run treated this capture. */
  mode: string;
  role: "reference" | "follower";
  outcome: CaptureOutcome;
  message: string;
  diffPixels?: number;
  attachments: CaptureAttachment[];
}
