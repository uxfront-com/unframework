import { fileURLToPath } from "node:url";

import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import type { ViteUserConfig } from "vitest/config";

import { toolchain } from "./src/toolchain/index.ts";

/** The tests that render on Angular's server platform. */
const SSR = ["test/render.test.ts", "test/server.test.ts"];

const context = {
  toolchainDir: fileURLToPath(new URL("../../tests/toolchains/angular", import.meta.url)),
  root: fileURLToPath(new URL(".", import.meta.url)),
};
const ssr = await toolchain.vite("ssr", context);

/**
 * The toolchain compiles the unframework plugin's virtual modules, and requires the plugin. These
 * tests compile their components with the ngtsc plugin themselves: there is none to serve.
 */
const noVirtualModules = { name: "unframework", api: { getCompiled: () => undefined } } as Plugin;

/** Most tests run ngtsc or Angular's renderer: seconds each on a loaded CI runner. */
const testTimeout = 30_000;

/**
 * `unit` runs in plain Node. `ssr` runs the renderer tests on the toolchain's own SSR Vite
 * configuration, as the ssr:angular project does: Angular's packages linked as they load, and
 * no JIT compiler.
 */
const config: ViteUserConfig = defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["test/*.test.ts"],
          exclude: SSR,
          environment: "node",
          testTimeout,
        },
      },
      {
        ...ssr,
        plugins: [noVirtualModules, ...(ssr.plugins ?? [])],
        test: { ...ssr.test, name: "ssr", include: SSR, environment: "node", testTimeout },
      },
    ],
  },
});

export default config;
