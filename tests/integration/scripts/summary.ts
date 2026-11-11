// `pnpm --filter @unframework.dev/integration summary` (plan §7.4): merges every partial parity
// matrix into `.reports/parity-matrix.json` and `.md`, appends the Markdown to
// $GITHUB_STEP_SUMMARY in CI, and fails on any failed cell and, when every project ran (or, in
// CI's parity job, must have), on any missing project and (case, target, live layer) cell. With
// UF_BROWSER set to another engine, it merges that engine's directory into
// `parity-matrix.<engine>.json` and `.md` there (ADR-0066).
//
// `summary -- --browser-only` judges a run of the browser projects alone: the nightly's WebKit
// job, which runs them in three Vitest runs and merges their matrices here (ADR-0081). It
// expects only the `browser:` projects, the layers every browser test records and the cases
// with a spec, and in CI it still requires all of them, so a batch that never reported fails.
import { join } from "node:path";

import { CAPABILITY_NAMES } from "@unframework.dev/codegen";
import {
  BROWSER_LAYERS,
  resolveBrowser,
  summaryName,
  writeSummary,
} from "@unframework.dev/testing/node";
import type { LayerName } from "@unframework.dev/testing/node";

import { listCases } from "../harness/cases.ts";
import { reportsDirOf } from "../harness/paths.ts";
import { BENCH_PROJECT, parityProjects, projectNames } from "../harness/projects.ts";
import { LIVE_LAYERS } from "../harness/quarantine.ts";
import { selectTargets } from "../harness/targets.ts";
import { isCI } from "./vitest.ts";

/** What to summarise, and how strictly. */
export interface SummaryRun {
  /**
   * Whether every project must have reported. CI's parity job merges one partial matrix per
   * job, so there a project without records is a job that never reported, not a subset someone
   * chose. A run of `scripts/run.ts` judges the projects it selected: its own partial matrix
   * lists every one of them, so a run of all of them is checked for completeness anyway, and a
   * run of some of them (`pnpm test:baselines:check` runs the browser projects) is a partial run.
   */
  requireComplete: boolean;
  /** Only the matrices written after this time: a run summarises itself, not leftovers. */
  since?: Date | undefined;
  /** Where the partial matrices are; the engine's directory (`reportsDirOf`) by default. */
  reportsDir?: string | undefined;
  /**
   * Whether only the browser projects ran (ADR-0081): the run expects `browser:<target>` for
   * its targets, the live layers every browser test records (`BROWSER_ONLY_LAYERS`) and only
   * the cases a browser project loads. The other projects and layers are not judged.
   */
  browserOnly?: boolean | undefined;
}

/**
 * The live layers every browser test records. L14 is a browser layer only where a test wraps a
 * step in `view.expectThrown`, and the `compile` project records it for every case, so a run of
 * the browser projects alone leaves it out (a browser test's L14 is still judged where it ran).
 */
export const BROWSER_ONLY_LAYERS: readonly LayerName[] = BROWSER_LAYERS.filter(
  (layer) => layer !== "L14" && LIVE_LAYERS.includes(layer),
);

/** Writes the summary and returns the exit status: 1 when anything is not green. */
export function runSummary(env: NodeJS.ProcessEnv, run: SummaryRun): number {
  let where: string;
  let result: ReturnType<typeof writeSummary>;
  try {
    const browser = resolveBrowser(env);
    const reportsDir = run.reportsDir ?? reportsDirOf(browser);
    where = join(reportsDir, `${summaryName(browser)}.md`);
    const targets = selectTargets(env.UF_TARGETS);
    const cases = listCases();
    result = writeSummary({
      reportsDir,
      expected: run.browserOnly
        ? {
            projects: targets.map((target) => `browser:${target}`),
            // A diagnostics case has no spec, so no browser project loads it: `compile` records
            // its browser layers as skipped (`NO_SPEC_SKIP`). A feature case without a spec is
            // still expected, and stays a missing cell, as `compile` leaves it.
            cases: cases
              .filter((info) => info.spec || !info.id.startsWith("diagnostics/"))
              .map((info) => info.id),
            targets,
            liveLayers: BROWSER_ONLY_LAYERS,
            notLiveReason: "not live yet, or not a layer of a browser-only run",
            capabilities: CAPABILITY_NAMES,
          }
        : {
            // `bench` is outside the default run (ADR-0078), so only CI's parity job requires it.
            projects: run.requireComplete ? parityProjects(targets) : projectNames(targets),
            cases: cases.map((info) => info.id),
            targets,
            liveLayers: LIVE_LAYERS,
            notLiveReason: "not live yet",
            recordedOnlyBy: { L15: BENCH_PROJECT },
            // A skip by capability names one of these (ADR-0050).
            capabilities: CAPABILITY_NAMES,
          },
      stepSummary: env.GITHUB_STEP_SUMMARY,
      since: run.since,
      requireComplete: run.requireComplete,
      browser,
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
  if (!result.problems.length) {
    process.stdout.write(
      `[uf:summary] The parity matrix is green${result.complete ? "" : " (partial run)"}: ${where}\n`,
    );
    return 0;
  }
  console.error(
    `[uf:summary] ${result.problems.length} problem(s) in the parity matrix (${where}):\n  ${result.problems.join("\n  ")}`,
  );
  return 1;
}

/**
 * How the script itself summarises: it is CI's parity job, which merges the partial matrices
 * of every job, so in CI every project must have reported.
 */
export function parityJob(env: NodeJS.ProcessEnv, args: readonly string[] = []): SummaryRun {
  const unknown = args.filter((arg) => arg !== "--" && arg !== "--browser-only");
  if (unknown.length) throw new Error(`[uf:summary] Unknown argument: ${unknown.join(" ")}.`);
  return { requireComplete: isCI(env), browserOnly: args.includes("--browser-only") };
}

if (import.meta.main) {
  try {
    process.exitCode = runSummary(process.env, parityJob(process.env, process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
