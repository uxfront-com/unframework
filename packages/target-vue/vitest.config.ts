import { fileURLToPath } from "node:url";

import { playwright } from "@vitest/browser-playwright";
import { configDefaults, defineConfig } from "vitest/config";
import type { ViteUserConfig } from "vitest/config";

import { browserProject } from "../codegen/test/render-parity-node.ts";
import target from "./src/index.ts";
import { toolchain } from "./src/toolchain/index.ts";

const context = {
  root: fileURLToPath(new URL(".", import.meta.url)),
  toolchainDir: fileURLToPath(new URL("../../tests/toolchains/vue", import.meta.url)),
};

/**
 * `unit` runs in Node. `browser` mounts the render-parity components in headless Chromium with
 * the toolchain's own Vite configuration and mount adapter (test/render-parity.browser.test.ts).
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
      browserProject({
        provider: playwright(),
        vite: await toolchain.vite("browser", context),
        // The script block is formatted (ADR-0041), so the formatted output differs too.
        modules: { target, extension: ".vue", formatted: true, perCase: true },
      }),
    ],
  },
});

export default config;
