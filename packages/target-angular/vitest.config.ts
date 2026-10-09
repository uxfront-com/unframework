import { fileURLToPath } from "node:url";

import { playwright } from "@vitest/browser-playwright";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import type { ViteUserConfig } from "vitest/config";

import { toolchain } from "./src/toolchain/index.ts";
import { corpusOutputs } from "./test/corpus-plugin.ts";

/** The tests that render on Angular's server platform. */
const SSR = ["test/render.test.ts", "test/server.test.ts"];

const context = {
  toolchainDir: fileURLToPath(new URL("../../tests/toolchains/angular", import.meta.url)),
  root: fileURLToPath(new URL(".", import.meta.url)),
};
const ssr = await toolchain.vite("ssr", context);
const browser = await toolchain.vite("browser", context);

/**
 * The toolchain compiles the unframework plugin's virtual modules, and requires the plugin. These
 * tests compile their components with the ngtsc plugin themselves: there is none to serve.
 */
const noVirtualModules = { name: "unframework", api: { getCompiled: () => undefined } } as Plugin;

/** Most tests run ngtsc or Angular's renderer: seconds each on a loaded CI runner. */
const testTimeout = 30_000;

/**
 * Vitest serves every project's transforms from one main thread, and the browser project's ngtsc
 * plugin compiles the corpus's components there synchronously, a block that grows with the
 * corpus. An SSR render that waited behind it took 13.8 s to 30 s in CI's Unit tests, against
 * 0.8 s alone. So `ssr` runs first, on its own, and `unit` and `browser` start after it.
 */
const afterSsr = { groupOrder: 1 };

/**
 * `unit` runs in plain Node. `ssr` runs the renderer tests on the toolchain's own SSR Vite
 * configuration, as the ssr:angular project does: Angular's packages linked as they load, and
 * no JIT compiler. `browser` mounts the corpus's components, as this target emits them now, in
 * headless Chromium with the toolchain's own browser configuration and mount adapter, as the
 * browser:angular project does (test/*.browser.test.ts).
 */
const config: ViteUserConfig = defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["test/*.test.ts"],
          exclude: [...SSR, "test/*.browser.test.ts"],
          environment: "node",
          testTimeout,
          sequence: afterSsr,
        },
      },
      {
        ...ssr,
        plugins: [noVirtualModules, ...(ssr.plugins ?? [])],
        test: { ...ssr.test, name: "ssr", include: SSR, environment: "node", testTimeout },
      },
      {
        ...browser,
        plugins: [corpusOutputs(), ...(browser.plugins ?? [])],
        // The dependency scanner cannot load the virtual modules the tests import: it scans no
        // test file, and the toolchain lists what the adapter and the components import.
        optimizeDeps: { ...browser.optimizeDeps, entries: [] },
        test: {
          ...browser.test,
          name: "browser",
          include: ["test/*.browser.test.ts"],
          testTimeout,
          sequence: afterSsr,
          browser: {
            enabled: true,
            provider: playwright(),
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
