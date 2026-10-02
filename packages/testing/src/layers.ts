// Per-layer outcomes (plan §7.2, §7.7): every harness test records what it verified, layer by
// layer, in `task.meta.uf`. The parity reporter turns those records into the parity matrix.
// Isomorphic: the browser API, the setup file and the Node drivers all record through here.
import { formatError } from "./errors.ts";
import type { PixelMode } from "./harness.ts";

/** The verification layers of plan §7.2. */
export type LayerName =
  | "L1"
  | "L2"
  | "L3"
  | "L4"
  | "L5"
  | "L6"
  | "L7"
  | "L8"
  | "L9"
  | "L10"
  | "L11"
  | "L12"
  | "L13"
  | "L14"
  | "L15";

/** Every layer, in order. */
export const LAYERS: readonly LayerName[] = [
  "L1",
  "L2",
  "L3",
  "L4",
  "L5",
  "L6",
  "L7",
  "L8",
  "L9",
  "L10",
  "L11",
  "L12",
  "L13",
  "L14",
  "L15",
];

/** What one test found at one layer. */
export type LayerOutcome =
  | { status: "pass" }
  | { status: "fail"; message: string }
  | { status: "skip"; reason: string }
  | { status: "quarantined"; issue: string };

/** The per-layer record of one harness test (DESIGN §4.5). */
export interface UfLayerMeta {
  /** The case, relative to the cases directory: `"basics/hello"`. */
  case: string;
  target: string;
  layers: Partial<Record<LayerName, LayerOutcome>>;
}

/**
 * A known failure that still runs (plan §7.7). The (case, target, layer) cell must still fail;
 * once it passes, the entry is stale and fails the run until someone removes it. A cell is fed
 * by every test that records the layer (L13 by the ssr and the browser test, L6 by each SSR
 * scenario), so staleness is decided for the cell, once a run has every record (see
 * `settleOutcome`), not for each test.
 */
export interface QuarantineEntry {
  case: string;
  target: string;
  layer: LayerName;
  reason: string;
  /** The tracking issue, such as a URL. */
  issue: string;
  /**
   * L10 only: the pixel mode whose comparisons fail, for a failure the other mode does not show
   * (the committed Linux baselines against the live reference capture). A run in the other mode
   * does not apply the entry, so it neither quarantines the cell nor goes stale there.
   */
  pixels?: PixelMode;
}

/** Which case and target a test verifies, and the quarantine that applies to it. */
export interface LayerSubject {
  case: string;
  target: string;
  quarantine?: readonly QuarantineEntry[];
}

/** A layer check returns this to skip the layer, with the reason the matrix shows. */
export interface LayerSkip {
  skip: string;
}

/** Verifies one layer: throws on failure, returns nothing on success or a skip. */
export type LayerCheck = () => void | LayerSkip | Promise<void | LayerSkip>;

/** The task a layer is recorded on: a Vitest test (`TestContext.task`, `getCurrentTest()`). */
export interface LayerTask {
  meta: { uf?: UfLayerMeta };
}

declare module "vitest" {
  interface TaskMeta {
    /** The per-layer outcomes of a harness test. */
    uf?: UfLayerMeta;
  }
}

/** Precedence when several records meet in one cell: a failure is never hidden by a pass. */
const PRECEDENCE: Record<LayerOutcome["status"], number> = {
  fail: 3,
  quarantined: 2,
  pass: 1,
  skip: 0,
};

/**
 * Merges outcomes for the same case, target and layer: fail beats everything, and a failure
 * keeps the message of every record that failed (each distinct one once, in order), so no
 * sub-check's evidence is lost (the canaries require each of them).
 */
export function mergeOutcomes(...outcomes: readonly LayerOutcome[]): LayerOutcome {
  const [first, ...rest] = outcomes;
  if (!first) throw new Error("mergeOutcomes needs at least one outcome.");
  const winner = rest.reduce(
    (best, outcome) => (PRECEDENCE[outcome.status] > PRECEDENCE[best.status] ? outcome : best),
    first,
  );
  if (winner.status !== "fail") return winner;
  const messages = new Set(
    outcomes.flatMap((outcome) => (outcome.status === "fail" ? [outcome.message] : [])),
  );
  return messages.size === 1 ? winner : { status: "fail", message: [...messages].join("\n") };
}

/** The quarantine entry for a case, target and layer, if any. */
export function quarantineFor(
  quarantine: readonly QuarantineEntry[] | undefined,
  subject: { case: string; target: string },
  layer: LayerName,
): QuarantineEntry | undefined {
  return quarantine?.find(
    (entry) =>
      entry.case === subject.case && entry.target === subject.target && entry.layer === layer,
  );
}

/**
 * Applies a quarantine entry to a cell: the merged outcome of every record of one (case, target,
 * layer) in a run that recorded them all. A cell that fails (or whose records were quarantined)
 * is quarantined; one that passes, or is skipped, is a stale entry and fails.
 */
