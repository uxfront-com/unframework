// The React target's toolchain (plan §5.7): how tests and tooling build, check and run React
// output. Node only; the main entry never imports it.
import type { Toolchain } from "@unframework.dev/codegen";
import { lintWithOxlint, typecheckWithTsgo } from "@unframework.dev/codegen/toolchain-node";
import type { UserConfig } from "vite";

import { compileWithReactCompiler, emitWithReactCompiler } from "./compile.ts";

/** The runtime modules compiled output and the mount adapter import in the browser. */
const BROWSER_RUNTIME = ["react", "react/jsx-dev-runtime", "react-dom/client"];

/** The React 19 toolchain. */
export const toolchain: Toolchain = {
  name: "react",
  client: "@unframework.dev/target-react/toolchain/client",
  server: "@unframework.dev/target-react/toolchain/server",
  hydrate: "@unframework.dev/target-react/toolchain/hydrate",

  async vite(mode): Promise<UserConfig> {
    // Loaded here, not at the top: the harness imports every toolchain to build its config.
    const { default: react } = await import("@vitejs/plugin-react");
    return {
      // Fast Refresh is off under Vitest already, so the code under test is the plain output.
      plugins: [react()],
      resolve: { dedupe: ["react", "react-dom"] },
      // Vite's dependency scanner never sees compiled modules (the unplugin hides them from
      // it), so name their runtime imports, or a cold run reloads the page mid-test.
      ...(mode === "ssr" ? {} : { optimizeDeps: { include: BROWSER_RUNTIME } }),
      // A hydrate project renders in its browser server's SSR environment, which inlines every
      // dependency (ADR-0095): React's packages are CommonJS, and run only from Node.
      ...(mode === "hydrate"
        ? { environments: { ssr: { resolve: { external: ["react", "react-dom"] } } } }
        : {}),
    };
  },

  frameworkCompile: (files) => compileWithReactCompiler(files),

  frameworkEmit: (files) => emitWithReactCompiler(files),

  typecheck: (files, context) => typecheckWithTsgo(files, context),

  // L5: oxlint, with the shared baseline and its own React rules (ADR-0042).
  lint: (files, context) => lintWithOxlint(files, context),
};

export default toolchain;
