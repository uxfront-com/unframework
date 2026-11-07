// The parity reporter (plan §7.4): collects every test's `meta.uf`, and each test file's (what
// a file records after its last test: setup.ts's late console check), writes this run's partial
// matrix to `<reportsDir>/parity-matrix.<run>.json`, and fails the run loudly (plan §7.7) when:
// - a selected project collected no tests: a project that silently runs nothing is never green;
// - a test was skipped without recording why;
// - two tests of a case share a name, so the summary could not tell them apart;
// - a quarantine entry is stale, once the run has every record of its cell.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { BROWSER_ENGINES, caseOfFile } from "../harness.ts";
import type { HarnessContext } from "../harness.ts";
import type { UfLayerMeta } from "../layers.ts";
import {
  buildPartialMatrix,
  MATRIX_VERSION,
  narrowing,
  settleQuarantine,
  stringifyMatrix,
  withoutProjects,
} from "./matrix.ts";
import type { PartialMatrix, ProjectRecord, ProjectScope, Shard } from "./matrix.ts";

/** The part of a Vitest test case the reporter reads. */
interface ReportedTest {
  project: { name: string };
  fullName: string;
  meta(): { uf?: UfLayerMeta };
  result(): { state: "passed" | "failed" | "skipped" | "pending" };
}

/** The part of a Vitest test module the reporter reads. */
interface ReportedModule {
  project: { name: string };
  meta(): { uf?: UfLayerMeta };
  children: { allTests(): Iterable<ReportedTest> };
}

/** The part of a Vitest project the reporter reads. */
interface ReportedProject {
  name: string;
  config: { root: string; include: string[] };
  getProvidedContext(): { ufHarness?: HarnessContext; ufOnly?: string[] };
}

/** The part of the Vitest instance the reporter reads. */
interface ReportedVitest {
  projects: readonly ReportedProject[];
  config: {
    testNamePattern?: RegExp | undefined;
    shard?: { index: number; count: number } | undefined;
    watch?: boolean;
    /** `--changed [since]`. */
    changed?: boolean | string | undefined;
    /** `vitest related <files>`, and the files `--changed` found. */
    related?: readonly string[] | undefined;
    /** `--tags-filter`. */
    tagsFilter?: readonly string[] | undefined;
  };
  logger: { log(...messages: unknown[]): void; error(...messages: unknown[]): void };
  /** Internal: the CLI's file filters. */
  filenamePattern?: readonly string[] | undefined;
}

/** Options for {@link ParityReporter}. */
export interface ParityReporterOptions {
  /** Where partial matrices go: `parity-matrix.<run>.json`. */
  reportsDir: string;
  /** Every project the config defines; a run of all of them is named `all`, and is complete. */
  allProjects?: readonly string[];
  /**
   * A canary run's directory: its matrix goes to `<canaryDir>/parity-matrix.json`, where the
   * canary runner reads it, and it supersedes no partial matrix.
   */
  canaryDir?: string;
}

/** One test as {@link settleRun} reads it. */
export interface ReportedFileTest {
  project: string;
  fullName: string;
  skipped: boolean;
  record?: UfLayerMeta | undefined;
}

/** One spec file as {@link settleRun} reads it: what it recorded itself, and its tests. */
export interface ReportedFile {
  project: string;
  record?: UfLayerMeta | undefined;
  tests: readonly ReportedFileTest[];
}

/** What a run of either runner gives {@link settleRun}. */
export interface ReportedRun {
  /** The selected projects' names, sorted. */
  projects: readonly string[];
  harness: HarnessContext | undefined;
  filtered: string | null;
  shard: Shard | null;
  files: readonly ReportedFile[];
  /** Whether a skip with no reason is a problem: a filter may skip what it leaves out. */
  checksSkips: boolean;
  /** The cases a project includes file by file, or nothing (see `scopesOf`). */
  casesOf: (project: string) => readonly string[] | undefined;
  log: (message: string) => void;
  error: (message: string) => void;
}

/** What {@link settleRun} found. */
export interface SettledRun {
  matrix: PartialMatrix;
  /** Everything beyond the failed tests that fails the run, already printed. */
  problems: string[];
}

/**
 * Judges a finished run, either runner's: its matrix, written where the options say, and what fails
 * the run beyond its failed tests.
 */
