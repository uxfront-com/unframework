// The parity reporter (plan §7.4): collects every test's `meta.uf`, and each test file's (what
// a file records after its last test: setup.ts's late console check), writes this run's partial
// matrix to `<reportsDir>/parity-matrix.<run>.json`, and fails the run loudly (plan §7.7) when:
// - a selected project collected no tests: a project that silently runs nothing is never green
//   (one none of whose spec files could import a setup file is that failure's, ADR-0092);
// - a test was skipped without recording why;
// - two tests of a case share a name, so the summary could not tell them apart;
// - a quarantine entry is stale, once the run has every record of its cell.
// It also keeps the run's errors outside every test, which the summary quotes (ADR-0091), and
// each setup file a project could not import, which the summary reports once (ADR-0092).
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

import { errorMessages } from "../errors.ts";
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
import type { PartialMatrix, ProjectRecord, ProjectScope, SetupFailure, Shard } from "./matrix.ts";

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
  /** The spec file, usually its absolute path. */
  moduleId: string;
  meta(): { uf?: UfLayerMeta };
  /** Errors outside every test, such as a failed import. */
  errors(): readonly unknown[];
  children: { allTests(): Iterable<ReportedTest> };
}

/** The part of a Vitest project the reporter reads. */
interface ReportedProject {
  name: string;
  /** `setupFiles` are absolute, as Vitest resolves them. */
  config: { root: string; include: string[]; setupFiles: readonly string[] };
  getProvidedContext(): { target?: string; ufHarness?: HarnessContext; ufOnly?: string[] };
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
    errors: readonly unknown[],
    reason: string,
  ): void {
    const vitest = this.#vitest;
    if (!vitest) throw new Error("[uf:parity] onTestRunEnd ran before onInit.");
    if (reason === "interrupted") {
      vitest.logger.error("[uf:parity] The run was interrupted: no parity matrix written.");
      return;
    }
    const projects = [...new Set(vitest.projects.map((project) => project.name))].sort();
    const harness = vitest.projects
      .map((project) => project.getProvidedContext().ufHarness)
      .find((context) => context !== undefined);
    const filtered = filterOf(vitest);
    const shard: Shard | null = vitest.config.shard
      ? { index: vitest.config.shard.index, count: vitest.config.shard.count }
      : null;
    // A shard runs whole files: its skips are real, but it may hold no file of a project.
    const narrowed = narrowing({ filtered, shard });
    const problems: string[] = [];
    const counts = new Map<string, number>(projects.map((name) => [name, 0]));
    const records: ProjectRecord[] = [];
    const named = new Set<string>();
    for (const module of testModules) {
      const fileRecord = module.meta().uf;
      if (fileRecord) records.push({ project: module.project.name, record: fileRecord });
      for (const test of module.children.allTests()) {
        counts.set(test.project.name, (counts.get(test.project.name) ?? 0) + 1);
        // A record carries the parity scenarios the test checked too: a scenario one target
        // leaves out shows in no cell, so the summary compares each target's with the reference's,
        // test by test, by a name every target gives the test alike.
        const meta = test.meta().uf;
        const record = meta && { ...meta, test: testKey(test.fullName, meta.target) };
        if (record) {
          records.push({ project: test.project.name, record });
          const identity = JSON.stringify([test.project.name, record.case, record.test]);
          if (named.has(identity)) {
            problems.push(
              `${test.project.name}: two tests of ${record.case} are named "${record.test}". Each test of a case has a name of its own: the summary compares each target's tests with the reference's by name.`,
            );
          }
          named.add(identity);
        }
        if (!filtered && test.result().state === "skipped" && !skipsWithReasons(record)) {
          problems.push(
            `${test.project.name}: "${test.fullName}" was skipped without recording why. A harness test never skips silently (plan §7.7): record each layer it skips, with the reason, before skipping.`,
          );
        }
      }
    }

    const { setupFailures, failedSetup } = setupFailuresOf(testModules, vitest.projects, harness);
    const empty = projects.filter((name) => !counts.get(name));
    // A project none of whose spec files could import a setup file collected nothing for that
    // reason alone, which the summary names with Vitest's cause (ADR-0092).
    const unexplained = empty.filter((name) => {
      const ofProject = testModules.filter((module) => module.project.name === name);
      return !ofProject.length || !ofProject.every((module) => failedSetup.has(module));
    });
    if (unexplained.length) {
      if (narrowed) {
        vitest.logger.log(
          `[uf:parity] Not checking for empty projects: the run covers only ${narrowed}. Empty: ${unexplained.join(", ")}.`,
        );
      } else {
        problems.push(
          `${unexplained.length} selected project(s) collected zero tests: ${unexplained.join(", ")}. A project that runs nothing verifies nothing.`,
        );
      }
    }

    const all = runName(projects, this.#options.allProjects);
    const complete = !narrowed && all === "all" && this.#options.allProjects !== undefined;
    const matrix = buildPartialMatrix({
      // Each shard's matrix has a name of its own: CI's parity job downloads them side by side.
      run: [
        all,
        ...(shard ? [`shard-${shard.index}-of-${shard.count}`] : []),
        ...(filtered ? [`filtered-${hash(filtered)}`] : []),
      ].join("+"),
      projects,
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
      // What the summary quotes when a reference's project stopped before it finished a case
      // its followers compare with (ADR-0091): Vitest reports the closed connection only here.
      errors: [...new Set(errors.map((error) => errorMessages(error).join("; caused by: ")))],
      setupFailures,
    });
    if (complete) {
      // Every record of every cell is here: a quarantined cell that no longer fails is stale.
      problems.push(...settleQuarantine(matrix.cases, matrix.quarantine, { stale: true }));
    } else if (matrix.quarantine.length) {
      vitest.logger.log(
        "[uf:parity] Quarantine entries are checked for staleness when every project runs (or in the merged summary).",
      );
    }
    this.matrix = matrix;

    if (this.#options.canaryDir) {
      mkdirSync(this.#options.canaryDir, { recursive: true });
      writeFileSync(join(this.#options.canaryDir, "parity-matrix.json"), stringifyMatrix(matrix));
    } else {
      mkdirSync(this.#options.reportsDir, { recursive: true });
      const file = join(this.#options.reportsDir, `parity-matrix.${matrix.run}.json`);
      writeFileSync(file, stringifyMatrix(matrix));
      if (!narrowed) {
        const scopes = scopesOf(vitest.projects, records, harness);
        for (const line of supersede(this.#options.reportsDir, file, new Set(projects), scopes)) {
          vitest.logger.log(`[uf:parity] ${line}`);
        }
      }
      vitest.logger.log(
        `[uf:parity] ${records.length} record(s) from ${projects.length} project(s) → ${file}`,
      );
    }

    if (problems.length) {
      vitest.logger.error(
        `[uf:parity] ${problems.length} problem(s) beyond the failed tests:\n  ${problems.join("\n  ")}`,
      );
      process.exitCode = 1;
    }
  }
}

/**
 * The setup files each project's spec files could not import, and those spec files' modules.
 * The browser tester wraps whatever the import threw in `Failed to import test file <path>`, a
 * spec's own import failure as much as a setup file's (`@vitest/browser`'s `importFile`), so only
 * a path that is one of the project's `setupFiles` makes it the harness's failure (ADR-0092). A
 * spec whose own module throws on import, as the golden guard makes it, stays a case's failure.
 */
function setupFailuresOf(
  modules: readonly ReportedModule[],
  projects: readonly ReportedProject[],
  harness: HarnessContext | undefined,
): { setupFailures: SetupFailure[]; failedSetup: Set<ReportedModule> } {
  const byName = new Map(projects.map((project) => [project.name, project]));
  const failures = new Map<string, SetupFailure & { causes: Set<string> }>();
  const failedSetup = new Set<ReportedModule>();
  for (const module of modules) {
    const project = byName.get(module.project.name);
    if (!project) continue;
    for (const error of module.errors()) {
      const [message = ""] = errorMessages(error);
      const setupFile = project.config.setupFiles.find(
        (file) => message === `${IMPORT_FAILED}${file}`,
      );
      if (setupFile === undefined) continue;
      failedSetup.add(module);
      const file = relativeTo(project.config.root, setupFile);
      const key = JSON.stringify([project.name, file]);
      const target = project.getProvidedContext().target;
      const failure = failures.get(key) ?? {
        project: project.name,
        ...(target === undefined ? {} : { target }),
        file,
        specs: [],
        errors: [],
        causes: new Set<string>(),
      };
      const caseId = harness && caseIn(module.moduleId, harness);
      failure.specs.push({
        file: relativeTo(project.config.root, module.moduleId),
        ...(caseId === undefined ? {} : { case: caseId }),
      });
      const causes = namedCauses(error);
      failure.causes.add(causes.length ? causes.join("; caused by: ") : message);
      failures.set(key, failure);
      // Vitest stops a spec file at the first setup file it cannot import.
      break;
    }
  }
  const setupFailures = [...failures.values()]
    .map(({ causes, ...failure }) => ({
      ...failure,
      specs: failure.specs.toSorted((a, b) => a.file.localeCompare(b.file)),
      errors: [...causes].toSorted(),
    }))
    .toSorted((a, b) => a.project.localeCompare(b.project) || a.file.localeCompare(b.file));
  return { setupFailures, failedSetup };
}

/**
 * An error's causes, outermost first, each with its name where that says more than `Error`: a
 * `SyntaxError` is a module that did not parse, a `TypeError` one the page could not fetch.
 * Vitest serialises a cause from the browser with its name as `Caused by: <name>`, for its own
 * report, so that prefix goes.
 */
function namedCauses(error: unknown): string[] {
  const causes = errorMessages(error).slice(1);
  let cause: unknown = error;
  return causes.map((message) => {
    cause = typeof cause === "object" && cause !== null && "cause" in cause ? cause.cause : null;
    const raw =
      typeof cause === "object" && cause !== null && "name" in cause ? cause.name : undefined;
    const name = typeof raw === "string" ? raw.replace(/^Caused by: /, "") : undefined;
    return typeof name === "string" && name !== "Error" && !message.startsWith(`${name}:`)
      ? `${name}: ${message}`
      : message;
  });
}

/** What `@vitest/browser`'s tester throws when a module it imports fails, before the path. */
const IMPORT_FAILED = "Failed to import test file ";

/** A path relative to a root, with forward slashes. */
function relativeTo(root: string, file: string): string {
  return relative(root, file).split(sep).join("/");
}

/** The case a spec file belongs to, or none for a file outside every case. */
function caseIn(file: string, harness: HarnessContext): string | undefined {
  try {
    return caseOfFile(file, harness);
  } catch {
    return undefined;
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
  projects: readonly ReportedProject[],
  records: readonly ProjectRecord[],
  harness: HarnessContext | undefined,
): Map<string, ProjectScope> {
  const scopes = new Map<string, ProjectScope>();
  for (const project of projects) {
    const targets = new Set(
      records.filter((entry) => entry.project === project.name).map((entry) => entry.record.target),
    );
    const cases = project.getProvidedContext().ufOnly ?? includedCases(project, harness);
    scopes.set(project.name, {
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
