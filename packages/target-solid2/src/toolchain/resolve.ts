// Where every `solid2` layer finds Solid 2 (ADR-0102): in `context.toolchainDir`, never in the
// project root or in this package's own dependencies. In this repository the corpus's root,
// tests/integration, holds Solid 1, and only tests/toolchains/solid2 holds Solid 2; in a project
// with one Solid major, the toolchain directory is the project root.
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import type { Plugin } from "vite";

/** Solid 2's runtime packages: what an output, the adapters and Solid itself import. */
export const SOLID_PACKAGES: readonly string[] = ["solid-js", "@solidjs/web", "@solidjs/signals"];

/** The real directory of a package, as Node resolves it from `fromDir`. */
export function packageDir(name: string, fromDir: string): string {
  const require = createRequire(join(fromDir, "package.json"));
  let manifest: string;
  try {
    manifest = require.resolve(`${name}/package.json`);
  } catch {
    // A package whose `exports` hides its manifest: find it from its main entry instead.
    const entry = require.resolve(name);
    let dir = dirname(entry);
    while (!dir.endsWith(join("node_modules", name)) && dirname(dir) !== dir) dir = dirname(dir);
    manifest = join(dir, "package.json");
  }
  return realpathSync(dirname(manifest));
}

/**
 * Solid 2's packages as `resolve.alias` entries, each to its real directory under `toolchainDir`.
 * Vite resolves an aliased package directory through its `exports` with the environment's own
 * conditions, so the browser, server and development builds still apply, and its dependency
 * optimizer reads aliases too. `@solidjs/signals` is a dependency of `solid-js`, so it is found
 * from there.
 */
export function solidAliases(toolchainDir: string): { find: RegExp; replacement: string }[] {
  const solid = packageDir("solid-js", toolchainDir);
  const dirs: Record<string, string> = {
    "solid-js": solid,
    "@solidjs/web": packageDir("@solidjs/web", toolchainDir),
    "@solidjs/signals": packageDir("@solidjs/signals", solid),
  };
  return SOLID_PACKAGES.map((name) => ({
    find: new RegExp(`^${name.replace("/", "\\/")}$`),
    replacement: dirs[name]!,
  }));
}

/**
 * Keeps Vite from resolving Solid's packages from the project root: the Vite plugin dedupes every
 * Solid package it finds there, and a deduped package resolves from the root whatever the
 * importer, which in this repository is Solid 1.
 */
export function undedupeSolid(): Plugin {
  return {
    name: "unframework:solid2-undedupe",
    config(config) {
      const dedupe = config.resolve?.dedupe;
      if (dedupe) config.resolve!.dedupe = dedupe.filter((name) => !SOLID_PACKAGES.includes(name));
    },
    configEnvironment(_name, config) {
      const dedupe = config.resolve?.dedupe;
      if (dedupe) config.resolve!.dedupe = dedupe.filter((name) => !SOLID_PACKAGES.includes(name));
    },
  };
}
