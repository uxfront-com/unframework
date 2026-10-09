// The integration harness (plan §7.3): one Vitest run, five kinds of project, every
// layer recorded in the parity matrix. The mode comes from the environment (ADR-0019, ADR-0029):
//
//   UF_UPDATE=1          write artefacts (owners and the reference target only); refused in CI
//   UF_PIXELS=…          `baseline` (Linux default) or `live` (elsewhere)
//   UF_CANARY=<id>       install a canary compiler plugin (`pnpm test:canaries`)
//   UF_TARGETS=vue,react restrict the targets
import { join } from "node:path";

import { createHarnessRun, ParityReporter, resolveHarnessMode } from "@unframework/testing/node";
import { defineConfig } from "vitest/config";
import type { ViteUserConfig } from "vitest/config";

import { findCanary } from "./harness/canaries.ts";
import { caseConfigs, listCases } from "./harness/cases.ts";
import { LOAD_FAILURES, LoadFailureReporter } from "./harness/load-failures.ts";
import { CANARY_DIR, CASES_DIR, REPORTS_DIR, ROOT } from "./harness/paths.ts";
import {
  harnessProjects,
  projectNames,
  projectPatterns,
  referencesOnly,
} from "./harness/projects.ts";
import { QUARANTINE, validateQuarantine } from "./harness/quarantine.ts";
import { REFERENCE, selectTargets } from "./harness/targets.ts";

const mode = resolveHarnessMode({
  env: process.env,
  platform: process.platform,
  argv: process.argv,
});
const targets = selectTargets(process.env.UF_TARGETS);
if (mode.update && !targets.includes(REFERENCE)) {
  throw new Error(
    `[uf] Update mode needs the reference target (${REFERENCE}) to write the shared artefacts: add it to UF_TARGETS.`,
  );
}
if (mode.canary) findCanary(mode.canary);

const cases = listCases(CASES_DIR);
const problems = validateQuarantine(QUARANTINE, {
  cases: cases.map((info) => info.id),
  targets: selectTargets(undefined),
});
if (problems.length) throw new Error(`[uf] The quarantine is invalid:\n  ${problems.join("\n  ")}`);

const harness = createHarnessRun({
  root: ROOT,
  casesDir: CASES_DIR,
  reference: REFERENCE,
  mode,
  quarantine: [...QUARANTINE],
  cases: caseConfigs(cases),
});

const config: ViteUserConfig = defineConfig({
  test: {
    reporters: [
      "default",
      new ParityReporter({
        reportsDir: REPORTS_DIR,
        // A run restricted with UF_TARGETS is partial: it is not named `all`.
        allProjects: projectNames(selectTargets(undefined)),
        ...(mode.canary ? { canaryDir: join(CANARY_DIR, mode.canary) } : {}),
      }),
      // A canary run's specs that could not load: the evidence of the golden guard in a
      // browser project, where no test records a cell.
      ...(mode.canary
        ? [
            new LoadFailureReporter({
              file: join(CANARY_DIR, mode.canary, LOAD_FAILURES),
              root: ROOT,
            }),
          ]
        : []),
    ],
    projects: harnessProjects({
      harness,
      mode,
      targets,
      projectFilter: projectPatterns(process.argv),
      // A case's own reference runs on that case where UF_TARGETS leaves it out (ADR-0057).
      referencesOnly: referencesOnly(caseConfigs(cases), targets),
    }),
  },
});

export default config;
