// `pnpm --filter @unframework/integration summary` (plan §7.4): merges every partial parity
// matrix into `.reports/parity-matrix.json` and `.md`, appends the Markdown to
// $GITHUB_STEP_SUMMARY in CI, and fails on any failed cell and, when every project ran (or, in
// CI's parity job, must have), on any missing project and (case, target, live layer) cell. With
// UF_BROWSER set to another engine, it merges that engine's directory into
// `parity-matrix.<engine>.json` and `.md` there (ADR-0066).
import { join } from "node:path";

import { CAPABILITY_NAMES } from "@unframework/codegen";
import { resolveBrowser, summaryName, writeSummary } from "@unframework/testing/node";

import { listCases } from "../harness/cases.ts";
import { reportsDirOf } from "../harness/paths.ts";
import { projectNames } from "../harness/projects.ts";
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
}

/** Writes the summary and returns the exit status: 1 when anything is not green. */
export function runSummary(env: NodeJS.ProcessEnv, run: SummaryRun): number {
  let where: string;
  let result: ReturnType<typeof writeSummary>;
  try {
    const browser = resolveBrowser(env);
    const reportsDir = run.reportsDir ?? reportsDirOf(browser);
    where = join(reportsDir, `${summaryName(browser)}.md`);
    const targets = selectTargets(env.UF_TARGETS);
    result = writeSummary({
      reportsDir,
      expected: {
        projects: projectNames(targets),
        cases: listCases().map((info) => info.id),
        targets,
        liveLayers: LIVE_LAYERS,
        notLiveReason: "not live in M2",
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
export function parityJob(env: NodeJS.ProcessEnv): SummaryRun {
  return { requireComplete: isCI(env) };
}

if (import.meta.main) process.exitCode = runSummary(process.env, parityJob(process.env));
