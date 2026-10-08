// The summary (plan §7.4): merges partial matrices into `parity-matrix.json` and
// `parity-matrix.md` (appended to $GITHUB_STEP_SUMMARY in CI), and reports what is wrong: every
// failed cell, every stale quarantine entry and, when every project ran all its tests (or must
// have), every missing or partly run project, every missing (case, target, live layer) cell and
// every target whose parity scenarios of a case differ from the reference's.
import { appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  LAYERS,
  NO_INTERACTION_SKIP,
  NO_OUTPUT_SKIP,
  NO_OUTPUT_TEST_SKIP,
  NOT_RENDERED_SKIP,
  REQUIRES_SKIP,
} from "../layers.ts";
import type { LayerName } from "../layers.ts";
import { LIVE_REFERENCE_SKIP } from "../visual-types.ts";
import {
  cellHeadline,
  mergeMatrices,
  narrowing,
  outcomeOfCell,
  settleQuarantine,
  stringifyMatrix,
} from "./matrix.ts";
import type { MergedMatrix, PartialMatrix, RunInfo } from "./matrix.ts";
import { isCI } from "./mode.ts";
import { readPartialMatrices } from "./reporter.ts";

/** What a complete run covers. */
export interface SummaryExpectations {
  /** Every project the config defines (for the selected targets). */
  projects: readonly string[];
  /** Every case id in the corpus. */
  cases: readonly string[];
  targets: readonly string[];
  /** The layers live in this milestone: each needs a cell for every case and target. */
  liveLayers: readonly LayerName[];
  /** The skip reason recorded for the layers that are not live yet. */
  notLiveReason: string;
  /**
   * Every capability name: a skip by capability on a live layer (`requires <name>: …`) must
   * name one. Without it, any kebab-case name passes.
   */
  capabilities?: readonly string[];
}

/**
 * The skips a live layer may record besides one by capability (plan §7.7, ADR-0050): each has a
 * mechanical cause. Anything else on a live layer would hide a check that never ran.
 */
const MECHANICAL_SKIPS: readonly string[] = [
  NO_OUTPUT_SKIP,
  LIVE_REFERENCE_SKIP,
  NOT_RENDERED_SKIP,
  NO_INTERACTION_SKIP,
];

/** Why a live layer's skip is not one the summary accepts, or nothing when it is. */
export function unacceptedSkip(
  reason: string,
  capabilities?: readonly string[],
): string | undefined {
  // A browser test of a case its target has no output for: the errors that case expects.
  if (MECHANICAL_SKIPS.includes(reason) || NO_OUTPUT_TEST_SKIP.test(reason)) return undefined;
  const capability = REQUIRES_SKIP.exec(reason)?.[1];
  if (capability === undefined) {
    return `skipped (${reason}), which names no capability its target lacks and none of the mechanical causes (${[...MECHANICAL_SKIPS, "no output: <the expected errors>"].join("; ")}): a live layer skips only for a reason the matrix can show.`;
  }
  if (capabilities && !capabilities.includes(capability)) {
    return `skipped for "${capability}", which is not a capability.`;
  }
  return undefined;
}

/** How to judge the merged matrix. */
export interface SummaryJudgement {
  /**
   * Every expected project must have run all its tests: a missing one, one that only a filtered
   * run covered, and each missing cell, is a problem rather than a partial run. For CI, whose
   * parity job merges one partial matrix per job: a job that never reported is a hole, not a
   * subset someone chose. `writeSummary` defaults it to whether `CI` is set.
   */
  requireComplete?: boolean | undefined;
}

/** Options for {@link writeSummary}. */
export interface SummaryOptions extends SummaryJudgement {
  reportsDir: string;
  expected: SummaryExpectations;
  /** `$GITHUB_STEP_SUMMARY`: the Markdown is appended there too. */
  stepSummary?: string | undefined;
  /**
   * Only the partial matrices of runs that ended at or after this time: a local `pnpm test`
   * summarises its own run, not an earlier one's leftovers. None is an error: the run wrote no
   * matrix.
   */
  since?: Date | undefined;
}

