import type { Toolchain } from "@unframework/codegen";
import {
  lintWithEslint,
  lintWithOxlint,
  mergeLintResults,
} from "@unframework/codegen/toolchain-node";
import type { UserConfig } from "vite";

import { frameworkCompile } from "./framework-compile.ts";
import { typecheck } from "./typecheck.ts";

/**
 * The Svelte target's toolchain, for tests and tooling: @sveltejs/vite-plugin-svelte in Vite,
 * Svelte's own compiler for L3, svelte-check for L4, oxlint and eslint-plugin-svelte for L5, and
 * the `mount` and `svelte/server` adapters.
 */
export const toolchain: Toolchain = {
  name: "svelte",
  async vite(mode): Promise<UserConfig> {
    // Loaded on demand: reading `client` or `server` should not load the Vite plugin.
    const { svelte } = await import("@sveltejs/vite-plugin-svelte");
    return {
      // The toolchain is the whole configuration: no svelte.config.js is looked up (or logged
      // as missing).
      plugins: svelte({ configFile: false }),
      resolve: { dedupe: ["svelte"] },
      // The dependency scanner never sees compiled output: list the runtime entries it imports,
      // or the first run discovers them late and reloads mid-test.
      ...(mode === "browser"
        ? {
            optimizeDeps: {
              include: ["svelte", "svelte/internal/client", "svelte/internal/disclose-version"],
            },
          }
        : {}),
    };
  },
  client: "@unframework/target-svelte/toolchain/client",
  server: "@unframework/target-svelte/toolchain/server",
  frameworkCompile,
  typecheck,
  // L5 (ADR-0042): oxlint's shared baseline over the script block, ESLint over the whole file.
  lint: async (files, context) =>
    mergeLintResults(
      await Promise.all([lintWithOxlint(files, context), lintWithEslint(files, context)]),
    ),
};

export default toolchain;
