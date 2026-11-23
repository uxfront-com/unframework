import type { Toolchain } from "@unframework.dev/codegen";
import type { UserConfig } from "vite";

import { frameworkCompile, frameworkEmit } from "./framework-compile.ts";
import { lint } from "./lint.ts";
import { typecheck } from "./typecheck.ts";

/**
 * The Ember target's toolchain, for tests and tooling: its own `.gts` plugin in Vite
 * (content-tag, Babel and Ember's template compiler), the same steps for L3, Glint for L4,
 * oxlint and eslint-plugin-ember for L5, and `renderComponent` adapters for the browser and the
 * server.
 */
export const toolchain: Toolchain = {
  name: "ember",
  async vite(mode): Promise<UserConfig> {
    // Loaded on demand: reading `client` or `server` should not load Babel.
    const { ember } = await import("./vite.ts");
    return {
      plugins: [ember()],
      resolve: { dedupe: ["ember-source", "@glimmer/component"] },
      // `@glimmer/component` imports `@ember/*` modules, which only the plugin resolves, and
      // `ember-source` is ESM that its own modules import by path: both go through Vite.
      ...(mode === "ssr"
        ? { ssr: { noExternal: ["ember-source", "@glimmer/component"] } }
        : { optimizeDeps: { exclude: ["ember-source", "@glimmer/component"] } }),
      // A hydrate project renders in its browser server's SSR environment, which inlines every
      // dependency: the server render's own, vite-ember-ssr and happy-dom, load as Node's.
      ...(mode === "hydrate"
        ? { environments: { ssr: { resolve: { external: ["vite-ember-ssr", "happy-dom"] } } } }
        : {}),
    };
  },
  client: "@unframework.dev/target-ember/toolchain/client",
  server: "@unframework.dev/target-ember/toolchain/server",
  hydrate: "@unframework.dev/target-ember/toolchain/hydrate",
  frameworkCompile,
  frameworkEmit,
  typecheck,
  // L5 (ADR-0042): ESLint with eslint-plugin-ember, and oxlint's shared baseline.
  lint,
};

export default toolchain;
