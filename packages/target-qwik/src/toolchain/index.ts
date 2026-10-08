// The Qwik target's toolchain (plan §5.7): how tests and tooling build, check and run Qwik
// output. Node only; the main entry never imports it.
import type { Toolchain } from "@unframework/codegen";
import { typecheckWithTsgo } from "@unframework/codegen/toolchain-node";
import type { Plugin, UserConfig } from "vite";

import { compileWithOptimizer } from "./compile.ts";
import { lint } from "./lint.ts";
import { segmentLoads } from "./loads.ts";

/** The Qwik 2 toolchain. */
export const toolchain: Toolchain = {
  name: "qwik",
  client: "@unframework/target-qwik/toolchain/client",
  server: "@unframework/target-qwik/toolchain/server",

  async vite(mode, { root }): Promise<UserConfig> {
    // Loaded here, not at the top: the harness imports every toolchain to build its config.
    const { qwikVite } = await import("@qwik.dev/core/optimizer");
    return {
      plugins: [
        // The mount adapter waits for lazily loaded segments (./loads.ts).
        ...(mode === "browser" ? [segmentLoads()] : []),
        qwikVite({
          // Browser projects render on the client only. SSR projects render through a dev
          // server, whose modules the plugin builds as its `client` target: that target needs no
          // entry here (the tests import what they render), and without an empty one a Vite
          // server outside Vitest fails to start, looking for `<srcDir>/root`.
          ...(mode === "browser" ? { csr: true as const } : { client: { input: [] } }),
          // The default, `<root>/src`, must exist or the plugin throws at build start.
          srcDir: root,
          devTools: {
            // HMR adds `q-d:q-hmr` attributes and event scripts to every rendered root.
            hmr: false,
            // The image dev tool outlines and labels `<img>`s it judges to shift layout.
            imageDevTools: false,
            clickToSource: false,
          },
        }),
        // After the plugin, whose `qTest` it replaces.
        reportErrors(),
      ],
      // In development the plugin turns Qwik's inspector on (Vitest's test mode keeps it off),
      // and the renderers then write `data-qwik-inspector="<absolute path>:<line>:<column>"` on
      // every element. A boolean: the plugin also assigns the value to `globalThis` as it is.
      define: { "globalThis.qInspector": false },
      // No `optimizeDeps.include`: the plugin excludes `@qwik.dev/core` from pre-bundling, and
      // Vite's exclude covers its subpaths, so neither the compiled output's imports nor the
      // mount adapter's (`/internal`, `/qwikloader.js`) can be discovered late and reload a test.
      resolve: { dedupe: ["@qwik.dev/core"] },
    };
  },

  frameworkCompile: (files) => compileWithOptimizer(files),

  typecheck: (files, context) => typecheckWithTsgo(files, context),

  // L5 (ADR-0042): oxlint, with the shared baseline and eslint-plugin-qwik as a JS plugin, and
  // ESLint, on TypeScript 6, for the plugin's type-aware rules (./lint.ts).
  lint,
};

export default toolchain;

/**
 * Qwik's Vite plugin defines `globalThis.qTest` as `NODE_ENV === "test"`, which is true under
 * Vitest, whatever the configuration defines; and with `qTest` on, Qwik neither logs nor
 * rethrows an error that a handler, a `sync$` or a task throws (core's `createAndLogError`), so a
 * broken output would pass every layer (L13 sees no console error, and Vitest no unhandled
 * error). This plugin's configuration, merged after the Qwik plugin's, turns it off: Qwik logs
 * `QWIK ERROR` (L13) and rethrows the error in a task of its own, as in an app.
 */
function reportErrors(): Plugin {
  return {
    name: "uf-qwik-report-errors",
    config: () => ({ define: { "globalThis.qTest": false } }),
  };
}
