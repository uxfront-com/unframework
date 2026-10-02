import type { PixelMode } from "../harness.ts";
// The parity matrix (DESIGN §4.6): for every case, target and layer, one cell of `pass`,
// `fail: …`, `skip(reason)` or `quarantined(issue)`. Each run writes a partial matrix that keeps
// its records per project, with when and how it ran; partial matrices are merged project by
// project (the newest record of a cell wins), then across projects (fail beats pass), and
// rendered for people.
import { LAYERS, mergeOutcomes, quarantineFor, settleOutcome } from "../layers.ts";
import type { LayerName, LayerOutcome, QuarantineEntry, UfLayerMeta } from "../layers.ts";

/** Case → target → layer → cell. */
export type MatrixCells = Record<string, Record<string, Partial<Record<LayerName, string>>>>;

/** The version of the matrix files; a file of another version is never merged. */
export const MATRIX_VERSION = 3;

/** One run's (or a merged) parity matrix. */
export interface ParityMatrix {
  version: typeof MATRIX_VERSION;
  /** The run that wrote it: `all`, a project list, or `merged`. */
  run: string;
  /** The projects whose tests fed the matrix, sorted. */
  projects: string[];
  /** Case → target → layer → cell, merged across projects. */
  cases: MatrixCells;
}

/** How a run treated artefacts (the harness mode), for the reader of a matrix. */
export interface RunMode {
  update: boolean;
  pixels: PixelMode;
  canary: string | null;
}

/**
 * One part of a sharded run (`--shard <index>/<count>`): Vitest splits the test files of the
 * selected projects into `count` parts and runs part `index` (from 1).
 */
export interface Shard {
  index: number;
  count: number;
}

/** When and how a partial matrix's run ran. */
export interface RunInfo {
  run: string;
  /** When the run ended (ISO 8601). Of two records of one project's cell, the newer counts. */
  finishedAt: string;
  /** The harness mode, or `null` for a run outside the harness. */
  mode: RunMode | null;
  /**
   * Why the run covered only part of its projects' tests besides a shard (a file, test-name,
   * tags or changed-files filter, or watch mode), or `null` when nothing else narrowed it.
   */
  filtered: string | null;
  /**
   * The run's shard, or `null`. Kept apart from `filtered` because shards add up: shards 1 to
   * `count` of one selection, with no other filter, ran every test of its projects.
   */
  shard: Shard | null;
  projects: string[];
  /**
   * The selected projects that collected no tests. A run nothing narrowed fails on one itself;
   * a shard may hold none of a project's files, so the summary judges them once every shard ran.
   */
  empty: string[];
}

/** Why a run covered only part of its projects' tests, its shard included, or `null`. */
export function narrowing(run: Pick<RunInfo, "filtered" | "shard">): string | null {
  const reasons = [
    ...(run.filtered === null ? [] : [run.filtered]),
    ...(run.shard === null ? [] : [`shard ${run.shard.index}/${run.shard.count}`]),
  ];
  return reasons.length ? reasons.join("; ") : null;
}

/** What one Vitest run writes: `parity-matrix.<run>.json`. */
export interface PartialMatrix extends ParityMatrix, RunInfo {
  /**
   * The quarantine the run applied. A merge judges every record by the newest run's, the one
   * `harness/quarantine.ts` held last.
   */
  quarantine: QuarantineEntry[];
  /** Project → its own cells, so a later run of a project replaces exactly its cells. */
  byProject: Record<string, MatrixCells>;
}

/** A merge of partial matrices (`parity-matrix.json`), with what it was merged from. */
export interface MergedMatrix extends ParityMatrix {
  /** The partial matrices merged, oldest first. */
  runs: RunInfo[];
}

/** A test's record and the project it ran in. */
export interface ProjectRecord {
  project: string;
  record: UfLayerMeta;
}

/**
 * An outcome as a matrix cell. A failure keeps its whole message, every sub-check's included
 * (both the DOM and the ARIA diff of L7, the server's and the page's console of L13), so a
 * canary can require the evidence of each.
 */
export function cellOf(outcome: LayerOutcome): string {
  if (outcome.status === "skip") return `skip(${outcome.reason})`;
  if (outcome.status === "quarantined") return `quarantined(${outcome.issue})`;
  if (outcome.status === "pass") return "pass";
  return `fail: ${outcome.message.trim() || "failed"}`;
}