/** What {@link writeSummary} produced. */
export interface SummaryResult {
  matrix: MergedMatrix;
  markdown: string;
  /** Everything that makes the run not green; empty when it is. */
  problems: string[];
  /**
   * Whether every expected project ran all its tests (in a run without a file, test-name or
   * other filter, or in every shard of one), so completeness and stale quarantine entries were
   * checked.
   */
  complete: boolean;
}

/** Which expected projects the merged runs do not cover in full. */
export interface Coverage {
  /** No run has records of them. */
  missingProjects: readonly string[];
  /** Only filtered runs ran them: project → why each such run was filtered. */
  partialProjects: ReadonlyMap<string, readonly string[]>;
  /**
   * Every shard ran them, and none collected a test of them. An unfiltered run fails on such a
   * project itself; one shard cannot tell, as it may hold none of the project's files.
   */
  emptyProjects: readonly string[];
}

/** Merges the partial matrices in `reportsDir`, writes the merged matrix and its Markdown. */
export function writeSummary(options: SummaryOptions): SummaryResult {
  const since = options.since;
  const partials = [...readPartialMatrices(options.reportsDir).values()].filter(
    (partial) => since === undefined || Date.parse(partial.finishedAt) >= since.getTime(),
  );
  if (!partials.length) {
    throw new Error(
      since === undefined
        ? `[uf:summary] No parity-matrix.*.json in ${options.reportsDir}: run the integration tests first.`
        : `[uf:summary] No run wrote a parity matrix to ${options.reportsDir} since ${since.toISOString()}: the run did not get as far as reporting.`,
    );
  }
  const result = summarise(partials, options.expected, {
    requireComplete: options.requireComplete ?? isCI(process.env),
  });
  writeFileSync(join(options.reportsDir, "parity-matrix.json"), stringifyMatrix(result.matrix));
  writeFileSync(join(options.reportsDir, "parity-matrix.md"), result.markdown);
  if (options.stepSummary) appendFileSync(options.stepSummary, `${result.markdown}\n`);
  return result;
}

/** Merges matrices, fills the layers that are not live, and lists the problems. Pure. */
export function summarise(
  partials: readonly PartialMatrix[],
  expected: SummaryExpectations,
  judgement: SummaryJudgement = {},
): SummaryResult {
  const { matrix: merged, quarantine, reference } = mergeMatrices(partials);
  const coverage = coverageOf(merged, expected.projects);
  const { missingProjects, partialProjects } = coverage;
  const complete = missingProjects.length === 0 && partialProjects.size === 0;
  const checkMissing = complete || Boolean(judgement.requireComplete);
  const problems: string[] = [];
  const live = new Set(expected.liveLayers);
  const knownCases = new Set(expected.cases);

  for (const project of coverage.emptyProjects) {
    problems.push(
      `${project}: collected zero tests in every shard. A project that runs nothing verifies nothing.`,
    );
  }
  if (judgement.requireComplete) {
    for (const project of missingProjects) {
      problems.push(`${project}: did not run (no parity matrix has its records).`);
    }
    for (const [project, filters] of partialProjects) {
      problems.push(
        `${project}: only filtered runs ran it (${filters.join("; ")}), so not every cell is checked.`,
      );
    }
  }
  // The failures are judged by the newest run's quarantine; staleness only when every record of
  // every cell is here (the failed cells it makes are listed below, with the others).
  settleQuarantine(merged.cases, quarantine, { stale: complete });

  for (const caseId of Object.keys(merged.cases)) {
    if (!knownCases.has(caseId))
      problems.push(`${caseId}: recorded, but not a case in the corpus.`);
  }
  for (const caseId of [...expected.cases].sort()) {
    const targets = (merged.cases[caseId] ??= {});
    for (const target of expected.targets) {
      const cells = (targets[target] ??= {});
      for (const layer of LAYERS) {
        const cell = cells[layer];
        if (cell === undefined) {
          if (!live.has(layer)) cells[layer] = `skip(${expected.notLiveReason})`;
          else if (checkMissing)
            problems.push(`${caseId} › ${target} › ${layer}: missing (no test recorded it).`);
          continue;
        }
        // A skip on a live layer names a capability the target lacks or a mechanical cause
        // (plan §7.7); a quarantined cell is not a skip. They are listed under each table.
        const outcome = outcomeOfCell(cell);
        if (outcome.status === "fail")
          problems.push(`${caseId} › ${target} › ${layer}: ${cellHeadline(cell)}`);
        if (outcome.status === "skip" && live.has(layer)) {
          const why = unacceptedSkip(outcome.reason, expected.capabilities);
          if (why) problems.push(`${caseId} › ${target} › ${layer}: ${why}`);
        }
      }
      targets[target] = Object.fromEntries(
        LAYERS.filter((layer) => cells[layer] !== undefined).map((layer) => [layer, cells[layer]!]),
      );
    }
    if (checkMissing && reference !== null) {
      problems.push(...scenarioProblems(merged, caseId, reference, expected.targets));
    }
  }
  const matrix: MergedMatrix = {
    ...merged,
    cases: Object.fromEntries(Object.entries(merged.cases).sort(([a], [b]) => a.localeCompare(b))),
  };
  return {
    matrix,
    markdown: renderMarkdown(matrix, expected, {
      ...coverage,
      problems,
      requireComplete: Boolean(judgement.requireComplete),
      quarantined: quarantine.length,
    }),
    problems,
    complete,
  };
}

