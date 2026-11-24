// Where every `solid2` layer finds Solid 2 (ADR-0102): in `context.toolchainDir`, never in the
// project root or in this package's own dependencies. In this repository the corpus's root,
// tests/integration, holds Solid 1, and only tests/toolchains/solid2 holds Solid 2; in a project
// with one Solid major, the toolchain directory is the project root.
import { join } from "node:path";

import type { Plugin } from "vite";

/** Solid 2's runtime packages: what an output, the adapters and Solid itself import. */
export const SOLID_PACKAGES: readonly string[] = ["solid-js", "@solidjs/web", "@solidjs/signals"];

/** Whether a specifier names one of Solid 2's packages or a subpath of one. */
export function isSolidSpecifier(specifier: string): boolean {
  return SOLID_PACKAGES.some((name) => specifier === name || specifier.startsWith(`${name}/`));
}

/**
 * The packages an output or an adapter imports, which resolve in the toolchain directory:
 * `@solidjs/signals` is `solid-js`'s own dependency, which resolves from `solid-js` itself.
 */
const IMPORTED: readonly string[] = ["solid-js", "@solidjs/web"];

/**
 * Resolves every import of Solid 2's packages as if the toolchain directory imported it, through
 * Vite's own resolution, so each environment's export conditions still apply (the browser's dev
 * build, the server's). It runs before Vite's resolver, which would resolve them from the project
 * root or from the importer.
 */
export function resolveSolid(toolchainDir: string): Plugin {
  const importer = join(toolchainDir, "package.json");
  return {
    name: "unframework:solid2-resolve",
    enforce: "pre",
    async resolveId(source, _importer, options) {
      if (!IMPORTED.some((name) => source === name || source.startsWith(`${name}/`))) {
        return null;
      }
      return this.resolve(source, importer, { ...options, skipSelf: true });
    },
  };
}

/**
 * Keeps Vite from resolving Solid's packages from the project root: the Vite plugin dedupes every
 * Solid package it finds there, and a deduped package resolves from the root whatever the
 * importer, which in this repository is Solid 1. It also has Vite pre-bundle Solid and the subpaths
 * its dev tools import (`solid-js/attribution`), which the dependency optimizer resolves from the
 * root, past every plugin: Solid 2 is served as it is instead, through `resolveSolid`.
 */
export function undedupeSolid(): Plugin {
  return {
    name: "unframework:solid2-undedupe",
    config(config) {
      const dedupe = config.resolve?.dedupe;
      if (dedupe) {
        config.resolve!.dedupe = dedupe.filter((name) => !SOLID_PACKAGES.includes(name));
      }
      const include = config.optimizeDeps?.include;
      if (include) {
        config.optimizeDeps!.include = include.filter((name) => !isSolidSpecifier(name));
      }
    },
    configEnvironment(name, config) {
      const dedupe = config.resolve?.dedupe;
      if (dedupe) {
        config.resolve!.dedupe = dedupe.filter((name) => !SOLID_PACKAGES.includes(name));
      }
      // In a browser test, the plugin resolves every environment with the `browser` condition, the
      // server's too, where a hydrate project renders the HTML it hydrates (L12, ADR-0095).
      const conditions = config.resolve?.conditions;
      if (name === "ssr" && conditions?.includes("browser")) {
        config.resolve!.conditions = conditions.filter((condition) => condition !== "browser");
      }
    },
  };
}
