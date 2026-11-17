// The Solid 2 target's toolchain (plan §5.7): how tests and tooling build, check and run Solid 2
// output. Node only; the main entry never imports it. Solid 2, its compiler and its Vite plugin
// load from `context.toolchainDir` (ADR-0102), as Angular's compiler stack does.
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { Toolchain, ToolchainContext } from "@unframework.dev/codegen";
import { lintWithOxlint, typecheckWithTsgo } from "@unframework.dev/codegen/toolchain-node";
import type { PluginOption, UserConfig } from "vite";

import { compileWithSolid, emitWithSolid } from "./compile.ts";
import { solidAliases, undedupeSolid } from "./resolve.ts";

/** The runtime modules compiled output and the mount adapter import in the browser. */
const BROWSER_RUNTIME = ["solid-js", "@solidjs/web"];

/** The part of @solidjs/vite-plugin this toolchain calls. */
type SolidPlugin = (options: {
  ssr?: boolean;
  refresh?: boolean;
  dev?: boolean;
}) => PluginOption;

/** @solidjs/vite-plugin, from the toolchain directory. */
async function loadPlugin(context: ToolchainContext): Promise<SolidPlugin> {
  const require = createRequire(join(context.toolchainDir, "package.json"));
  const entry = require.resolve("@solidjs/vite-plugin");
  return ((await import(pathToFileURL(entry).href)) as { default: SolidPlugin }).default;
}

/** The Solid 2 toolchain. */
export const toolchain: Toolchain = {
  name: "solid2",
  client: "@unframework.dev/target-solid2/toolchain/client",
  server: "@unframework.dev/target-solid2/toolchain/server",
  hydrate: "@unframework.dev/target-solid2/toolchain/hydrate",

  async vite(mode, context): Promise<UserConfig> {
    // Loaded here, not at the top: the harness imports every toolchain to build its config.
    const solid = await loadPlugin(context);
    return {
      plugins: [
        solid({
          // As on Solid 1: server output is hydratable, and in a hydrate project (L12, ADR-0095)
          // the client's too, so `hydrate` finds the server's nodes; a browser project keeps the
          // plain DOM compile.
          ssr: mode !== "browser",
          // solid-refresh would wrap the code under test in HMR proxies.
          refresh: false,
        }),
        undedupeSolid(),
      ],
      // Every import of Solid 2, from an output, an adapter or Solid itself, resolves in the
      // toolchain directory (ADR-0102).
      resolve: { alias: solidAliases(context.toolchainDir) },
      // Vite's dependency scanner never sees compiled modules (the unplugin hides them from
      // it), so name their runtime imports, or a cold run reloads the page mid-test.
      ...(mode === "ssr" ? {} : { optimizeDeps: { include: BROWSER_RUNTIME } }),
    };
  },

  frameworkCompile: (files, context) => compileWithSolid(files, context),

  frameworkEmit: (files, context) => emitWithSolid(files, context),

  typecheck: (files, context) => typecheckWithTsgo(files, context),

  // L5: oxlint, with the shared baseline and eslint-plugin-solid's v2 rules as a JS plugin
  // (ADR-0042, ADR-0102).
  lint: (files, context) => lintWithOxlint(files, context),
};

export default toolchain;
