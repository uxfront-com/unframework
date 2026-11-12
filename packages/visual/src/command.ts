// `ufExampleCapture`: L10 for an example (ADR-0087). The browser sends the same request a case's
// scenario does, and this command locates it at the example (its baselines beside the file, its
// images in the run directory), runs the corpus's own capture and comparison (`captureAt`), and
// records the result for the run's report. Commands run in Vitest's main process, which is the
// process `runVisual` started Vitest in, so the report reads what every project recorded.
import { existsSync } from "node:fs";
import { join } from "node:path";

import { captureAt, projectHarness } from "@unframework.dev/testing/node";
import type {
  CaptureLocation,
  CaptureResult,
  VisualCommandContext,
} from "@unframework.dev/testing/node";

import { exampleBaselines } from "./examples.ts";
import type { RecordedCapture } from "./report.ts";
import type { ExampleCaptureRequest, VisualContext } from "./types.ts";

export type { ExampleCaptureRequest, VisualContext } from "./types.ts";

/** The command that writes an example's committed baselines, in the baseline environment. */
export const BASELINE_COMMAND = "unframework visual --update";

/** The files a failed comparison leaves in its target's directory (L10, `captureAt`). */
const FAILURE_FILES = {
  actual: "actual.png",
  geometry: "geometry.actual.json",
  reference: "reference.png",
  diff: "diff.png",
} as const;

/** Per process: each run's captures, by run id. */
const STATE = Symbol.for("unframework.visual.captures");

function store(): Map<string, RecordedCapture[]> {
  const holder = globalThis as { [STATE]?: Map<string, RecordedCapture[]> };
  return (holder[STATE] ??= new Map());
}

/** The captures a run recorded, and forgets them. */
export function takeCaptures(runId: string): RecordedCapture[] {
  const captures = store().get(runId) ?? [];
  store().delete(runId);
  return captures;
}

/** An example's capture on a target, located beside the example and in the run directory. */
export function exampleLocation(
  visual: VisualContext,
  caseId: string,
  reference: string,
  example: string,
  target: string,
): CaptureLocation {
  const known = Object.hasOwn(visual.examples, example) ? visual.examples[example] : undefined;
  if (!known || example.split("/").includes("..")) {
    throw new Error(`[uf:visual] Unknown example "${example}".`);
  }
  const baselines = exampleBaselines(known);
  const directory = join(visual.out, ...example.split("/"));
  return {
    key: `example:${example}`,
    label: example,
    case: caseId,
    reference,
    baselinePng: baselines.png,
    geometry: baselines.geometry,
    livePng: join(directory, `${reference}.png`),
    capture: join(directory, `${target}.png`),
    diffs: join(directory, target),
    baselineCommand: BASELINE_COMMAND,
  };
}

/** `ufExampleCapture`. */
export async function ufExampleCapture(
  context: VisualCommandContext,
  request: ExampleCaptureRequest,
): Promise<CaptureResult> {
  const { target, harness } = projectHarness(context);
  // The testing package types the provided context its own commands read; this is the run's.
  const { ufVisual: visual } = context.project.getProvidedContext() as { ufVisual?: VisualContext };
  if (!visual) {
    throw new Error(
      `[uf:visual] Project "${context.project.name}" does not provide "ufVisual": ufExampleCapture only runs in the visual run's projects.`,
    );
  }
  const location = exampleLocation(
    visual,
    request.case,
    harness.reference,
    request.example,
    target,
  );
  const result = await captureAt(context, request, location);
  const captures = store().get(harness.runId) ?? [];
  // The run directory is emptied before each run, so what is there is this capture's.
  const failure = Object.fromEntries(
    Object.entries(FAILURE_FILES)
      .map(([name, file]) => [name, join(location.diffs, file)] as const)
      .filter(([, file]) => existsSync(file)),
  );
  captures.push({
    example: request.example,
    target,
    result,
    ...(Object.keys(failure).length ? { failure } : {}),
  });
  store().set(harness.runId, captures);
  return result;
}