/** A matrix cell as an outcome. Throws on text that is not a cell, so a corrupt matrix is loud. */
export function outcomeOfCell(cell: string): LayerOutcome {
  if (cell === "pass") return { status: "pass" };
  if (cell.startsWith("fail: ")) return { status: "fail", message: cell.slice("fail: ".length) };
  const match = /^(skip|quarantined)\((.*)\)$/s.exec(cell);
  if (match?.[1] === "skip") return { status: "skip", reason: match[2]! };
  if (match?.[1] === "quarantined") return { status: "quarantined", issue: match[2]! };
  throw new Error(`Not a parity matrix cell: ${JSON.stringify(cell)}`);
}

/** The first line of a cell, for a one-line summary; the matrix file has the rest. */
export function cellHeadline(cell: string): string {
  const lines = cell.split("\n");
  const more = lines.length - 1;
  return more ? `${lines[0]} (+${more} more line(s))` : cell;
}

/** Builds cells from test records, merging every record of a cell (fail beats pass). */
export function buildCells(records: readonly UfLayerMeta[]): MatrixCells {
  const outcomes = new Map<string, Map<string, Map<LayerName, LayerOutcome[]>>>();
  for (const record of records) {
    let targets = outcomes.get(record.case);
    if (!targets) outcomes.set(record.case, (targets = new Map()));
    let layers = targets.get(record.target);
    if (!layers) targets.set(record.target, (layers = new Map()));
    for (const layer of LAYERS) {
      const outcome = record.layers[layer];
      if (outcome) layers.set(layer, [...(layers.get(layer) ?? []), outcome]);
    }
  }
  const cells: MatrixCells = {};
  for (const caseId of [...outcomes.keys()].sort()) {
    const targets = outcomes.get(caseId)!;
    cells[caseId] = {};
    for (const target of [...targets.keys()].sort()) {
      const layers = targets.get(target)!;
      cells[caseId][target] = Object.fromEntries(
        LAYERS.filter((layer) => layers.has(layer)).map((layer) => [
          layer,
          cellOf(mergeOutcomes(...layers.get(layer)!)),
        ]),
      );
    }
  }
  return cells;
}

/** Merges several projects' cells into one set, cell by cell (fail beats pass). */
export function mergeCells(sets: readonly MatrixCells[]): MatrixCells {
  return buildCells(
    sets.flatMap((cells) =>
      Object.entries(cells).flatMap(([caseId, targets]) =>
        Object.entries(targets).map(([target, layers]) => ({
          case: caseId,
          target,
          layers: Object.fromEntries(
            Object.entries(layers).map(([layer, cell]) => [layer, outcomeOfCell(cell)]),
          ),
        })),
      ),
    ),
  );
}

/** Builds a run's partial matrix from its test records. */
export function buildPartialMatrix(input: {
  run: string;
  /** Every project the run selected, also those that recorded nothing. */
  projects: readonly string[];
  records: readonly ProjectRecord[];
  finishedAt: string;
  mode: RunMode | null;
  filtered: string | null;
  shard: Shard | null;
  /** The selected projects that collected no tests. */
  empty: readonly string[];
  quarantine: readonly QuarantineEntry[];
}): PartialMatrix {
  const projects = [...new Set(input.projects)].sort();
  const byProject: Record<string, MatrixCells> = {};
  for (const project of projects) {
    byProject[project] = buildCells(
      input.records.filter((entry) => entry.project === project).map((entry) => entry.record),
    );
  }
  return {
    version: MATRIX_VERSION,
    run: input.run,
    finishedAt: input.finishedAt,
    mode: input.mode,
    filtered: input.filtered,
    shard: input.shard,
    projects,
    empty: [...new Set(input.empty)].sort(),
    quarantine: [...input.quarantine],
    cases: mergeCells(Object.values(byProject)),
    byProject,
  };
}

