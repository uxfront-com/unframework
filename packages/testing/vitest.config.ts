import { playwright } from "@vitest/browser-playwright";
import { configDefaults, defineConfig } from "vitest/config";
import type { ViteUserConfig } from "vitest/config";

/**
 * Two projects: `unit` runs `test/**\/*.test.ts` in Node, and `browser` runs
 * `test/**\/*.browser.test.ts` in headless Chromium, for code that needs a live DOM.
 */
const config: ViteUserConfig = defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["test/**/*.test.ts"],
          exclude: [...configDefaults.exclude, "test/**/*.browser.test.ts"],
        },
      },
      {
        test: {
          name: "browser",
          include: ["test/**/*.browser.test.ts"],
          browser: {
            enabled: true,
            provider: playwright(),
            // Always headless: headed runs inherit the host's device pixel ratio.
            headless: true,
            // Named, or Vitest calls the project "browser (chromium)".
            instances: [{ browser: "chromium", name: "browser" }],
            screenshotFailures: false,
          },
        },
      },
    ],
  },
});

export default config;
