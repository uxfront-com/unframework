// The browser layers on Playwright: L7, L8, L9, L10, L11 and L13 against a target's static Storybook
// build, with pages in parallel. `test:browser <target> [cases…]` runs it. The mode comes from the
// environment, as `vitest.config.ts` reads it (ADR-0019, ADR-0029), and beside it:
//
//   UF_WORKERS=…  how many pages run at once, CI's 3 by default
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "@playwright/test";
import type { PlaywrightTestConfig, ReporterDescription } from "@playwright/test";
import { launchArguments } from "@unframework/testing/node";

import { browserRun } from "./harness/browser-run.ts";
import { LOAD_FAILURES } from "./harness/load-failures.ts";
import { CANARY_DIR, reportsDirOf, ROOT } from "./harness/paths.ts";
import { browserProjectName, PLAYWRIGHT_RULES, workersOf } from "./harness/playwright-rules.ts";
import { selectTargets } from "./harness/targets.ts";

const run = browserRun();
const { browser = "chromium", canary } = run.mode;
const canaryDir = canary ? join(CANARY_DIR, canary) : undefined;

const reporter: ReporterDescription = [
  fileURLToPath(import.meta.resolve("@unframework/testing/driver/reporter")),
  {
    reportsDir: reportsDirOf(browser),
    harness: run.harness,
    // A run restricted with UF_TARGETS or `--project` is partial: it is not named `all`.
    allProjects: selectTargets(undefined).map(browserProjectName),
    specCount: run.specCount,
    ...(run.filter ? { filter: run.filter } : {}),
    ...(canaryDir ? { canaryDir, loadFailures: join(canaryDir, LOAD_FAILURES) } : {}),
  },
];

const config: PlaywrightTestConfig = defineConfig({
  ...PLAYWRIGHT_RULES,
  testDir: join(ROOT, "harness"),
  testMatch: "browser.pw.ts",
  outputDir: join(reportsDirOf(browser), "playwright"),
  workers: workersOf(process.env),
  reporter: [reporter],
  use: {
    browserName: browser,
    // Headed runs inherit the host's device pixel ratio; the captures need DPR 1.
    headless: true,
    // Firefox and WebKit have no such switches; their captures compare live within the engine.
    launchOptions: { args: launchArguments(browser) },
  },
  projects: run.targets.map((target) => ({
    name: browserProjectName(target),
    metadata: { target },
  })),
});

export default config;
