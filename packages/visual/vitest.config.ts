import { playwright } from "@vitest/browser-playwright";
import { configDefaults, defineConfig } from "vitest/config";
import type { ViteUserConfig } from "vitest/config";

import { ufReportFixture } from "./test/report-fixture.ts";
import { ufShellColorScheme, ufShellFixture } from "./test/shell-fixture.ts";

/** The files that start a preview's servers, up to eight Vite servers and a browser at a time. */
const PREVIEW_FILES = ["test/preview.test.ts", "test/preview-build.test.ts"];

/**
 * Three projects: `unit` runs `test/**\/*.test.ts` in Node, and `browser` runs
 * `test/**\/*.browser.test.ts` in headless Chromium, for the report's page and the preview's shell. The fixture projects
 * under `test/fixtures/` are never this package's tests: a visual run on one generates its specs
 * there, for its own browser projects. `preview` runs the files that start a preview's servers,
 * one at a time and after the other two: side by side, their servers ran the machine out of
 * ports, and a frame's render raced the load.
 */
const config: ViteUserConfig = defineConfig({
	test: {
		projects: [
			{
				test: {
					name: "unit",
					environment: "node",
					include: ["test/**/*.test.ts"],
					exclude: [
						...configDefaults.exclude,
						"test/fixtures/**",
						"test/**/*.browser.test.ts",
						...PREVIEW_FILES,
					],
				},
			},
			{
				test: {
					name: "preview",
					environment: "node",
					include: PREVIEW_FILES,
					fileParallelism: false,
					sequence: { groupOrder: 1 },
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
						commands: { ufReportFixture, ufShellFixture, ufShellColorScheme },
					},
				},
			},
		],
	},
});

export default config;