export function settleRun(run: ReportedRun, options: ParityReporterOptions): SettledRun {
  const { projects, harness, filtered, shard } = run;
  // A shard runs whole files: its skips are real, but it may hold no file of a project.
  const narrowed = narrowing({ filtered, shard });
  const problems: string[] = [];
  const counts = new Map<string, number>(projects.map((name) => [name, 0]));
  const records: ProjectRecord[] = [];
  const named = new Set<string>();
  for (const file of run.files) {
    if (file.record) records.push({ project: file.project, record: file.record });
    for (const test of file.tests) {
      counts.set(test.project, (counts.get(test.project) ?? 0) + 1);
      // A record carries the parity scenarios the test checked too: a scenario one target
      // leaves out shows in no cell, so the summary compares each target's with the reference's,
      // test by test, by a name every target gives the test alike.
      const meta = test.record;
      const record = meta && { ...meta, test: testKey(test.fullName, meta.target) };
      if (record) {
        records.push({ project: test.project, record });
        const identity = JSON.stringify([test.project, record.case, record.test]);
        if (named.has(identity)) {
          problems.push(
            `${test.project}: two tests of ${record.case} are named "${record.test}". Each test of a case has a name of its own: the summary compares each target's tests with the reference's by name.`,
          );
        }
        named.add(identity);
      }
      if (run.checksSkips && test.skipped && !skipsWithReasons(record)) {
        problems.push(
          `${test.project}: "${test.fullName}" was skipped without recording why. A harness test never skips silently (plan §7.7): record each layer it skips, with the reason, before skipping.`,
        );
      }
    }
  }

  const empty = projects.filter((name) => !counts.get(name));
  if (empty.length) {
    if (narrowed) {
      run.log(
        `[uf:parity] Not checking for empty projects: the run covers only ${narrowed}. Empty: ${empty.join(", ")}.`,
      );
    } else {
      problems.push(
        `${empty.length} selected project(s) collected zero tests: ${empty.join(", ")}. A project that runs nothing verifies nothing.`,
      );
    }
  }

  const all = runName(projects, options.allProjects);
  const complete = !narrowed && all === "all" && options.allProjects !== undefined;
  const matrix = buildPartialMatrix({
    // Each shard's matrix has a name of its own: CI's parity job downloads them side by side.
    run: [
      all,
      ...(shard ? [`shard-${shard.index}-of-${shard.count}`] : []),
      ...(filtered ? [`filtered-${hash(filtered)}`] : []),
    ].join("+"),
    projects: [...projects],
    records,
    finishedAt: new Date().toISOString(),
    mode: harness
      ? { update: harness.update, pixels: harness.pixels, canary: harness.canary }
      : null,
    filtered,
    shard,
    empty,
    quarantine: harness?.quarantine ?? [],
    reference: harness?.reference ?? null,
    references: Object.fromEntries(
      Object.entries(harness?.cases ?? {}).flatMap(([id, config]) =>
        config.reference ? [[id, config.reference]] : [],
      ),
    ),
  });
  if (complete) {
    // Every record of every cell is here: a quarantined cell that no longer fails is stale.
    problems.push(...settleQuarantine(matrix.cases, matrix.quarantine, { stale: true }));
  } else if (matrix.quarantine.length) {
    run.log(
      "[uf:parity] Quarantine entries are checked for staleness when every project runs (or in the merged summary).",
    );
  }

  if (options.canaryDir) {
    mkdirSync(options.canaryDir, { recursive: true });
    writeFileSync(join(options.canaryDir, "parity-matrix.json"), stringifyMatrix(matrix));
  } else {
    mkdirSync(options.reportsDir, { recursive: true });
    const file = join(options.reportsDir, `parity-matrix.${matrix.run}.json`);
    writeFileSync(file, stringifyMatrix(matrix));
    if (!narrowed) {
      const scopes = scopesOf(projects, records, run.casesOf);
      for (const line of supersede(options.reportsDir, file, new Set(projects), scopes)) {
        run.log(`[uf:parity] ${line}`);
      }
    }
    run.log(`[uf:parity] ${records.length} record(s) from ${projects.length} project(s) → ${file}`);
  }

  if (problems.length) {
    run.error(
      `[uf:parity] ${problems.length} problem(s) beyond the failed tests:\n  ${problems.join("\n  ")}`,
    );
  }
  return { matrix, problems };
}

/** The parity reporter. Add it to `test.reporters` next to Vitest's own. */
export class ParityReporter {
  readonly #options: ParityReporterOptions;
  #vitest: ReportedVitest | undefined;
  /** The matrix of the last finished run, for tooling and tests. */
  matrix: PartialMatrix | undefined;

  constructor(options: ParityReporterOptions) {
    this.#options = options;
  }

