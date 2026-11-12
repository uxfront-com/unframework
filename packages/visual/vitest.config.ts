import { playwright } from "@vitest/browser-playwright";
import { configDefaults, defineConfig } from "vitest/config";
import type { ViteUserConfig } from "vitest/config";

import { ufReportFixture } from "./test/report-fixture.ts";

/**
 * Two projects: `unit` runs `test/**\/*.test.ts` in Node, and `browser` runs
 * `test/**\/*.browser.test.ts` in headless Chromium, for the report's page. The fixture projects
 * under `test/fixtures/` are never this package's tests: a visual run on one generates its specs
 * there, for its own browser projects.
 */
const config: ViteUserConfig = defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["test/**/*.test.ts"],
          exclude: [...configDefaults.exclude, "test/fixtures/**", "test/**/*.browser.test.ts"],
        },
      },
      {
        test: {
          name: "browser",
          include: ["test/**/*.browser.test.ts"],
          setupFiles: ["./test/setup.browser.ts"],
          // The matchers name the target in their messages: this page belongs to none.
          provide: { target: "report" },
          browser: {
            enabled: true,
            provider: playwright(),
            // Always headless: headed runs inherit the host's device pixel ratio.
            headless: true,
            // Named, or Vitest calls the project "browser (chromium)".
            instances: [{ browser: "chromium", name: "browser" }],
            screenshotFailures: false,
            // A desktop window, where the grid holds seven cells across: one test narrows it.
            viewport: { width: 1280, height: 800 },
            commands: { ufReportFixture },
          },
        },
      },
    ],
  },
});

export default config;
