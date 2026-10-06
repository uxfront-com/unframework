// The summary as each of its callers runs it, on partial matrices in a directory of their own:
// CI's parity job, over one partial matrix per CI job (read from ci.yml), must require every
// job's; a `scripts/run.ts` run of some projects (`pnpm test:baselines:check`, CI=1 in the
// container) is judged on the projects it selected.
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPartialMatrix, runName, stringifyMatrix } from "@unframework/testing/node";
import type { LayerName, ProjectRecord, Shard } from "@unframework/testing/node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parityJob, runSummary } from "../scripts/summary.ts";
import { listCases } from "./cases.ts";
import { REPO_ROOT } from "./paths.ts";
import { isSelected, projectNames } from "./projects.ts";
import { selectTargets } from "./targets.ts";

const TARGETS = selectTargets(undefined);
const ALL = projectNames(TARGETS);
const CASES = listCases().map((info) => info.id);

/** The live layers each kind of project records (plan §7.3). */
const LAYERS_OF: Record<string, LayerName[]> = {
  compile: ["L1", "L2"],
  harness: [],
  toolchain: ["L3", "L4", "L5"],
  ssr: ["L6", "L13"],
  browser: ["L7", "L8", "L10", "L11", "L13"],
};

/**
 * A green run's partial matrix: each project records its layers on every case, or, in a shard,
 * on the cases of its files.
 */
function partial(
  projects: readonly string[],
  finishedAt: string,
  { shard = null, cases = CASES }: { shard?: Shard | null; cases?: readonly string[] } = {},
): string {
  const records: ProjectRecord[] = projects.flatMap((project) => {
    const [kind, target] = project.split(":") as [string, string | undefined];
    const layers = Object.fromEntries(LAYERS_OF[kind]!.map((layer) => [layer, { status: "pass" }]));
    if (!Object.keys(layers).length) return [];
    return cases.flatMap((caseId) =>
      (target ? [target] : TARGETS).map((cellTarget) => ({
        project,
        record: { case: caseId, target: cellTarget, layers },
      })),
    );
  });
  return stringifyMatrix(
    buildPartialMatrix({
      run: runName(projects, ALL),
      projects,
      records,
      finishedAt,
      mode: { update: false, pixels: "baseline", canary: null },
      filtered: null,
      shard,
      empty: [],
      quarantine: [],
    }),
  );
}

/** One Vitest run of a CI job (a matrix job runs once per target). */
interface JobRun {
  job: string;
  name: string;
  projects: string[];
  /** Whether the job uploads its partial matrix for the parity job (`parity-*`). */
  uploads: boolean;
}

/** The CI jobs that run harness projects, and the jobs the parity job waits for, from ci.yml. */
function ciJobs(): { runs: JobRun[]; parityNeeds: string[] } {
  const workflow = readFileSync(join(REPO_ROOT, ".github", "workflows", "ci.yml"), "utf8");
  const jobs = workflow.slice(workflow.indexOf("\njobs:\n")).split(/^ {2}(?=[a-z0-9-]+:\n)/m);
  const runs: JobRun[] = [];
  let parityNeeds: string[] = [];
  for (const block of jobs.slice(1)) {
    const job = block.slice(0, block.indexOf(":"));
    if (job === "parity") {
      parityNeeds = /^ {4}needs: \[([^\]]*)\]/m.exec(block)![1]!.split(/,\s*/);
      continue;
    }
    const command = /vitest run((?: --project (?:"[^"]*"|\S+))+)/.exec(block);
    if (!command) continue;
    const patterns = [...command[1]!.matchAll(/--project (?:"([^"]*)"|(\S+))/g)].map(
      ([, quoted, bare]) => (quoted ?? bare)!,
    );
    const matrix = /^ {8}target: \[([^\]]*)\]/m.exec(block)?.[1]?.split(/,\s*/);
    for (const target of matrix ?? [undefined]) {
      const selected = patterns.map((pattern) =>
        target ? pattern.replaceAll("${{ matrix.target }}", target) : pattern,
      );
      runs.push({
        job,
        name: target ? `${job} (${target})` : job,
        projects: ALL.filter((project) => isSelected(project, selected)),
        uploads: /^ {10}name: parity-/m.test(block),
      });
    }
  }
  return { runs, parityNeeds };
}