  onInit(vitest: ReportedVitest): void {
    this.#vitest = vitest;
  }

  onTestRunEnd(
    testModules: readonly ReportedModule[],
    _errors: readonly unknown[],
    reason: string,
  ): void {
    const vitest = this.#vitest;
    if (!vitest) throw new Error("[uf:parity] onTestRunEnd ran before onInit.");
    if (reason === "interrupted") {
      vitest.logger.error("[uf:parity] The run was interrupted: no parity matrix written.");
      return;
    }
    const harness = vitest.projects
      .map((project) => project.getProvidedContext().ufHarness)
      .find((context) => context !== undefined);
    const filtered = filterOf(vitest);
    const { matrix, problems } = settleRun(
      {
        projects: [...new Set(vitest.projects.map((project) => project.name))].sort(),
        harness,
        filtered,
        shard: vitest.config.shard
          ? { index: vitest.config.shard.index, count: vitest.config.shard.count }
          : null,
        files: testModules.map((module) => ({
          project: module.project.name,
          record: module.meta().uf,
          tests: [...module.children.allTests()].map((test) => ({
            project: test.project.name,
            fullName: test.fullName,
            skipped: test.result().state === "skipped",
            record: test.meta().uf,
          })),
        })),
        checksSkips: !filtered,
        casesOf: (name) => {
          const project = vitest.projects.find((candidate) => candidate.name === name)!;
          return project.getProvidedContext().ufOnly ?? includedCases(project, harness);
        },
        log: (message) => vitest.logger.log(message),
        error: (message) => vitest.logger.error(message),
      },
      this.#options,
    );
    this.matrix = matrix;
    if (problems.length) process.exitCode = 1;
  }
}

/**
 * Why a run covers only part of its projects' tests besides its shard, or `null`. Such a run,
 * like a shard, cannot tell an empty project or a stale entry from a filtered one, and
 * supersedes nothing; unlike a shard's, its skipped tests may be ones it filtered out.
 */
function filterOf(vitest: ReportedVitest): string | null {
  const reasons: string[] = [];
  if (vitest.filenamePattern?.length) {
    reasons.push(`files matching ${vitest.filenamePattern.join(", ")}`);
  }
  if (vitest.config.testNamePattern) reasons.push(`tests named ${vitest.config.testNamePattern}`);
  const { changed, related, tagsFilter } = vitest.config;
  if (changed) {
    reasons.push(
      `files affected by ${changed === true ? "uncommitted changes" : `changes since ${changed}`}`,
    );
  } else if (related?.length) {
    reasons.push(`tests related to ${related.join(", ")}`);
  }
  if (tagsFilter?.length) reasons.push(`tests tagged ${tagsFilter.join(" ")}`);
  if (vitest.config.watch) reasons.push("watch mode, which reruns only what changed");
  return reasons.length ? reasons.join("; ") : null;
}

/**
 * A test's name without the target `describeTargets` puts in its suite's name (`state/counter
 * [vue] > increments` → `state/counter > increments`): the same on every target.
 */
export function testKey(fullName: string, target: string): string {
  const suffix = ` [${target}]`;
  return fullName
    .split(" > ")
    .map((part) => (part.endsWith(suffix) ? part.slice(0, -suffix.length) : part))
    .join(" > ");
}

/** Whether a skipped test recorded every layer it skipped, each with a reason. */
function skipsWithReasons(record: UfLayerMeta | undefined): boolean {
  const outcomes = Object.values(record?.layers ?? {});
  return outcomes.length > 0 && outcomes.every((outcome) => outcome.status === "skip");
}

/** A file-name-safe name for the selected projects: `all`, or the project names. */
export function runName(projects: readonly string[], allProjects?: readonly string[]): string {
  const selected = [...new Set(projects)].sort();
  if (allProjects && [...new Set(allProjects)].sort().join("\n") === selected.join("\n"))
    return "all";
  const joined = selected.map((name) => name.replace(/[^a-zA-Z0-9-]+/g, "-")).join("+");
  if (joined.length <= 80) return joined || "none";
  return `${joined.slice(0, 60)}+${hash(joined)}`;
}

function hash(text: string): string {
  let value = 0;
  for (const char of text) value = (Math.imul(value, 31) + char.charCodeAt(0)) >>> 0;
  return value.toString(36);
}

/**
 * Whether a file name is a partial matrix's, `parity-matrix.<run>.json`. An engine's merged
 * matrix, `parity-matrix.<engine>.json` (ADR-0066), is not: no run is named after an engine.
 */