/**
 * The targets whose parity scenarios of a case differ from the reference's, test by test. Every
 * target runs the same spec, and a cell merges every test of its case, so a scenario one target
 * leaves out (a spec that branches on the target, a test that stops early) shows in no cell.
 * A test a target skipped (by capability, or because the target has no output for the case) is
 * excused on that target, and only that test: its scenarios are the ones it would have checked
 * (ADR-0050). Judged like the missing cells, once every project ran all its tests: a filtered
 * run checks only some scenarios.
 */
function scenarioProblems(
  matrix: MergedMatrix,
  caseId: string,
  reference: string,
  targets: readonly string[],
): string[] {
  if (!targets.includes(reference)) return [];
  const expected = matrix.tests[caseId]?.[reference] ?? {};
  const problems: string[] = [];
  for (const target of targets) {
    if (target === reference) continue;
    const actual = matrix.tests[caseId]?.[target] ?? {};
    const differences: string[] = [];
    for (const name of [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort()) {
      const theirs = expected[name];
      const ours = actual[name];
      if (ours?.skipped !== undefined) continue;
      const wanted = theirs?.skipped === undefined ? (theirs?.scenarios ?? []) : [];
      const checked = ours?.scenarios ?? [];
      const missing = wanted.filter((scenario) => !checked.includes(scenario));
      const extra = checked.filter((scenario) => !wanted.includes(scenario));
      if (missing.length) differences.push(`"${name}" never checks ${missing.join(", ")}`);
      if (extra.length) {
        const why =
          theirs?.skipped === undefined ? "" : ` (it skipped the test: ${theirs.skipped})`;
        differences.push(
          `"${name}" checks ${extra.join(", ")}, which ${reference} never checks${why}`,
        );
      }
    }
    if (!differences.length) continue;
    problems.push(
      `${caseId} › ${target}: its parity scenarios differ from ${reference}'s: ${differences.join("; ")}. Every target runs the same spec, so every target checks the same scenarios, unless it skips a test by capability or has no output for the case.`,
    );
  }
  return problems;
}

/**
 * Which expected projects the merged runs cover only in part. A filtered run (files, test
 * names, a shard, `--changed`) lists every project it selected but records only the tests it
 * ran: it covers no project in full, so its missing cells say nothing. Shards add up, though:
 * shards 1 to n of one selection, with no other filter, ran every test of its projects.
 */
export function coverageOf(merged: MergedMatrix, projects: readonly string[]): Coverage {
  const ran = new Set(merged.projects);
  const unfiltered = new Set(
    merged.runs.filter((run) => narrowing(run) === null).flatMap((run) => run.projects),
  );
  const sets = shardSets(merged.runs);
  const partialProjects = new Map<string, string[]>();
  const emptyProjects: string[] = [];
  for (const project of projects) {
    if (!ran.has(project) || unfiltered.has(project)) continue;
    const ofProject = sets.filter((set) => set.projects.includes(project));
    const complete = ofProject.filter((set) => !set.missing.length);
    if (complete.length) {
      if (complete.every((set) => set.runs.every((run) => run.empty.includes(project)))) {
        emptyProjects.push(project);
      }
      continue;
    }
    const reasons = [
      // The runs a filter narrowed, sharded or not, each with why.
      ...merged.runs.flatMap((run) => {
        const why = narrowing(run);
        return run.filtered !== null && why !== null && run.projects.includes(project) ? [why] : [];
      }),
      ...ofProject.map(
        (set) => `${shardList(set.ran, set.count)} without ${shardList(set.missing, set.count)}`,
      ),
    ];
    partialProjects.set(project, [...new Set(reasons)]);
  }
  return {
    missingProjects: projects.filter((project) => !ran.has(project)),
    partialProjects,
    emptyProjects,
  };
}

/** The shards of one selection of projects into one number of parts. */
interface ShardSet {
  projects: readonly string[];
  count: number;
  runs: readonly RunInfo[];
  /** The indices of the shards that ran, ascending. */
  ran: readonly number[];
  /** The indices of the shards that did not. */
  missing: readonly number[];
}

/**
 * The runs narrowed by nothing but a shard, grouped by selection and count. Vitest orders the
 * test files of every selected project together and cuts them into `count` parts, so only the
 * parts of one selection and one count make up a whole; any other shard says nothing about them.
 */
function shardSets(runs: readonly RunInfo[]): ShardSet[] {
  const groups = new Map<
    string,
    { projects: string[]; count: number; runs: RunInfo[]; indices: Set<number> }
  >();
  for (const run of runs) {
    if (run.shard === null || run.filtered !== null) continue;
    const key = JSON.stringify([run.shard.count, run.projects.toSorted()]);
    const group = groups.get(key) ?? {
      projects: run.projects,
      count: run.shard.count,
      runs: [],
      indices: new Set<number>(),
    };
    group.runs.push(run);
    group.indices.add(run.shard.index);
    groups.set(key, group);
  }
  return [...groups.values()].map(({ indices, ...group }) => {
    const all = Array.from({ length: group.count }, (_, index) => index + 1);
    return {
      ...group,
      ran: all.filter((index) => indices.has(index)),
      missing: all.filter((index) => !indices.has(index)),
    };
  });
}

/** Shards by index, such as `shard 1/3, shard 3/3`. */
function shardList(indices: readonly number[], count: number): string {
  return indices.map((index) => `shard ${index}/${count}`).join(", ");
}

/** The matrix for people: where it came from, one table per case, then the problems. */
export function renderMarkdown(
  matrix: MergedMatrix,
  expected: SummaryExpectations,
  status: Coverage & {
    problems: readonly string[];
    requireComplete: boolean;
    /** How many quarantine entries the newest run applied, which judged every record. */
    quarantined: number;
  },
): string {
  const layers = LAYERS.filter((layer) => expected.liveLayers.includes(layer));
  const { missingProjects, partialProjects, problems } = status;
  // The projects a filter narrowed, grouped by the filter: usually one run narrowed them all.
  const narrowed = new Map<string, string[]>();
  for (const [project, filters] of partialProjects) {
    const filter = filters.join("; ");
    narrowed.set(filter, [...(narrowed.get(filter) ?? []), project]);
  }
  const gaps = [
    ...(missingProjects.length
      ? [`${missingProjects.length} project(s) did not run (${missingProjects.join(", ")})`]
      : []),
    ...[...narrowed].map(([filter, projects]) =>
      projects.length === expected.projects.length
        ? `every project ran only in part (${filter})`
        : `${projects.length} project(s) ran only in part (${filter}: ${projects.join(", ")})`,
    ),
  ];
  const lines = [
    "## Unframework parity matrix",
    "",
    `${Object.keys(matrix.cases).length} case(s) × ${expected.targets.length} target(s) × ${layers.length} live layer(s), from ${matrix.projects.length} project(s).`,
    gaps.length
      ? status.requireComplete
        ? `Incomplete: ${gaps.join(", and ")}, and every project must run all its tests.`
        : `Partial run: ${gaps.join(", and ")}, so missing cells and stale quarantine entries are not checked.`
      : matrix.runs.length > 1
        ? `Every project has records, from ${matrix.runs.length} runs: every cell is checked, each against the last run of its project.`
        : "Every project ran: every cell is checked.",
    `Layers that are not live (${LAYERS.filter((layer) => !layers.includes(layer)).join(", ")}) are recorded as skip(${expected.notLiveReason}).`,
    "",
    `Merged from ${matrix.runs.length} run(s), oldest first; a project's newer records replace its older ones:`,
    "",
    ...matrix.runs.map((run) => `- ${describeRun(run)}`),
    "",
  ];
  if (matrix.runs.some((run) => run.mode?.update)) {
    lines.push(
      "An update run wrote the shared artefacts: the reference target's cells from it pass because it wrote them, not because it compared them.",
      "",
    );
  }
  if (status.quarantined) {
    const one = status.quarantined === 1;
    const entries = one ? "The quarantine entry" : `The ${status.quarantined} quarantine entries`;
    const unchecked = `, but ${one ? "is" : "are"} not checked for staleness: not every project ran all its tests`;
    lines.push(
      `${entries} of the newest run ${one ? "judges" : "judge"} every record${gaps.length ? unchecked : ""}.`,
      "",
    );
  }
  for (const [caseId, targets] of Object.entries(matrix.cases)) {
    lines.push(
      `### ${caseId}`,
      "",
      `| Target | ${layers.join(" | ")} |`,
      `| --- | ${layers.map(() => "---").join(" | ")} |`,
    );
    // Why cells are skipped or quarantined, once per reason, under the table.
    const notes = new Map<string, { layers: Set<string>; targets: Set<string> }>();
    for (const target of expected.targets) {
      const cells = targets[target] ?? {};
      lines.push(`| ${target} | ${layers.map((layer) => short(cells[layer])).join(" | ")} |`);
      for (const layer of layers) {
        const cell = cells[layer];
        const outcome = cell === undefined ? undefined : outcomeOfCell(cell);
        if (outcome?.status !== "skip" && outcome?.status !== "quarantined") continue;
        const note =
          outcome.status === "skip"
            ? `skipped: ${outcome.reason}`
            : `quarantined: ${outcome.issue}`;
        const entry = notes.get(note) ?? { layers: new Set<string>(), targets: new Set<string>() };
        entry.layers.add(layer);
        entry.targets.add(target);
        notes.set(note, entry);
      }
    }
    lines.push("");
    for (const [note, where] of notes) {
      const on =
        where.targets.size === expected.targets.length
          ? "every target"
          : [...where.targets].join(", ");
      lines.push(`- ${escapeCell(note)}: ${[...where.layers].join(", ")} on ${on}.`);
    }
    // The tests skipped by capability or for want of output, which a cell that another test of
    // the case passes hides.
    const skipped = expected.targets.flatMap((target) =>
      Object.entries(matrix.tests[caseId]?.[target] ?? {}).flatMap(([name, test]) =>
        test.skipped === undefined
          ? []
          : [
              `- skipped on ${target} ${NO_OUTPUT_TEST_SKIP.test(test.skipped) ? "for want of output" : "by capability"}: "${escapeCell(name)}" (${escapeCell(test.skipped)}).`,
            ],
      ),
    );
    lines.push(...skipped);
    if (notes.size || skipped.length) lines.push("");
  }
  lines.push(problems.length ? `### Problems (${problems.length})` : "### No problems", "");
  for (const problem of problems) lines.push(`- ${escapeCell(problem)}`);
  return `${lines.join("\n").trimEnd()}\n`;
}

/** A run, for the provenance list: its name, mode, filter and when it ended. */
function describeRun(run: RunInfo): string {
  const how = run.mode
    ? [
        run.mode.update ? "update" : "check",
        `${run.mode.pixels} pixels`,
        ...(run.mode.canary ? [`canary ${run.mode.canary}`] : []),
      ].join(", ")
    : "outside the harness";
  const narrowed = narrowing(run);
  const only = narrowed === null ? "" : `; only ${narrowed}`;
  return `\`${run.run}\` (${how}${only}), ended ${run.finishedAt}: ${run.projects.join(", ")}`;
}

/** A cell in a table: the status only; reasons are listed under the table. */
function short(cell: string | undefined): string {
  if (cell === undefined) return "**missing**";
  const { status } = outcomeOfCell(cell);
  return status === "fail" ? "**FAIL**" : status;
}

function escapeCell(text: string): string {
  return text.replaceAll("|", "\\|");
}
