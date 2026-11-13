import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const e2eRoot: string = fileURLToPath(new URL("..", import.meta.url));
export const repoRoot: string = resolve(e2eRoot, "../..");
export const designSystemDir: string = join(e2eRoot, "design-system");
export const tarballsDir: string = join(e2eRoot, ".tarballs");

/** What `prepare-apps` leaves in a copy, so that it only ever replaces its own directories. */
export const copyMarker = ".unframework-e2e-copy";

export type Manifest = Record<string, any>;

export interface App {
  name: string;
  /** The directories under the app's `e2e/`: each is one Playwright project. */
  modes: string[];
}

/** Every app under `apps/`, in a stable order. */
export function findApps(root: string = join(e2eRoot, "apps")): App[] {
  return subdirectories(root).map((name) => ({
    name,
    modes: subdirectories(join(root, name, "e2e")),
  }));
}

function subdirectories(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted();
}

/**
 * The directory that holds the working copies (ADR-0079). It must sit outside the repository: a
 * copy inside it would resolve upward into the workspace's `node_modules`, so a dependency a
 * tarball forgot would still pass.
 */
export function workDir(
  configured: string | undefined = process.env.UF_E2E_WORK_DIR,
  repository: string = repoRoot,
): string {
  // The path as given and the real one can differ, so compare each with both of the repository's.
  const roots = [resolve(repository), realpathSync(repository)];
  const refuseInside = (path: string): void => {
    if (roots.some((root) => relative(root, path).split(sep)[0] !== "..")) {
      throw new Error(`UF_E2E_WORK_DIR must be outside the repository, not ${path}.`);
    }
  };
  const work = resolve(configured || join(tmpdir(), "unframework-e2e"));
  refuseInside(work);
  mkdirSync(work, { recursive: true });
  // macOS's temporary directory is a symlink, so name the copies by the real path, which is what
  // Node resolves their modules to. A symlink can also lead back into the repository.
  const real = realpathSync(work);
  refuseInside(real);
  return real;
}

/** Replaces an earlier working copy with an empty, marked one. Anything else in its place belongs to someone. */
export function startCopy(copy: string): void {
  if (existsSync(copy) && !existsSync(join(copy, copyMarker))) {
    throw new Error(
      `${copy} isn't a working copy, so it was left alone. Choose another directory.`,
    );
  }
  rmSync(copy, { recursive: true, force: true });
  // Before the copying, so that a copy cut short can still be replaced.
  mkdirSync(copy, { recursive: true });
  writeFileSync(join(copy, copyMarker), "");
}

/** Where the design system is packed from: its package once `pack:dist` has written one. */
export function designSystemSource(directory: string = designSystemDir): string {
  const packaged = join(directory, "dist/package");
  return existsSync(packaged) ? packaged : directory;
}

/**
 * Throws unless a copy's package is what a tarball installs: real files in the copy's own virtual
 * store. pnpm always links `node_modules/<name>` into that store, so the link itself proves
 * nothing. Where it leads, and what is inside, do.
 */
export function assertInstalledFromTarball(copy: string, name: string): void {
  const store = join(realpathSync(copy), "node_modules/.pnpm") + sep;
  const installed = realpathSync(join(copy, "node_modules", name));
  if (!installed.startsWith(store)) {
    throw new Error(`${name} resolves to ${installed}, outside the copy's virtual store.`);
  }
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (lstatSync(path).isSymbolicLink()) throw new Error(`${path} is a symbolic link.`);
      if (entry.isDirectory()) visit(path);
    }
  };
  visit(installed);
}

/** The file in `.tarballs` that names what `prepare-apps` packed, so a later run can reuse it. */
export const packedFile = "packed.json";

export interface Packed {
  /** The design system's package name. */
  designSystem: string;
  /** Each packed package's tarball, by name. */
  tarballs: Record<string, string>;
}

/** Records what was packed, by file name, so the directory can move: CI's E2E jobs download it. */
export function writePacked(packed: Packed, directory: string = tarballsDir): void {
  const tarballs = Object.fromEntries(
    Object.entries(packed.tarballs).map(([name, path]) => [name, basename(path)]),
  );
  writeFileSync(
    join(directory, packedFile),
    `${JSON.stringify({ designSystem: packed.designSystem, tarballs }, null, 2)}\n`,
  );
}

/**
 * What an earlier `prepare-apps` packed into `directory`, with each tarball's absolute path. It
 * throws when the record or a tarball is missing, so an install never falls back to the registry.
 */
