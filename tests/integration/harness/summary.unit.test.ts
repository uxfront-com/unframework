// The summary as each of its callers runs it, on partial matrices in a directory of their own:
// CI's parity job, over one partial matrix per CI job (read from ci.yml), must require every
// job's; a `scripts/run.ts` run of some projects (`pnpm test:baselines:check`, CI=1 in the
// container) is judged on the projects it selected.
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPartialMatrix, runName, stringifyMatrix } from "@unframework.dev/testing/node";
import type { LayerName, ProjectRecord, Shard } from "@unframework.dev/testing/node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BROWSER_ONLY_LAYERS, parityJob, runSummary } from "../scripts/summary.ts";
import { listCases } from "./cases.ts";
import { REPO_ROOT, REPORTS_DIR, reportsDirOf } from "./paths.ts";
import { isSelected, parityProjects, projectNames } from "./projects.ts";
import { selectTargets } from "./targets.ts";

const TARGETS = selectTargets(undefined);
const ALL = projectNames(TARGETS);
/** Every project a job of CI's runs: the default run's, and the `Bench` job's. */
const PARITY = parityProjects(TARGETS);
const CASES = listCases().map((info) => info.id);
/** The cases a browser project loads: every case but the diagnostics ones, which have no spec. */
const SPEC_CASES = listCases()
  .filter((info) => info.spec)
  .map((info) => info.id);

