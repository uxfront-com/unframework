import { fileURLToPath } from "node:url";

import { toolchain as astro } from "@unframework/target-astro/toolchain";
import { playwright } from "@vitest/browser-playwright";
import { configDefaults, defineConfig } from "vitest/config";
import type { ViteUserConfig } from "vitest/config";

/**
 * Astro's mount adapter renders through its toolchain's `ufAstroRender` browser command, and
 * reads what a browser project's `astroBrowserRef` plugin recorded: both are installed in the
 * browser project, for test/astro-rerender.browser.test.ts. The command's render server is
 * rooted at the Astro target, whose dependencies hold Astro.
 */
const astroContext = {
  root: fileURLToPath(new URL("../target-astro", import.meta.url)),
  toolchainDir: fileURLToPath(new URL("../../tests/toolchains/astro", import.meta.url)),
};
const astroBrowser = await astro.vite("browser", astroContext);

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
        plugins: astroBrowser.plugins ?? [],
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
            commands: astro.browserCommands?.(astroContext) ?? {},
          },
        },
      },
    ],
  },
});

export default config;
