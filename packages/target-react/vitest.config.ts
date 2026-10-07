import { fileURLToPath } from "node:url";

import { playwright } from "@vitest/browser-playwright";
import { configDefaults, defineConfig } from "vitest/config";
import type { ViteUserConfig } from "vitest/config";

import { browserProject } from "../codegen/test/render-parity-node.ts";
import target from "./src/index.ts";
import { toolchain } from "./src/toolchain/index.ts";
import { behaviourModules } from "./test/behaviour-modules.ts";

const context = {
  root: fileURLToPath(new URL(".", import.meta.url)),
  toolchainDir: fileURLToPath(new URL("../../tests/toolchains/react", import.meta.url)),
};

/**
 * `unit` runs in Node. `browser` mounts the render-parity components in headless Chromium with
 * the toolchain's own Vite configuration and mount adapter (test/render-parity.browser.test.ts),
 * and the behaviour components the target emits (test/behaviour.browser.test.ts).
 */
const vite = await toolchain.vite("browser", context);
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
        vite: { ...vite, plugins: [behaviourModules(), ...(vite.plugins ?? [])] },
        modules: { target, extension: ".tsx", formatted: true },
      }),
    ],
  },
});

export default config;