export function isPartialMatrixFile(name: string): boolean {
  const run = /^parity-matrix\.(.+)\.json$/.exec(name)?.[1];
  return run !== undefined && !(BROWSER_ENGINES as readonly string[]).includes(run);
}

/** The partial matrices in a directory, by file. Throws on one that is not a current matrix. */
export function readPartialMatrices(reportsDir: string): Map<string, PartialMatrix> {
  const matrices = new Map<string, PartialMatrix>();
  if (!existsSync(reportsDir)) return matrices;
  for (const name of readdirSync(reportsDir).sort()) {
    if (!isPartialMatrixFile(name)) continue;
    const file = join(reportsDir, name);
    const matrix = JSON.parse(readFileSync(file, "utf8")) as PartialMatrix;
    if (matrix.version !== MATRIX_VERSION || !matrix.byProject) {
      throw new Error(
        `[uf] ${file} is a parity matrix of version ${String(matrix.version)}, not ${MATRIX_VERSION}: rerun the tests to replace it.`,
      );
    }
    matrices.set(file, matrix);
  }
  return matrices;
}

/**
 * What this run re-judged of each project it ran: the targets it recorded there, as a run of
 * some targets (`UF_TARGETS`) records only theirs, and only some cases where the run added the
 * project for the cases that name its target as their own reference (ADR-0057). The SSR
 * project is told those cases (`ufOnly`), and the browser project includes their specs alone.
 * Both come from the project itself, so they hold when a spec failed to load and the project
 * recorded nothing, whichever other projects the run selected. A project that recorded nothing
 * and names no cases re-judged all of it.
 */
function scopesOf(
  projects: readonly string[],
  records: readonly ProjectRecord[],
  casesOf: (project: string) => readonly string[] | undefined,
): Map<string, ProjectScope> {
  const scopes = new Map<string, ProjectScope>();
  for (const project of projects) {
    const targets = new Set(
      records.filter((entry) => entry.project === project).map((entry) => entry.record.target),
    );
    const cases = casesOf(project);
    scopes.set(project, {
      ...(targets.size ? { targets } : {}),
      ...(cases ? { cases: new Set(cases) } : {}),
    });
  }
  return scopes;
}

/**
 * The cases whose specs a project includes file by file, or none when it includes a pattern or a
 * file outside every case: the harness lists the specs of a browser project it adds for some
 * cases alone, and gives every other project a pattern or a harness file.
 */
function includedCases(
  project: ReportedProject,
  harness: HarnessContext | undefined,
): string[] | undefined {
  const { root, include } = project.config;
  if (!harness || !include.length || include.some((entry) => /[*?[\]{}!]/.test(entry))) {
    return undefined;
  }
  try {
    return include.map((entry) => caseOfFile(resolve(root, entry), harness));
  } catch {
    return undefined;
  }
}

/**
 * Removes the records this run re-judged from every other partial matrix: those of the projects
 * it ran, within each one's scope (see `scopesOf`). They are stale, also the cells this run no
 * longer records. A matrix left without projects is deleted; one of another version is deleted
 * too, as nothing can merge it. Returns what it did.
 */
function supersede(
  reportsDir: string,
  written: string,
  projects: ReadonlySet<string>,
  scopes: ReadonlyMap<string, ProjectScope>,
): string[] {
  const done: string[] = [];
  for (const name of readdirSync(reportsDir).sort()) {
    if (!isPartialMatrixFile(name)) continue;
    const file = join(reportsDir, name);
    if (file === written) continue;
    const matrix = JSON.parse(readFileSync(file, "utf8")) as PartialMatrix;
    if (matrix.version !== MATRIX_VERSION || !matrix.byProject) {
      rmSync(file);
      done.push(`Removed ${name}: a matrix of an older format.`);
      continue;
    }
    const kept = withoutProjects(matrix, projects, scopes);
    if (kept === matrix) continue;
    if (kept) {
      writeFileSync(file, stringifyMatrix(kept));
      const superseded = matrix.projects.filter(
        (project) =>
          !kept.projects.includes(project) ||
          kept.byProject[project] !== matrix.byProject[project] ||
          kept.scenariosByProject[project] !== matrix.scenariosByProject[project] ||
          kept.testsByProject[project] !== matrix.testsByProject[project],
      );
      done.push(`Superseded ${superseded.length} project(s) of ${name}.`);
    } else {
      rmSync(file);
      done.push(`Superseded ${name}.`);
    }
  }
  return done;
}
