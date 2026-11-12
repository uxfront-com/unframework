// The run's data (ADR-0087): `<out>/report.json`, one cell per example and target, and the images
// it names, relative to the report's directory, so a page beside it (M7's P4) can show them.
import { relative, sep } from "node:path";

import type { CaptureOutcome, CaptureResult, GeometryDelta } from "@unframework.dev/testing/node";

/** The version of {@link VisualReport}'s shape: bumped on every breaking change. */
export const REPORT_VERSION = 1;

/** How a cell ended. */
export type VisualStatus = "passed" | "failed";

/**
 * Why a cell failed outside its capture: `not-captured`, when its test failed before it captured
 * (the example did not compile or mount on the target, say) or never ran (its browser project
 * stopped); `test-failed`, when it captured and matched, and its test failed after, as the setup
 * file judged it (a console message, L13, or an unmount that threw, L8).
 */
export type MissingCapture = "not-captured" | "test-failed";

/** The images and files a cell left, relative to the report's directory. */
export interface VisualImages {
  /** The target's capture, written for every cell that captured, a passing one too. */
  capture?: string;
  /** A failed comparison: the expectation it compared with, the capture, and their difference. */
  reference?: string;
  actual?: string;
  diff?: string;
  /** A failed comparison: the capture's geometry and computed styles. */
  geometry?: string;
}

/** One example on one target. */
export interface VisualCell {
  target: string;
  /** The reference's capture is the expectation every other target is compared with. */
  role: "reference" | "follower";
  status: VisualStatus;
  /** L10's outcome, or `not-captured` or `test-failed`. */
  outcome: CaptureOutcome | MissingCapture;
  /** Why it failed, or what it noted; empty when there is nothing to say. */
  message: string;
  /** Pixels that differ from the expectation; `null` when no pixels were compared. */
  diffPixels: number | null;
  /** The geometry and computed-style deltas of a failed comparison, every one. */
  geometry: GeometryDelta[];
  images: VisualImages;
}

/** One example, with a cell for each target of the run, in the run's order. */
export interface VisualExample {
  id: string;
  /** The example's file relative to the project's root, with forward slashes. */
  file: string;
  cells: VisualCell[];
}

/** `report.json`. */
export interface VisualReport {
  version: typeof REPORT_VERSION;
  /** `live` compares every target with the reference's capture in the run, `baseline` with files. */
  pixels: "live" | "baseline";
  /** Whether the run wrote the baselines (`--update`, in the baseline environment). */
  update: boolean;
  reference: string;
  /** The targets of the run, in the project's order. */
  targets: string[];
  /** Whether every cell passed. */
  passed: boolean;
  examples: VisualExample[];
}

/** One capture the run recorded, by example and target. */
export interface RecordedCapture {
  example: string;
  target: string;
  result: CaptureResult;
  /**
   * The files a failed comparison left in its target's directory, absolute: as far as it got, its
   * capture, its geometry, the image it was compared with and their diff.
   */
  failure?: { actual?: string; geometry?: string; reference?: string; diff?: string };
}

/** What {@link buildReport} reads. */
export interface ReportInput {
  root: string;
  /** The report's directory: image paths are relative to it. */
  out: string;
  pixels: "live" | "baseline";
  update: boolean;
  reference: string;
  targets: readonly string[];
  examples: readonly { id: string; file: string }[];
  captures: readonly RecordedCapture[];
  /**
   * The cells whose test failed, by `<example> <target>`, with the test's errors: a cell passes
   * only when its capture matched and its test passed.
   */
  errors?: ReadonlyMap<string, string>;
}

/** The key of a cell in {@link ReportInput.errors}. */
export function cellKey(example: string, target: string): string {
  return `${example} ${target}`;
}

/**
 * The report of a run: every example on every target. A cell with no capture fails, and so does
 * one whose capture failed, a follower whose reference never captured included (ADR-0091), and
 * one whose test failed after a capture that matched: the report never shows a cell as passed
 * that its test failed, or that compared nothing it should have.
 */
export function buildReport(input: ReportInput): VisualReport {
  const rel = (file: string) => posixRelative(input.out, file);
  const examples = input.examples.map((example): VisualExample => {
    const cells = input.targets.map((target): VisualCell => {
      const role = target === input.reference ? "reference" : "follower";
      const recorded = input.captures.filter(
        (each) => each.example === example.id && each.target === target,
      );
      const result = recorded.at(-1)?.result;
      if (!result) {
        return {
          target,
          role,
          status: "failed",
          outcome: "not-captured",
          message:
            input.errors?.get(cellKey(example.id, target)) ??
            "The example's test on this target ended before it captured anything.",
          diffPixels: null,
          geometry: [],
          images: {},
        };
      }
      const failure = input.errors?.get(cellKey(example.id, target));
      const images: VisualImages = {};
      if (result.capture) images.capture = rel(result.capture);
      const left = recorded.at(-1)?.failure ?? {};
      for (const name of ["reference", "actual", "diff", "geometry"] as const) {
        const file = left[name];
        if (file !== undefined) images[name] = rel(file);
      }
      // Two captures of one cell would mean a spec ran twice: the last one wins, and fails.
      const once = recorded.length === 1;
      const testFailed = result.pass && once && failure !== undefined;
      return {
        target,
        role: result.role,
        status: result.pass && once && failure === undefined ? "passed" : "failed",
        outcome: testFailed ? "test-failed" : result.outcome,
        message: !once
          ? `The example was captured ${recorded.length} times on this target.`
          : testFailed
            ? failure
            : result.message,
        diffPixels: result.diffPixels ?? null,
        geometry: result.deltas ?? [],
        images,
      };
    });
    return { id: example.id, file: posixRelative(input.root, example.file), cells };
  });
  return {
    version: REPORT_VERSION,
    pixels: input.pixels,
    update: input.update,
    reference: input.reference,
    targets: [...input.targets],
    passed: examples.every((example) => example.cells.every((cell) => cell.status === "passed")),
    examples,
  };
}

/** A path relative to a directory, with forward slashes. */
export function posixRelative(from: string, file: string): string {
  return relative(from, file).split(sep).join("/");
}

/** The report's lines for the terminal: one per example, then each failed cell's message. */
export function formatReport(report: VisualReport): string[] {
  const lines: string[] = [];
  for (const example of report.examples) {
    const failed = example.cells.filter((cell) => cell.status === "failed");
    const status = failed.length
      ? `failed on ${failed.map((cell) => `${cell.target} (${cell.outcome})`).join(", ")}`
      : `passed on ${example.cells.length} target${example.cells.length === 1 ? "" : "s"}`;
    lines.push(`${failed.length ? "✗" : "✓"} ${example.id}: ${status}`);
    for (const cell of failed) {
      const message = cell.message.split("\n").slice(0, 8).join("\n    ");
      lines.push(`  ${cell.target}: ${message}`);
    }
  }
  return lines;
}
