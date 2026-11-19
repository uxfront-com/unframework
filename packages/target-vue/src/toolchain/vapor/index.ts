// The Vue target's toolchain under its `vapor` option (ADR-0112): how tests and tooling build,
// check and run Vapor output. Node only; the main entry never imports it. Vue 3.6, its compiler
// and its Vite plugin load from `context.toolchainDir`, as Solid 2's do (ADR-0102), so a
// repository whose root holds Vue 3.5 still runs Vapor on Vue 3.6.
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { Toolchain, ToolchainContext } from "@unframework.dev/codegen";
import type vuePlugin from "@vitejs/plugin-vue";
import type { UserConfig } from "vite";

import { frameworkCompile, frameworkEmit } from "../framework-compile.ts";
import { projectFs, toolchain as vue } from "../index.ts";
import { resolveVue, undedupeVue } from "./resolve.ts";

/** The part of @vitejs/plugin-vue this toolchain calls. */
type VuePlugin = typeof vuePlugin;

/** @vitejs/plugin-vue and Vue's compiler-sfc, from the toolchain directory. */
async function loadPlugin(context: ToolchainContext): Promise<{
  plugin: VuePlugin;
  compiler: NonNullable<Parameters<VuePlugin>[0]>["compiler"];
}> {
  const require = createRequire(join(context.toolchainDir, "package.json"));
  const entry = require.resolve("@vitejs/plugin-vue");
  const plugin = ((await import(pathToFileURL(entry).href)) as { default: VuePlugin }).default;
  return { plugin, compiler: require("vue/compiler-sfc") as never };
}

/** The Vue Vapor toolchain. */
export const toolchain: Toolchain = {
  name: "vue-vapor",
  client: "@unframework.dev/target-vue/toolchain/vapor/client",
  server: "@unframework.dev/target-vue/toolchain/vapor/server",
  hydrate: "@unframework.dev/target-vue/toolchain/vapor/hydrate",

  async vite(mode, context): Promise<UserConfig> {
    // Loaded here, not at the top: the harness imports every toolchain to build its config.
    const { plugin, compiler } = await loadPlugin(context);
    return {
      plugins: [
        // plugin-vue compiles with Vue 3.6's compiler-sfc, which reads `vapor`: without
        // `compiler`, it would resolve the project root's, Vue 3.5's, which ignores it.
        plugin({
          compiler,
          template: { transformAssetUrls: false },
          script: { fs: projectFs },
        }),
        // Every import of `vue`, from an output, an adapter or Vue itself, resolves in the
        // toolchain directory (ADR-0112).
        resolveVue(context.toolchainDir),
        undedupeVue(),
      ],
      // Served through Vite's pipeline, on the server too, so their imports resolve through
      // `resolveVue`: as externals, Node would load `vue` from the importer's `node_modules`.
      resolve: { noExternal: ["vue", /^@vue\//] },
      ...(mode === "ssr" ? {} : { optimizeDeps: { exclude: ["vue"] } }),
    };
  },

  // L3 and L15 with Vue 3.6's compilers, from the toolchain directory.
  frameworkCompile: (files, context) => frameworkCompile(files, context.toolchainDir, true),
  frameworkEmit: (files, context) => frameworkEmit(files, context.toolchainDir, true),
  // L4 and L5 as Vue's: vue-tsc and eslint-plugin-vue run from the toolchain directory.
  typecheck: (files, context) => vue.typecheck(files, context),
  lint: (files, context) => vue.lint(files, context),
};

export default toolchain;
