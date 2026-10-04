// The React target's toolchain (plan §5.7): how tests and tooling build, check and run React
// output. Node only; the main entry never imports it.
import type { Toolchain } from "@unframework/codegen";
import { lintWithOxlint, typecheckWithTsgo } from "@unframework/codegen/toolchain-node";
import type { UserConfig } from "vite";

import { compileWithReactCompiler } from "./compile.ts";

/** The runtime modules compiled output and the mount adapter import in the browser. */
const BROWSER_RUNTIME = ["react", "react/jsx-dev-runtime", "react-dom/client"];

/** The React 19 toolchain. */
export const toolchain: Toolchain = {
  name: "react",
  client: "@unframework/target-react/toolchain/client",
  server: "@unframework/target-react/toolchain/server",

  async vite(mode): Promise<UserConfig> {
    // Loaded here, not at the top: the harness imports every toolchain to build its config.
    const { default: react } = await import("@vitejs/plugin-react");
    return {
      // Fast Refresh is off under Vitest already, so the code under test is the plain output.
      plugins: [react()],
      resolve: { dedupe: ["react", "react-dom"] },
      // Vite's dependency scanner never sees compiled modules (the unplugin hides them from
      // it), so name their runtime imports, or a cold run reloads the page mid-test.
      ...(mode === "browser" ? { optimizeDeps: { include: BROWSER_RUNTIME } } : {}),
    };
  },

  frameworkCompile: (files) => compileWithReactCompiler(files),

  typecheck: (files, context) => typecheckWithTsgo(files, context),

  // L5: oxlint, with the shared baseline and its own React rules (ADR-0042).
  lint: (files, context) => lintWithOxlint(files, context),
};

export default toolchain;
