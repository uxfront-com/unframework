import { fileURLToPath } from "node:url";

import { playwright } from "@vitest/browser-playwright";
import { configDefaults, defineConfig } from "vitest/config";
import type { ViteUserConfig } from "vitest/config";

import { browserProject } from "../codegen/test/render-parity-node.ts";
import target from "./src/index.ts";
import { toolchain } from "./src/toolchain/index.ts";
import { ufSources } from "./test/sources.ts";

const root = fileURLToPath(new URL(".", import.meta.url));
const fixtures = fileURLToPath(new URL("test/fixtures", import.meta.url));
const toolchainDir = fileURLToPath(new URL("../../tests/toolchains/qwik", import.meta.url));

/**
 * `unit` runs in plain Node. `ssr` compiles the fixtures with the toolchain's own SSR Vite
 * configuration, so the server renderer is tested on Qwik's real compiled output. `browser`
 * mounts the render-parity components in headless Chromium with the toolchain's browser
 * configuration (the optimizer, client-side rendering) and its mount adapter, and the behaviour
 * tests' `.uf.tsx` sources as this target emits them (test/sources.ts).
 */
const config: ViteUserConfig = defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["test/*.test.ts"],
          exclude: [...configDefaults.exclude, "test/**/*.browser.test.ts"],
          environment: "node",
        },
      },
      {
        ...(await toolchain.vite("ssr", { root: fixtures, toolchainDir })),
        test: { name: "ssr", include: ["test/ssr/*.test.ts"], environment: "node" },
      },
      browserProject({
        provider: playwright(),
        vite: await (async () => {
          const vite = await toolchain.vite("browser", { root, toolchainDir });
          return { ...vite, plugins: [ufSources(), ...(vite.plugins ?? [])] };
        })(),
        modules: { target, extension: ".tsx", formatted: true },
      }),
    ],
  },
});

export default config;