/** The live layers each kind of project records (plan §7.3). */
const LAYERS_OF: Record<string, LayerName[]> = {
  compile: ["L1", "L2", "L14"],
  harness: [],
  toolchain: ["L3", "L4", "L5"],
  ssr: ["L6", "L13"],
  browser: ["L7", "L8", "L9", "L10", "L11", "L13"],
  hydrate: ["L12"],
  bench: ["L15"],
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

/** Each job's block in ci.yml, from its id's line. */
function jobBlocks(): string[] {
  const workflow = readFileSync(join(REPO_ROOT, ".github", "workflows", "ci.yml"), "utf8");
  return workflow
    .slice(workflow.indexOf("\njobs:\n"))
    .split(/^ {2}(?=[a-z0-9-]+:\n)/m)
    .slice(1);
}

/** The CI jobs that run harness projects, and the jobs the parity job waits for, from ci.yml. */
function ciJobs(): { runs: JobRun[]; parityNeeds: string[] } {
  const runs: JobRun[] = [];
  let parityNeeds: string[] = [];
  for (const block of jobBlocks()) {
    const job = block.slice(0, block.indexOf(":"));
    if (job === "parity") {
      parityNeeds = /^ {4}needs:\s*\[([^\]]*)\]/m
        .exec(block)![1]!
        .split(",")
        .map((job) => job.trim())
        .filter(Boolean);
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
        projects: PARITY.filter((project) => isSelected(project, selected)),
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
      "integration-toolchains",
      "integration-ssr",
      ...TARGETS.map((target) => `integration-browser (${target})`),
      ...TARGETS.map((target) => `integration-hydrate (${target})`),
      "bench",
    ]);
    expect(runs.flatMap((run) => run.projects).toSorted()).toEqual(PARITY.toSorted());
    expect(runs.filter((run) => !run.uploads)).toEqual([]);
    // It also waits for `changes`, which skips it with the jobs it waits for on a docs-only
    // pull request (ADR-0084).
    expect(parityNeeds).toContain("changes");
    expect(parityNeeds.filter((job) => job !== "changes").toSorted()).toEqual(
      [...new Set(runs.map((run) => run.job))].toSorted(),
    );
  });

  it("leaves out the Baselines job: an update run, which no summary judges (ADR-0062)", () => {
    const baselines = jobBlocks().find((block) => block.startsWith("baselines:\n"));
    if (!baselines) throw new Error("ci.yml has no baselines job.");
    expect(baselines).toContain("run: bash tests/integration/scripts/baselines.sh ci\n");
    expect(baselines).not.toMatch(/^ {10}name: parity-/m);
    expect(parityNeeds).not.toContain("baselines");
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
  /** The cell of a merged matrix on disk. */
  const cell = (id: string, target: string, layer: string) =>
    JSON.parse(readFileSync(join(reportsDir, "parity-matrix.json"), "utf8")).cases[id][target][
      layer
    ] as string;
  const run = (started: Date) => ({ since: started, requireComplete: false, reportsDir });

  it("fills L15 as not in this run when the default run left `bench` out, with every other cell judged", () => {
    const started = new Date();
    writeFileSync(
      join(reportsDir, "parity-matrix.all.json"),
      partial(ALL, new Date(started.getTime() + 1).toISOString()),
    );
    expect(runSummary({}, run(started))).toBe(0);
    expect(problems).toBe("");
    expect(cell(CASES[0]!, TARGETS[0]!, "L15")).toBe("skip(not in this run)");
    expect(cell(CASES[0]!, TARGETS[0]!, "L1")).toBe("pass");
    expect(readFileSync(join(reportsDir, "parity-matrix.md"), "utf8")).toContain(
      "Every project ran: every cell is checked.\nOnly `bench` records L15, and it did not run in full, so those cells are skip(not in this run).",
    );
  });

  it("records L15 from a run of `bench` alone, and fails a cell it left missing", () => {
    const started = new Date();
    const matrix = JSON.parse(partial(["bench"], new Date(started.getTime() + 1).toISOString()));
    writeFileSync(join(reportsDir, "parity-matrix.bench.json"), JSON.stringify(matrix));
    expect(runSummary({}, run(started))).toBe(0);
    expect(cell(CASES[0]!, TARGETS[0]!, "L15")).toBe("pass");

    delete matrix.byProject.bench[CASES[0]!];
    writeFileSync(join(reportsDir, "parity-matrix.bench.json"), JSON.stringify(matrix));
    expect(runSummary({}, run(started))).toBe(1);
    expect(problems).toContain(
      `${CASES[0]!} › ${TARGETS[0]!} › L15: missing (no test recorded it).`,
    );
  });

  it("fails an L15 cell that a run of `bench` found over budget", () => {
    const started = new Date();
    const matrix = JSON.parse(partial(["bench"], new Date(started.getTime() + 1).toISOString()));
    matrix.byProject.bench[CASES[0]!][TARGETS[0]!].L15 = "fail: raw size is above its budget";
    writeFileSync(join(reportsDir, "parity-matrix.bench.json"), JSON.stringify(matrix));
    expect(runSummary({}, run(started))).toBe(1);
    expect(problems).toContain("raw size is above its budget");
  });

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
      "Partial run: 23 project(s) did not run",
    );
  });

  it("summarises a run in Firefox or WebKit as that engine's matrix, in a directory of its own", () => {
    expect(reportsDirOf("chromium")).toBe(REPORTS_DIR);
    expect(reportsDirOf("firefox")).toBe(join(REPORTS_DIR, "firefox"));
    const started = new Date();
    const browser = ALL.filter((project) => project.startsWith("browser:"));
    writeFileSync(
      join(reportsDir, `parity-matrix.${runName(browser, ALL)}.json`),
      partial(browser, new Date(started.getTime() + 1).toISOString()),
    );
    const run = { since: started, requireComplete: false, reportsDir };
    expect(runSummary({ UF_BROWSER: "firefox" }, run)).toBe(0);
    expect(readFileSync(join(reportsDir, "parity-matrix.firefox.md"), "utf8")).toContain(
      "## Unframework parity matrix in firefox",
    );
    expect(
      JSON.parse(readFileSync(join(reportsDir, "parity-matrix.firefox.json"), "utf8")),
    ).toMatchObject({ run: "merged", projects: browser.toSorted() });
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

describe("the nightly's WebKit job, merged browser-only (ADR-0081)", () => {
  const ci = { CI: "true" };
  const job = { ...parityJob(ci, ["--", "--browser-only"]) };
  /** The batches `nightly.yml` runs, each a Vitest run with the reference. */
  const BATCHES = [
    ["vue", "react", "svelte"],
    ["vue", "solid", "angular"],
    ["vue", "qwik", "astro"],
  ];
  /** `semantics/listbox` names React as its reference, so a batch without React adds it there. */
  const LISTBOX = "semantics/listbox";

  /** A green batch's partial matrix: its browser projects on every case with a spec. */
  function batch(targets: readonly string[], finishedAt: string): string {
    const projects = targets.map((target) => `browser:${target}`);
    const extra = targets.includes("react") ? [] : ["browser:react"];
    const layers = Object.fromEntries(
      LAYERS_OF.browser!.map((layer) => [layer, { status: "pass" }]),
    );
    const records: ProjectRecord[] = [
      ...projects.flatMap((project) =>
        SPEC_CASES.map((caseId) => ({
          project,
          record: { case: caseId, target: project.slice("browser:".length), layers },
        })),
      ),
      ...extra.map((project) => ({
        project,
        record: { case: LISTBOX, target: "react", layers },
      })),
    ];
    const all = [...projects, ...extra];
    return stringifyMatrix(
      buildPartialMatrix({
        run: runName(all, ALL),
        projects: all,
        records,
        finishedAt,
        mode: { update: false, pixels: "live", canary: null },
        filtered: null,
        shard: null,
        empty: [],
        quarantine: [],
      }),
    );
  }
  const file = (targets: readonly string[]) =>
    join(
      reportsDir,
      `parity-matrix.${runName(
        targets.map((target) => `browser:${target}`),
        ALL,
      )}.json`,
    );
  function writeBatches(batches: readonly (readonly string[])[]): void {
    batches.forEach((targets, index) =>
      writeFileSync(file(targets), batch(targets, new Date(Date.now() + index).toISOString())),
    );
  }

  it("reads the mode from the script's arguments, and refuses any other argument", () => {
    expect(job).toEqual({ requireComplete: true, browserOnly: true });
    expect(parityJob(ci)).toEqual({ requireComplete: true, browserOnly: false });
    expect(() => parityJob(ci, ["--browser"])).toThrow("Unknown argument: --browser.");
  });

  it("expects the layers every browser test records: L7 to L11 and L13", () => {
    expect(BROWSER_ONLY_LAYERS).toEqual(["L7", "L8", "L9", "L10", "L11", "L13"]);
  });

  it("is green with the three batches, though no browser project records a diagnostics case", () => {
    expect(SPEC_CASES.length).toBeLessThan(CASES.length);
    writeBatches(BATCHES);
    expect(runSummary(ci, { ...job, reportsDir })).toBe(0);
    expect(problems).toBe("");
  });

  it.each(BATCHES.map((targets) => [targets.join(","), targets] as const))(
    "fails without the batch %s: its followers' cells are missing",
    (_name, missing) => {
      writeBatches(BATCHES.filter((targets) => targets !== missing));
      expect(runSummary(ci, { ...job, reportsDir })).toBe(1);
      for (const target of missing.filter((name) => name !== "vue")) {
        // React still ran the listbox case in the other batches, so only its cells are missing.
        if (target !== "react") {
          expect(problems).toContain(
            `browser:${target}: did not run (no parity matrix has its records).`,
          );
        }
        expect(problems).toContain(
          `${SPEC_CASES[0]!} › ${target} › L7: missing (no test recorded it).`,
        );
      }
      expect(problems).not.toMatch(/^ {2}(compile|harness|toolchain:|ssr:|bench)/m);
      expect(problems).not.toContain("diagnostics/");
    },
  );

  it("still fails a failed cell, L14 included where a browser test recorded it", () => {
    writeBatches(BATCHES);
    const path = file(BATCHES[1]!);
    const matrix = JSON.parse(readFileSync(path, "utf8"));
    matrix.byProject["browser:solid"][SPEC_CASES[0]!].solid.L8 = "fail: clicked nothing";
    matrix.byProject["browser:angular"][SPEC_CASES[0]!].angular.L14 = "fail: the map is off";
    writeFileSync(path, JSON.stringify(matrix));
    expect(runSummary(ci, { ...job, reportsDir })).toBe(1);
    expect(problems).toContain(`${SPEC_CASES[0]!} › solid › L8: fail: clicked nothing`);
    expect(problems).toContain(`${SPEC_CASES[0]!} › angular › L14: fail: the map is off`);
  });

  it("fails a missing browser cell of a case with a spec", () => {
    writeBatches(BATCHES);
    const path = file(BATCHES[2]!);
    const matrix = JSON.parse(readFileSync(path, "utf8"));
    delete matrix.byProject["browser:qwik"][SPEC_CASES[0]!].qwik.L10;
    writeFileSync(path, JSON.stringify(matrix));
    expect(runSummary(ci, { ...job, reportsDir })).toBe(1);
    expect(problems).toContain(`${SPEC_CASES[0]!} › qwik › L10: missing (no test recorded it).`);
  });

  it("without the mode, still expects every project of CI's parity job", () => {
    writeBatches(BATCHES);
    expect(runSummary(ci, { ...parityJob(ci), reportsDir })).toBe(1);
    expect(problems).toContain("compile: did not run (no parity matrix has its records).");
  });
});
