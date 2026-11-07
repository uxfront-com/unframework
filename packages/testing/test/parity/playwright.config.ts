// The testing API's own browser parity suite: the stub specs on the page host, driven as a target's
// are. `pnpm test` runs it after the unit and DOM projects of ../../vitest.config.ts, and the tests
// that read a run's verdict (`./run-stubs.ts`) start it with fail-on-purpose specs. Its environment:
//
//   UF_STUB_SPECS     comma-separated globs under `cases/stub`, `*/*.parity.spec.ts` by default
//   UF_STUB_REPORTS   where the matrix and the records go; the run's own directory by default
//   UF_STUB_COMPLETE  the run covers every project, so a quarantine entry can be stale
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "@playwright/test";
import type { PlaywrightTestConfig } from "@playwright/test";

import { launchArguments, sharedRunId } from "../../src/node/index.ts";
import { fixtureHarness, scratch } from "./project.ts";

/** A directory of this run alone. */
export const runDirectory: string = join(scratch, "runs", sharedRunId());

/** The stub document's build. */
export const stubBuild: string = join(runDirectory, "build");

const reports = process.env.UF_STUB_REPORTS ?? join(runDirectory, "reports");

const config: PlaywrightTestConfig = defineConfig({
  testDir: fileURLToPath(new URL(".", import.meta.url)),
  testMatch: "stub.pw.ts",
  outputDir: join(runDirectory, "results"),
  globalSetup: fileURLToPath(new URL("global-setup.ts", import.meta.url)),
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  // The driver bounds a page that stops answering, and the page each test.
  timeout: 0,
  workers: 2,
  reporter: [
    [
      fileURLToPath(import.meta.resolve("../../src/driver/reporter.ts")),
      {
        reportsDir: reports,
        recordsFile: join(reports, "records.json"),
        harness: fixtureHarness(process.env),
        ...(process.env.UF_STUB_COMPLETE ? { allProjects: ["parity"] } : {}),
      },
    ],
  ],
  use: {
    browserName: "chromium",
    headless: true,
    launchOptions: { args: launchArguments("chromium") },
  },
  projects: [{ name: "parity", metadata: { target: "dom" } }],
});

export default config;
