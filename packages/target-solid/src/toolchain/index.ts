// The Solid target's toolchain (plan §5.7): how tests and tooling build, check and run Solid
// output. Node only; the main entry never imports it.
import type { Toolchain } from "@unframework/codegen";
import { typecheckWithTsgo } from "@unframework/codegen/toolchain-node";
import type { UserConfig } from "vite";

import { compileWithSolid } from "./compile.ts";

/** The runtime modules compiled output and the mount adapter import in the browser. */
const BROWSER_RUNTIME = ["solid-js", "solid-js/web"];

/** The Solid 1.9 toolchain. */
export const toolchain: Toolchain = {
  name: "solid",
  client: "@unframework/target-solid/toolchain/client",
  server: "@unframework/target-solid/toolchain/server",

  async vite(mode): Promise<UserConfig> {
    // Loaded here, not at the top: the harness imports every toolchain to build its config.
    const { default: solid } = await import("vite-plugin-solid");
    return {
      plugins: [
        solid({
          // Without `ssr`, the plugin compiles DOM code on the server too, and Solid's
          // renderToStringAsync then returns undefined instead of failing. With it, server
          // output is hydratable, so hydration tests can reuse the same compile.
          ssr: mode === "ssr",
          // solid-refresh would wrap the code under test in HMR proxies.
          hot: false,
        }),
      ],
      resolve: { dedupe: ["solid-js"] },
      // Vite's dependency scanner never sees compiled modules (the unplugin hides them from
      // it), so name their runtime imports, or a cold run reloads the page mid-test.
      ...(mode === "browser" ? { optimizeDeps: { include: BROWSER_RUNTIME } } : {}),
    };
  },

  frameworkCompile: (files) => compileWithSolid(files),

  typecheck: (files, context) => typecheckWithTsgo(files, context),
};

export default toolchain;
