// Where every `vue-vapor` layer finds Vue 3.6 (ADR-0112): in `context.toolchainDir`, never in the
// project root or in this package's own dependencies, as ADR-0102 has Solid 2 do. In this
// repository the corpus's root, tests/integration, holds Vue 3.5, the reference's, and only
// tests/toolchains/vue-vapor holds Vue 3.6; in a project with one Vue, the toolchain directory is
// the project root.
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import type { Plugin } from "vite";

/** Whether a specifier names `vue` or a subpath of it. */
export function isVueSpecifier(specifier: string): boolean {
  return specifier === "vue" || specifier.startsWith("vue/");
}

/** The directory of the `vue` package the toolchain directory resolves. */
export function vueDirectory(toolchainDir: string): string {
  return dirname(createRequire(join(toolchainDir, "package.json")).resolve("vue/package.json"));
}

/**
 * Resolves every import of `vue` as if the toolchain directory imported it, through Vite's own
 * resolution, so each environment's export conditions still apply (the browser's development
 * build). It runs before Vite's resolver, which would resolve `vue` from the project root or from
 * the importer.
 *
 * On the server, `vue` and every `@vue/*` package resolve to their ES module builds, which Vite runs
 * inlined (`resolve.noExternal`): Vapor's runtime, an ES module alone, imports internals of
 * `@vue/runtime-dom` that its CommonJS build, Node's, does not export, and Node, loading `vue` as
 * an external, would resolve it from the importer, where Vue 3.5 is. So the server has one Vue,
 * 3.6's, whole.
 */
export function resolveVue(toolchainDir: string): Plugin {
  const importer = join(toolchainDir, "package.json");
  const directory = vueDirectory(toolchainDir);
  return {
    name: "unframework:vue-vapor-resolve",
    enforce: "pre",
    async resolveId(source, from, options) {
      const server = this.environment.config.consumer === "server";
      if (server && source.startsWith("@vue/")) return esModuleBuild(source, from ?? importer);
      if (!isVueSpecifier(source)) return null;
      if (server && source === "vue") return join(directory, "dist/vue.runtime.esm-bundler.js");
      if (server && source === "vue/server-renderer") {
        return join(directory, "server-renderer/index.mjs");
      }
      return this.resolve(source, importer, { ...options, skipSelf: true });
    },
  };
}

/** A `@vue/*` package's ES module build, `dist/<name>.esm-bundler.js`, as its importer finds it. */
function esModuleBuild(specifier: string, importer: string): string | null {
  const name = specifier.slice("@vue/".length);
  if (name.includes("/")) return null;
  let manifest: string;
  try {
    manifest = createRequire(importer).resolve(`${specifier}/package.json`);
  } catch {
    return null;
  }
  return join(dirname(manifest), "dist", `${name}.esm-bundler.js`);
}

/**
 * Keeps Vite from resolving `vue` from the project root: a deduped package resolves from the root
 * whatever the importer, and the dependency optimizer resolves what it pre-bundles from the root,
 * past every plugin, so `vue` is served as it is instead, through `resolveVue`.
 */
export function undedupeVue(): Plugin {
  return {
    name: "unframework:vue-vapor-undedupe",
    config(config) {
      const dedupe = config.resolve?.dedupe;
      if (dedupe) config.resolve!.dedupe = dedupe.filter((name) => !isVueSpecifier(name));
      const include = config.optimizeDeps?.include;
      if (include) config.optimizeDeps!.include = include.filter((name) => !isVueSpecifier(name));
    },
    configEnvironment(_name, config) {
      const dedupe = config.resolve?.dedupe;
      if (dedupe) config.resolve!.dedupe = dedupe.filter((name) => !isVueSpecifier(name));
    },
  };
}