export function readPacked(directory: string = tarballsDir): Packed {
  const record = join(directory, packedFile);
  if (!existsSync(record)) {
    throw new Error(`${record} is missing: run prepare-apps without --reuse-tarballs first.`);
  }
  const packed: Packed = JSON.parse(readFileSync(record, "utf8"));
  if (!(packed.designSystem in packed.tarballs)) {
    throw new Error(`${record} has no tarball for the design system, ${packed.designSystem}.`);
  }
  const tarballs: Record<string, string> = {};
  for (const [name, file] of Object.entries(packed.tarballs)) {
    // A file name only: the record never points outside its directory.
    const path = join(directory, basename(file));
    if (basename(file) !== file || !existsSync(path)) {
      throw new Error(`${record} names ${file} for ${name}, which isn't in ${directory}.`);
    }
    tarballs[name] = path;
  }
  return { designSystem: packed.designSystem, tarballs };
}

/** Reads one package's manifest. */
export function readManifest(directory: string): Manifest {
  return JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
}

/** The workspace packages under `packages/`, by name. */
export function workspacePackages(root: string = join(repoRoot, "packages")): Map<string, string> {
  const found = new Map<string, string>();
  for (const directory of readdirSync(root)) {
    const path = join(root, directory);
    if (existsSync(join(path, "package.json"))) found.set(readManifest(path).name, path);
  }
  return found;
}

/**
 * The names the given manifests reach through `workspace:` dependencies. A packed package depends
 * on them at `0.0.0`, so each one must be packed too.
 */
export function workspaceClosure(
  roots: Manifest[],
  packages: Map<string, string>,
  read: (directory: string) => Manifest = readManifest,
): string[] {
  const seen = new Set<string>();
  const visit = (manifest: Manifest): void => {
    for (const [name, specifier] of Object.entries<string>(manifest.dependencies ?? {})) {
      if (!specifier.startsWith("workspace:") || seen.has(name)) continue;
      const directory = packages.get(name);
      if (!directory) throw new Error(`${manifest.name} depends on unknown package ${name}.`);
      seen.add(name);
      visit(read(directory));
    }
  };
  roots.forEach(visit);
  return [...seen].toSorted();
}

/** The copy's manifest: the app's own, plus the tarballs its modes consume. */
export function copyManifest(
  manifest: Manifest,
  app: App,
  tarballs: Record<string, string>,
  designSystem: string,
  packageManager: string,
): Manifest {
  const consumed = [designSystem];
  if (app.modes.includes("plugin"))
    consumed.push("@uxfront/unframework", "@unframework.dev/unplugin");
  const dependencies = { ...manifest.dependencies };
  for (const name of consumed) dependencies[name] = `file:${tarballs[name]}`;
  // The pin keeps the install on the pnpm the repository uses, not on whichever version is
  // installed globally.
  return { ...manifest, packageManager, dependencies };
}

/**
 * The copy's `pnpm-workspace.yaml`, written as JSON, which YAML reads as it is. pnpm 11 ignores
 * `package.json#pnpm`, so this is the only place for these settings, and it makes the copy its
 * own workspace root. `overrides` names every packed package because their manifests depend on
 * each other at `0.0.0`, which no registry holds.
 */
export function copyWorkspace(tarballs: Record<string, string>): string {
  const overrides = Object.fromEntries(
    Object.entries(tarballs).map(([name, path]) => [name, `file:${path}`]),
  );
  return `${JSON.stringify({ overrides, allowBuilds: ALLOWED_BUILDS }, null, 2)}\n`;
}

const ALLOWED_BUILDS = {
  esbuild: true,
  "@parcel/watcher": true,
  lmdb: true,
  "msgpackr-extract": true,
  sharp: true,
};

/** Where `prepare-apps` installs the design system as a project of its own (ADR-0089). */
export const designSystemCopyName = "design-system";

/**
 * What a project installs to run `unframework test` and `unframework visual` on all seven targets:
 * the lists of `4.tooling/5.testing.md` and `6.visual.md`, each target's framework and Vite plugin
 * included, since a target's tarball keeps them as devDependencies. The copy installs exactly
 * these, so a package the docs forgot fails here, as it would in a user's project.
 */
export const DESIGN_SYSTEM_TEST_DEPENDENCIES: readonly string[] = [
  "@uxfront/unframework",
  "@unframework.dev/testing",
  "@unframework.dev/visual",
  "vitest",
  "@vitest/browser-playwright",
  "playwright",
  // react
  "react",
  "react-dom",
  "@vitejs/plugin-react",
  "@babel/core",
  "babel-plugin-react-compiler",
  // vue
  "vue",
  "@vitejs/plugin-vue",
  // svelte
  "svelte",
  "@sveltejs/vite-plugin-svelte",
  // solid
  "solid-js",
  "vite-plugin-solid",
  // angular, with its compiler stack on TypeScript 6
  "@angular/core",
  "@angular/common",
  "@angular/platform-browser",
  "@angular/platform-server",
  "@angular/compiler",
  "@angular/compiler-cli",
  "@angular/build",
  "@analogjs/vite-plugin-angular",
  "typescript",
  // qwik
  "@qwik.dev/core",
  // astro
  "astro",
];