let reportsDir: string;
let problems: string;
beforeEach(() => {
  reportsDir = mkdtempSync(join(tmpdir(), "uf-summary-"));
  problems = "";
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.spyOn(console, "error").mockImplementation((message: string) => {
    problems += `${message}\n`;
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  rmSync(reportsDir, { recursive: true, force: true });
});

describe("CI's parity job", () => {
  const { runs, parityNeeds } = ciJobs();
  const ci = { CI: "true" };

  it("waits for every job that runs harness projects, which together run each project once", () => {
    expect(runs.map((run) => run.name)).toEqual([
      "integration-compile",
      ...TARGETS.map((target) => `integration-toolchains (${target})`),
      "integration-ssr",
      ...TARGETS.map((target) => `integration-browser (${target})`),
    ]);
    expect(runs.flatMap((run) => run.projects).toSorted()).toEqual(ALL.toSorted());
    expect(runs.filter((run) => !run.uploads)).toEqual([]);
    expect(parityNeeds.toSorted()).toEqual([...new Set(runs.map((run) => run.job))].toSorted());
  });

  it("is green with every job's matrix", () => {
    for (const run of runs) {
      writeFileSync(
        join(reportsDir, `parity-matrix.${runName(run.projects, ALL)}.json`),
        partial(run.projects, new Date().toISOString()),
      );
    }
    expect(runSummary(ci, { ...parityJob(ci), reportsDir })).toBe(0);
  });

  it.each(runs.map((run) => [run.name, run] as const))(
    "fails without the matrix of %s",
    (_name, missing) => {
      for (const run of runs.filter((other) => other !== missing)) {
        writeFileSync(
          join(reportsDir, `parity-matrix.${runName(run.projects, ALL)}.json`),
          partial(run.projects, new Date().toISOString()),
        );
      }
      expect(runSummary(ci, { ...parityJob(ci), reportsDir })).toBe(1);
      for (const project of missing.projects) {
        expect(problems).toContain(`${project}: did not run (no parity matrix has its records).`);
      }
      expect(problems).toMatch(/› L\d+: missing \(no test recorded it\)\./);
    },
  );

  it("accepts browser jobs in shards (plan §7.9) once every shard reported", () => {
    const count = 2;
    for (const run of runs) {
      const name = runName(run.projects, ALL);
      if (run.job !== "integration-browser") {
        writeFileSync(
          join(reportsDir, `parity-matrix.${name}.json`),
          partial(run.projects, new Date().toISOString()),
        );
        continue;
      }
      for (let index = 1; index <= count; index++) {
        // The reporter names each shard's matrix apart, so they download side by side.
        writeFileSync(
          join(reportsDir, `parity-matrix.${name}+shard-${index}-of-${count}.json`),
          partial(run.projects, new Date().toISOString(), {
            shard: { index, count },
            cases: CASES.filter((_, position) => position % count === index - 1),
          }),
        );
      }
    }
    expect(runSummary(ci, { ...parityJob(ci), reportsDir })).toBe(0);
    expect(problems).toBe("");

    unlinkSync(join(reportsDir, "parity-matrix.browser-vue+shard-2-of-2.json"));
    expect(runSummary(ci, { ...parityJob(ci), reportsDir })).toBe(1);
    expect(problems).toContain(
      "browser:vue: only filtered runs ran it (shard 1/2 without shard 2/2), so not every cell is checked.",
    );
  });

  it("treats a run outside CI as a partial run", () => {
    vi.stubEnv("CI", "");
    const browser = ALL.filter((project) => project.startsWith("browser:"));
    writeFileSync(
      join(reportsDir, "parity-matrix.browser.json"),
      partial(browser, "2026-01-01T00:00:00.000Z"),
    );
    expect(runSummary({}, { ...parityJob({}), reportsDir })).toBe(0);
  });
});

describe("a run of scripts/run.ts", () => {
  it("judges only the projects it selected, in CI's mode too (pnpm test:baselines:check)", () => {
    const started = new Date();
    const browser = ALL.filter((project) => project.startsWith("browser:"));
    writeFileSync(
      join(reportsDir, `parity-matrix.${runName(browser, ALL)}.json`),
      partial(browser, new Date(started.getTime() + 1).toISOString()),
    );
    // As in the container: CI is set in the process too, where writeSummary would read it.
    vi.stubEnv("CI", "1");
    const run = { since: started, requireComplete: false, reportsDir };
    expect(runSummary({ CI: "1" }, run)).toBe(0);
    expect(problems).toBe("");
    expect(readFileSync(join(reportsDir, "parity-matrix.md"), "utf8")).toContain(
      "Partial run: 16 project(s) did not run",
    );
  });

  it("still fails a missing cell of a run of every project", () => {
    const started = new Date();
    const ran = ALL.filter((project) => project !== "toolchain:svelte");
    // A selected project that recorded nothing is listed in the matrix all the same.
    const matrix = JSON.parse(partial(ran, new Date(started.getTime() + 1).toISOString()));
    matrix.projects = ALL.toSorted();
    matrix.byProject["toolchain:svelte"] = {};
    writeFileSync(join(reportsDir, "parity-matrix.all.json"), JSON.stringify(matrix));
    expect(runSummary({}, { since: started, requireComplete: false, reportsDir })).toBe(1);
    expect(problems).toContain("› svelte › L3: missing (no test recorded it).");
  });

  it("fails a run that wrote no matrix since it started", () => {
    writeFileSync(
      join(reportsDir, "parity-matrix.all.json"),
      partial(ALL, "2026-01-01T00:00:00.000Z"),
    );
    expect(runSummary({}, { since: new Date(), requireComplete: false, reportsDir })).toBe(1);
    expect(problems).toContain("the run did not get as far as reporting");
  });
});
