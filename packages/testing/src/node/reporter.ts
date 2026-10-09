// The parity reporter (plan §7.4): collects every test's `meta.uf`, and each test file's (what
// a file records after its last test: setup.ts's late console check), writes this run's partial
// matrix to `<reportsDir>/parity-matrix.<run>.json`, and fails the run loudly (plan §7.7) when:
// - a selected project collected no tests: a project that silently runs nothing is never green;
// - a test was skipped without recording why;
// - two tests of a case share a name, so the summary could not tell them apart;
// - a quarantine entry is stale, once the run has every record of its cell.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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
import type { PartialMatrix, ProjectRecord, Shard } from "./matrix.ts";

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
  getProvidedContext(): { ufHarness?: HarnessContext };
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
    _errors: readonly unknown[],
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

    const empty = projects.filter((name) => !counts.get(name));
    if (empty.length) {
      if (narrowed) {
        vitest.logger.log(
          `[uf:parity] Not checking for empty projects: the run covers only ${narrowed}. Empty: ${empty.join(", ")}.`,
        );
      } else {
        problems.push(
          `${empty.length} selected project(s) collected zero tests: ${empty.join(", ")}. A project that runs nothing verifies nothing.`,
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
        for (const line of supersede(this.#options.reportsDir, file, new Set(projects))) {
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

/** The partial matrices in a directory, by file. Throws on one that is not a current matrix. */
export function readPartialMatrices(reportsDir: string): Map<string, PartialMatrix> {
  const matrices = new Map<string, PartialMatrix>();
  if (!existsSync(reportsDir)) return matrices;
  for (const name of readdirSync(reportsDir).sort()) {
    if (!/^parity-matrix\..+\.json$/.test(name)) continue;
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
 * Removes the records of the projects this run ran from every other partial matrix: they are
 * stale, also the cells this run no longer records. A matrix left without projects is deleted;
 * one of another version is deleted too, as nothing can merge it. Returns what it did.
 */
function supersede(reportsDir: string, written: string, projects: ReadonlySet<string>): string[] {
  const done: string[] = [];
  for (const name of readdirSync(reportsDir).sort()) {
    if (!/^parity-matrix\..+\.json$/.test(name)) continue;
    const file = join(reportsDir, name);
    if (file === written) continue;
    const matrix = JSON.parse(readFileSync(file, "utf8")) as PartialMatrix;
    if (matrix.version !== MATRIX_VERSION || !matrix.byProject) {
      rmSync(file);
      done.push(`Removed ${name}: a matrix of an older format.`);
      continue;
    }
    const kept = withoutProjects(matrix, projects);
    if (kept === matrix) continue;
    if (kept) {
      writeFileSync(file, stringifyMatrix(kept));
      done.push(
        `Superseded ${matrix.projects.length - kept.projects.length} project(s) of ${name}.`,
      );
    } else {
      rmSync(file);
      done.push(`Superseded ${name}.`);
    }
  }
  return done;
}
