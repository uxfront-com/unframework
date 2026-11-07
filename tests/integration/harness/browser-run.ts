// What a Playwright run of the browser layers knows, the same in its config and in each worker:
// the mode from the environment (ADR-0019, ADR-0029), the targets, the cases and their spec files.
import { createHarnessRun, resolveHarnessMode, sharedRunId } from "@unframework/testing/node";
import type { HarnessContext, HarnessMode } from "@unframework/testing/node";

import { findCanary } from "./canaries.ts";
import type { CaseInfo } from "./cases.ts";
import { caseConfigs, listCases, selectCases } from "./cases.ts";
import { CASES_DIR, ROOT } from "./paths.ts";
import { QUARANTINE, validateQuarantine } from "./quarantine.ts";
import { REFERENCE, selectTargets } from "./targets.ts";

/** The cases a `test:browser <target> <case>…` keeps, comma-separated. */
export const BROWSER_CASES_ENV = "UF_BROWSER_CASES";

/** One run of the browser layers. */
export interface BrowserRun {
  mode: HarnessMode;
  harness: HarnessContext;
  targets: readonly string[];
  cases: readonly CaseInfo[];
  /** The spec files the run declares, absolute. */
  specs: readonly string[];
  /** How many spec files the corpus holds. */
  specCount: number;
  /** Why the run keeps some cases alone. */
  filter: string | undefined;
}

/** The spec files of some cases. */
function specsOf(cases: readonly CaseInfo[]): string[] {
  return cases.flatMap((info) => (info.spec ? [info.spec] : []));
}

/** Reads the run from the environment. */
export function browserRun(
  env: NodeJS.ProcessEnv = process.env,
  argv: readonly string[] = process.argv,
): BrowserRun {
  const mode = resolveHarnessMode({ env, platform: process.platform, argv });
  if (mode.canary) findCanary(mode.canary);
  const cases = listCases(CASES_DIR);
  const problems = validateQuarantine(QUARANTINE, {
    cases: cases.map((info) => info.id),
    targets: selectTargets(undefined),
  });
  if (problems.length) {
    throw new Error(`[uf] The quarantine is invalid:\n  ${problems.join("\n  ")}`);
  }
  const kept = env[BROWSER_CASES_ENV];
  return {
    mode,
    harness: createHarnessRun({
      root: ROOT,
      casesDir: CASES_DIR,
      reference: REFERENCE,
      mode,
      quarantine: [...QUARANTINE],
      cases: caseConfigs(cases),
      runId: sharedRunId(env),
    }),
    targets: selectTargets(env.UF_TARGETS),
    cases,
    specs: specsOf(selectCases(cases, kept)),
    specCount: specsOf(cases).length,
    filter: kept ? `cases ${kept}` : undefined,
  };
}