/** A partial matrix without some projects' records (a newer run has them), or none if empty. */
export function withoutProjects(
  matrix: PartialMatrix,
  projects: ReadonlySet<string>,
): PartialMatrix | undefined {
  const kept = matrix.projects.filter((project) => !projects.has(project));
  if (kept.length === matrix.projects.length) return matrix;
  if (!kept.length) return undefined;
  const byProject = Object.fromEntries(
    kept.map((project) => [project, matrix.byProject[project] ?? {}]),
  );
  return {
    ...matrix,
    projects: kept,
    empty: matrix.empty.filter((project) => !projects.has(project)),
    byProject,
    cases: mergeCells(Object.values(byProject)),
  };
}

/**
 * Merges partial matrices (CI's jobs, local runs of a subset) into one. For each project the
 * newest record of each cell wins, so a re-run replaces what an earlier run recorded; then the
 * projects merge cell by cell (fail beats pass). The quarantine is the newest run's: an entry
 * removed since an older run must neither hide that run's failures nor go stale.
 */
export function mergeMatrices(partials: readonly PartialMatrix[]): {
  matrix: MergedMatrix;
  quarantine: QuarantineEntry[];
} {
  for (const partial of partials) {
    if (partial.version !== MATRIX_VERSION) {
      throw new Error(
        `Unsupported parity matrix version ${String(partial.version)} (run ${partial.run}): rerun the tests to replace it.`,
      );
    }
  }
  const ordered = [...partials].sort(
    (a, b) => a.finishedAt.localeCompare(b.finishedAt) || a.run.localeCompare(b.run),
  );
  const latest = new Map<string, MatrixCells>();
  for (const partial of ordered) {
    for (const [project, cells] of Object.entries(partial.byProject)) {
      const merged = latest.get(project) ?? {};
      for (const [caseId, targets] of Object.entries(cells)) {
        for (const [target, layers] of Object.entries(targets)) {
          Object.assign(((merged[caseId] ??= {})[target] ??= {}), layers);
        }
      }
      latest.set(project, merged);
    }
  }
  return {
    matrix: {
      version: MATRIX_VERSION,
      run: "merged",
      projects: [...new Set(ordered.flatMap((partial) => partial.projects))].sort(),
      cases: mergeCells([...latest.values()]),
      runs: ordered.map(({ run, finishedAt, mode, filtered, shard, projects, empty }) => ({
        run,
        finishedAt,
        mode,
        filtered,
        shard,
        projects,
        empty,
      })),
    },
    quarantine: [...(ordered.at(-1)?.quarantine ?? [])],
  };
}

/**
 * Judges cells by a quarantine, which may be newer than the runs that recorded them (see
 * `mergeMatrices`): a failure under an entry is quarantined, and a cell an older run recorded as
 * quarantined, under an entry since removed, fails (its message is not recorded: rerun its
 * project to see it). With `stale`, for cells every record has reached (a complete run, or a
 * merge of complete runs), a cell under an entry that passes, or is skipped, becomes a
 * stale-entry failure (plan §7.7). Returns the failures it made.
 */
export function settleQuarantine(
  cells: MatrixCells,
  quarantine: readonly QuarantineEntry[],
  options: { stale: boolean },
): string[] {
  const problems: string[] = [];
  for (const [caseId, targets] of Object.entries(cells)) {
    for (const [target, layers] of Object.entries(targets)) {
      for (const layer of LAYERS) {
        const cell = layers[layer];
        if (cell === undefined) continue;
        const outcome = outcomeOfCell(cell);
        const entry = quarantineFor(quarantine, { case: caseId, target }, layer);
        let settled: LayerOutcome;
        if (!entry) {
          if (outcome.status !== "quarantined") continue;
          settled = {
            status: "fail",
            message: `quarantined for ${outcome.issue} by an older run, but no entry quarantines ${caseId} › ${target} › ${layer} any more: rerun its project to see the failure.`,
          };
        } else if (outcome.status === "fail" || options.stale) {
          settled = settleOutcome(outcome, entry);
        } else {
          continue;
        }
        layers[layer] = cellOf(settled);
        if (settled.status === "fail") problems.push(settled.message);
      }
    }
  }
  return problems;
}

/** Serialises a matrix with a trailing newline; equal matrices are equal bytes. */
export function stringifyMatrix(matrix: ParityMatrix): string {
  return `${JSON.stringify(matrix, null, 2)}\n`;
}
