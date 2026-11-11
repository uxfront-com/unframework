import { join } from "node:path";

import { defineConfig } from "@playwright/test";

import { e2eRoot, findApps, workDir } from "./harness/apps.ts";

export default defineConfig({
  forbidOnly: true,
  retries: 0,
  // A project's specs share one working copy, and an HMR spec edits it, so nothing runs beside it.
  workers: 1,
  reporter: "list",
  // Outside the repository, like the copies.
  outputDir: join(workDir(), ".results"),
  globalSetup: "./harness/global-setup.ts",
  globalTeardown: "./harness/global-teardown.ts",
  use: { browserName: "chromium" },
  // Found on disk, so that a later app or mode adds its specs without editing this file.
  projects: findApps().flatMap((app) =>
    app.modes.map((mode) => ({
      name: `${app.name}:${mode}`,
      testDir: join(e2eRoot, "apps", app.name, "e2e", mode),
      metadata: { app: app.name, mode },
    })),
  ),
});
