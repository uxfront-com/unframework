import { playwright } from "@vitest/browser-playwright";
import { configDefaults, defineConfig } from "vitest/config";
import type { ViteUserConfig } from "vitest/config";

import { browserProject } from "./test/render-parity-node.ts";

/**
 * `unit` runs in Node. `browser` runs `test/**\/*.browser.test.ts` in headless Chromium: the
 * render-parity kit's live-DOM half needs a real DOM to be tested, on every case's expected
 * tree, which the kit's plugin lists without a target to serve components for.
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
      browserProject({ provider: playwright(), modules: {} }),
    ],
  },
});

export default config;