/**
 * The `catalog:` of a `pnpm-workspace.yaml`. It reads the flat mapping this repository writes,
 * one `name: version` line each, rather than YAML at large, so it needs no parser.
 */
export function readCatalog(text: string): Record<string, string> {
  const lines = text.split("\n");
  const start = lines.indexOf("catalog:");
  if (start === -1) throw new Error("pnpm-workspace.yaml has no catalog.");
  const catalog: Record<string, string> = {};
  for (const line of lines.slice(start + 1)) {
    if (/^\s*(#.*)?$/.test(line)) continue;
    const entry = /^ {2}("?)([^":\s]+)\1: (\S+)$/.exec(line);
    if (!entry) {
      if (/^\S/.test(line)) break;
      throw new Error(`The catalog has a line this reader can't take: ${line}`);
    }
    catalog[entry[2]!] = entry[3]!;
  }
  return catalog;
}

/**
 * The design system's copy's manifest. The packed packages come from their tarballs and the rest
 * at the catalog's versions. TypeScript 6 isn't in the catalog: it's the Angular toolchain's,
 * which the workspace keeps outside every package (AGENTS.md).
 */
export function designSystemCopyManifest(
  tarballs: Record<string, string>,
  catalog: Record<string, string>,
  typescript6: string,
  packageManager: string,
): Manifest {
  const devDependencies: Record<string, string> = {};
  for (const name of DESIGN_SYSTEM_TEST_DEPENDENCIES) {
    const version = name === "typescript" ? typescript6 : (tarballs[name] ?? catalog[name]);
    if (!version) throw new Error(`${name} is neither packed nor in the catalog.`);
    devDependencies[name] = name in tarballs ? `file:${version}` : version;
  }
  return {
    name: "e2e-design-system-copy",
    version: "0.0.0",
    private: true,
    type: "module",
    packageManager,
    devDependencies,
  };
}

/**
 * The design system's copy's `pnpm-workspace.yaml`: the apps' overrides and builds, and the
 * settings of the root's that its toolchains need. Analog imports `typescript` without declaring
 * it, `@typescript/typescript6` takes `typescript@^6` unpinned, and Qwik's beta peers an older
 * Vitest. The harness's tests hold each to the root's own entry.
 */
export function designSystemCopyWorkspace(tarballs: Record<string, string>): string {
  const workspace = JSON.parse(copyWorkspace(tarballs));
  workspace.overrides[TYPESCRIPT6_OLD.key] = TYPESCRIPT6_OLD.value;
  workspace.packageExtensions = { [ANALOG_EXTENSION.key]: ANALOG_EXTENSION.value };
  workspace.peerDependencyRules = {
    allowedVersions: { [QWIK_VITEST_PEER.key]: QWIK_VITEST_PEER.value },
  };
  return `${JSON.stringify(workspace, null, 2)}\n`;
}

/** The root's settings the copy repeats, each as the root's `pnpm-workspace.yaml` writes it. */
export const TYPESCRIPT6_OLD = {
  key: "@typescript/typescript6>@typescript/old",
  value: "npm:typescript@6.0.3",
};
export const ANALOG_EXTENSION = {
  key: "@analogjs/vite-plugin-angular@2",
  value: { peerDependencies: { typescript: ">=6.0 <6.1" } },
};
export const QWIK_VITEST_PEER = { key: "@qwik.dev/core>vitest", value: "5" };

/**
 * The design system's `unframework.config.ts` for its copy: the same targets, without
 * `package.resolveFrom`, whose `../../toolchains/…` exists only in the repository. The copy
 * installs those toolchains itself, at its root.
 */
export function designSystemCopyConfig(config: string): string {
  const targets = /^ {2}targets: (\[[^\]\n]*\]),$/m.exec(config)?.[1];
  if (!targets) throw new Error("The design system's unframework.config.ts names no targets.");
  return [
    `import { defineConfig } from "@uxfront/unframework/config";`,
    "",
    "export default defineConfig({",
    `  targets: ${targets},`,
    "});",
    "",
  ].join("\n");
}

/** The design system's files a copy takes: its sources, examples and cases, not its scratch. */
export const DESIGN_SYSTEM_COPIED: readonly string[] = ["src", "examples", "test"];