export function settleOutcome(outcome: LayerOutcome, entry?: QuarantineEntry): LayerOutcome {
  if (!entry) return outcome;
  if (outcome.status === "fail") return { status: "quarantined", issue: entry.issue };
  if (outcome.status === "quarantined") return outcome;
  const what = outcome.status === "pass" ? "passes" : `is skipped (${outcome.reason})`;
  const pixels =
    entry.layer === "L10" && entry.pixels === undefined
      ? ` If only one pixel mode fails it, name that mode in the entry (pixels: "baseline" or "live").`
      : "";
  return {
    status: "fail",
    message: `stale quarantine entry: remove it. ${entry.case} › ${entry.target} › ${entry.layer} ${what} (quarantined for ${entry.issue}: ${entry.reason}).${pixels}`,
  };
}

/**
 * Records an outcome on a task and returns what was recorded. A failure the subject's quarantine
 * covers is recorded as quarantined and does not fail the test. A pass or a skip is recorded as
 * it is, even under an entry: one test cannot tell a stale entry from one another test of the
 * cell still needs, so the run decides (see `settleOutcome`). Several records for the same layer
 * merge (fail beats pass); a task records one case and target only.
 */
export function recordLayer(
  task: LayerTask,
  subject: LayerSubject,
  layer: LayerName,
  outcome: LayerOutcome,
): LayerOutcome {
  if (outcome.status === "skip" && !isSkipReason(outcome.reason)) {
    throw new TypeError(
      `${subject.case} › ${subject.target} › ${layer}: a skip needs a reason, not ${JSON.stringify(outcome.reason)}.`,
    );
  }
  const entry = quarantineFor(subject.quarantine, subject, layer);
  const settled: LayerOutcome =
    entry && outcome.status === "fail" ? { status: "quarantined", issue: entry.issue } : outcome;
  const meta = (task.meta.uf ??= { case: subject.case, target: subject.target, layers: {} });
  if (meta.case !== subject.case || meta.target !== subject.target) {
    throw new Error(
      `A test records one case and target: it recorded ${meta.case} › ${meta.target}, then ${subject.case} › ${subject.target}.`,
    );
  }
  const previous = meta.layers[layer];
  meta.layers[layer] = previous ? mergeOutcomes(previous, settled) : settled;
  return settled;
}

/** The messages of every failed layer a task recorded, in layer order. */
export function layerFailures(task: LayerTask): string[] {
  const layers = task.meta.uf?.layers ?? {};
  return LAYERS.flatMap((layer) => {
    const outcome = layers[layer];
    return outcome?.status === "fail" ? [`${layer}: ${outcome.message}`] : [];
  });
}

/** A skip reason the matrix can show: a non-blank string. */
function isSkipReason(reason: unknown): reason is string {
  return typeof reason === "string" && reason.trim() !== "";
}

/** A check's return value as an outcome: nothing passes, `{ skip: reason }` skips. */
function outcomeOfResult(result: unknown): LayerOutcome {
  if (result === undefined) return { status: "pass" };
  if (typeof result === "object" && result !== null && "skip" in result) {
    if (isSkipReason(result.skip)) return { status: "skip", reason: result.skip };
  }
  return {
    status: "fail",
    message: `The check returned ${JSON.stringify(result)}: return nothing to pass, or { skip: reason } with a reason to skip.`,
  };
}

/**
 * Runs layer checks in order, records each outcome on the task, and then throws one error with
 * every failure, so a test reports all the layers it broke rather than the first. A check fails
 * by throwing, and skips by returning `{ skip: reason }` with a non-blank reason; any other
 * return value is a failure, never a silent skip.
 */
export async function checkLayers(
  task: LayerTask,
  subject: LayerSubject,
  checks: Partial<Record<LayerName, LayerCheck>>,
): Promise<void> {
  const failures: string[] = [];
  for (const layer of LAYERS) {
    const check = checks[layer];
    if (!check) continue;
    let outcome: LayerOutcome;
    try {
      outcome = outcomeOfResult(await check());
    } catch (error) {
      outcome = { status: "fail", message: formatError(error) };
    }
    const recorded = recordLayer(task, subject, layer, outcome);
    if (recorded.status === "fail") failures.push(`${layer}: ${recorded.message}`);
  }
  if (failures.length) {
    throw new LayerFailure(subject, failures);
  }
}

/** The error a test fails with when one or more layers failed. */
export class LayerFailure extends Error {
  override name = "LayerFailure";
  readonly failures: readonly string[];

  constructor(subject: { case: string; target: string }, failures: readonly string[]) {
    super(
      `${subject.case} › ${subject.target}: ${failures.length} layer(s) failed\n\n${failures.join("\n\n")}`,
    );
    this.failures = failures;
  }
}
