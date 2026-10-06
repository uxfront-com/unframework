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
 * The Vue target's toolchain, for tests and tooling: @vitejs/plugin-vue in Vite, Vue's own
 * compiler for L3, vue-tsc for L4, oxlint and eslint-plugin-vue for L5, and the `createApp` and
 * `vue/server-renderer` adapters.
 */
export const toolchain: Toolchain = {
  name: "vue",
  async vite(mode): Promise<UserConfig> {
    // Loaded on demand: reading `client` or `server` should not load the Vite plugin.
    const { default: vue } = await import("@vitejs/plugin-vue");
    return {
      // By default plugin-vue turns static asset URLs in templates into imports (under a dev
      // server `src="/a.png"` renders as `/@fs/a.png`), which no other target does.
      plugins: [vue({ template: { transformAssetUrls: false } })],
      resolve: { dedupe: ["vue"] },
      // The dependency scanner never sees compiled output, and plugin-vue adds nothing to the
      // optimizer: without this, the first run discovers `vue` late and reloads mid-test.
      ...(mode === "browser" ? { optimizeDeps: { include: ["vue"] } } : {}),
    };
  },
  client: "@unframework/target-vue/toolchain/client",
  server: "@unframework/target-vue/toolchain/server",
  frameworkCompile,
  typecheck,
  // L5 (ADR-0042): oxlint's shared baseline over the script block, ESLint over the whole file.
  lint: async (files, context) =>
    mergeLintResults(
      await Promise.all([lintWithOxlint(files, context), lintWithEslint(files, context)]),
    ),
};

export default toolchain;
