// Finding the tools a toolchain directory installs. Node's own resolution also searches
// NODE_PATH, which `pnpm exec`, `pnpm run` and pnpm's bin shims can set to the whole hoisted
// store: that finds a package from anywhere, hides a toolchain directory that does not install
// it, and can pick another project's copy (in this repo, a vue-tsc bound to TypeScript 7). Here
// only the `node_modules` directories from the given directory upwards count.
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

/** The fields of a package manifest the toolchains read. */
export interface PackageManifest {
  version?: string;
  bin?: string | Record<string, string>;
}

/** A package installed for a directory: its manifest, and where that manifest is. */
export interface InstalledPackage {
  manifestPath: string;
  manifest: PackageManifest;
}

/**
 * Resolves `specifier` (a package, or a subpath of one) as Node would from `directory`, but only
 * from the `node_modules` of `directory` and its ancestors. Returns `undefined` when none of
 * them installs the package.
 */
export function resolveInstalled(directory: string, specifier: string): string | undefined {
  const parts = specifier.split("/");
  const name = specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
  const from = installedFrom(directory, name);
  return from === undefined
    ? undefined
    : createRequire(join(from, "package.json")).resolve(specifier);
}

/**
 * The manifest of package `name` as installed for `directory` (see {@link resolveInstalled}),
 * read directly: a package's `exports` need not expose its `package.json`.
 */
export function findInstalled(directory: string, name: string): InstalledPackage | undefined {
  const from = installedFrom(directory, name);
  if (from === undefined) return undefined;
  const manifestPath = join(from, "node_modules", name, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PackageManifest;
  return { manifestPath, manifest };
}

/**
 * Resolves a package's bin script from the toolchain directory, where the checkers are
 * installed. Throws when the package is not installed there or declares no such bin.
 */
export function resolveToolBin(toolchainDir: string, pkg: string, bin: string): string {
  const installed = findInstalled(toolchainDir, pkg);
  if (!installed) {
    throw new Error(
      `${pkg} is not installed in ${toolchainDir}: the toolchain directory must provide it ` +
        `(in this repo, tests/toolchains/<target> lists it as a devDependency).`,
    );
  }
  const { manifestPath, manifest } = installed;
  const relative = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.[bin];
  if (!relative) throw new Error(`${pkg} at ${dirname(manifestPath)} has no "${bin}" bin.`);
  return join(dirname(manifestPath), relative);
}

/** The nearest directory, from `directory` upwards, whose `node_modules` holds package `name`. */
function installedFrom(directory: string, name: string): string | undefined {
  for (let current = resolve(directory); ; current = dirname(current)) {
    if (existsSync(join(current, "node_modules", name, "package.json"))) return current;
    if (dirname(current) === current) return undefined;
  }
}
