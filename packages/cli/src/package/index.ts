// `build --package` (plan §8.4, ADR-0077): a publishable package at `<outDir>/package/`.
import { existsSync } from "node:fs";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, relative, sep } from "node:path";
import { stripVTControlCharacters } from "node:util";

import type { OutputFile, ResolvedConfig, TargetName } from "@unframework/compiler";
import { createDiagnostic } from "@unframework/diagnostics";
import type { Diagnostic, DiagnosticCode } from "@unframework/diagnostics";

import { astro } from "./astro.ts";
import type { Packager } from "./packager.ts";
import { react } from "./react.ts";
import { solid } from "./solid.ts";
import { vue } from "./vue.ts";

/** Where the package goes under `outDir`, which `build` cleans like a target's tree. */
export const PACKAGE_DIRECTORY = "package";

/** One line per target, in the order Angular, Astro, Qwik, React, Solid, Svelte, Vue. */
const PACKAGERS: Partial<Record<TargetName, Packager>> = {
  astro,
  react,
  solid,
  vue,
};

/** What `build` has compiled, and where. */
export interface PackageInput {
  root: string;
  config: ResolvedConfig;
  /** Each target's files. */
  trees: ReadonlyMap<string, OutputFile[]>;
  /** The sources and the files they read, relative to the root. */
  authored: readonly string[];
  /** The config file, which a diagnostic with no source of its own names. */
  configFile: string;
}

/** A package that has passed what can be checked before anything is written. */
export interface PackagePlan {
  /** UF7008, one per packager that can't run. `run` isn't safe to call unless this is empty. */
  diagnostics: Diagnostic[];
  /** Writes the package, and gives UF7009 if a packager failed. */
  run(): Promise<Diagnostic[]>;
}

/** The package a module belongs to. */
const packageOf = (module: string) =>
  module
    .split("/")
    .slice(0, module.startsWith("@") ? 2 : 1)
    .join("/");

/**
 * The path a directory that may not exist yet will have: a build follows a symbolic link in `outDir`,
 * so what resolves from there depends on where the link goes.
 */
async function realDirectory(directory: string): Promise<string> {
  for (let at = directory; ; at = dirname(at)) {
    const real = await realpath(at).catch(() => undefined);
    if (real !== undefined) return join(real, relative(at, directory));
    if (dirname(at) === at) return directory;
  }
}

/** Whether a package is in the `node_modules` of a directory or of one of its parents. */
function isInstalled(directory: string, name: string): boolean {
  for (let at = directory; ; at = dirname(at)) {
    if (existsSync(join(at, "node_modules", name))) return true;
    if (dirname(at) === at) return false;
  }
}

/**
 * Resolves a module from a directory's own `node_modules` chain. `createRequire` alone also reads
 * `NODE_PATH`, which pnpm's bin shims point at every package the workspace hoists, so a packager
 * the directory never installed would resolve, and a target's TypeScript with it.
 */
function resolverFrom(directory: string): (module: string) => string {
  const { resolve } = createRequire(join(directory, "package.json"));
  return (module) => {
    if (!isInstalled(directory, packageOf(module))) {
      throw new Error(`${module} is not installed in ${directory}.`);
    }
    return resolve(module);
  };
}

/** Reads what a manifest takes from the project's `package.json`, or says why it can't. */
async function projectFields(root: string): Promise<Record<string, string>> {
  const path = join(root, "package.json");
  const text = await readFile(path, "utf8").catch(() => undefined);
  if (text === undefined) {
    throw new Error("--package takes its name and version from package.json, which is not there.");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`--package can't read package.json: ${reason}`, { cause: error });
  }
  const fields = (raw ?? {}) as Record<string, unknown>;
  for (const field of ["name", "version"]) {
    if (typeof fields[field] !== "string" || fields[field] === "") {
      throw new Error(`--package needs a "${field}" in package.json, to publish the package.`);
    }
  }
  return {
    name: fields["name"] as string,
    version: fields["version"] as string,
    ...(typeof fields["license"] === "string" ? { license: fields["license"] } : {}),
  };
}

/** A packager's own error: no stack, and its scratch paths as the tree the build has just written. */
function failure(error: unknown, work: string, tree: string): string {
  const text = stripVTControlCharacters(error instanceof Error ? error.message : String(error));
  return (
    text
      // TypeScript names another module by its absolute path, as in TS4023.
      .replaceAll(join(work, "in"), tree)
      // Rolldown names a file relative to where it ran.
      .replace(/(?<![\w./-])in\//g, `${tree}/`)
      .split("\n")
      .filter((line) => !/^\s+at /.test(line))
      .join("\n")
      .trim()
  );
}

function manifest(
  fields: Readonly<Record<string, string>>,
  packagers: readonly (readonly [TargetName, Packager])[],
): string {
  const peers = packagers.map(([, { peer }]) => peer);
  return `${JSON.stringify(
    {
      ...fields,
      type: "module",
      exports: {
        ...Object.fromEntries(packagers.map(([target, each]) => [`./${target}`, each.exports])),
        "./source/*": "./source/*",
        "./package.json": "./package.json",
      },
      peerDependencies: Object.fromEntries(peers.map(({ name, range }) => [name, range])),
      peerDependenciesMeta: Object.fromEntries(peers.map(({ name }) => [name, { optional: true }])),
    },
    null,
    2,
  )}\n`;
}

/**
 * Checks what can be checked first, so a package that can't start cleans and writes nothing, as a
 * failed compile does. A project's own `package.json` isn't a diagnostic's to report: it has no
 * code, and a missing one throws, which `main` reports as a usage error.
 */
export async function planPackage(input: PackageInput): Promise<PackagePlan> {
  const { root, config, trees, authored, configFile } = input;
  const fields = await projectFields(root);
  const shipped = authored.map(
    (file) => [file, relative(config.srcDir, join(root, file))] as const,
  );
  const outside = shipped.find(([, path]) => path.startsWith(`..${sep}`));
  if (outside) {
    throw new Error(
      `--package can't ship ${outside[0]}, which a source reads from outside srcDir, under ./source/*. Move it into srcDir.`,
    );
  }
  const problem = (code: DiagnosticCode, target: TargetName, message: string) =>
    createDiagnostic(code, { file: configFile, span: { start: 0, end: 0 }, message, target });

  const requested = config.package?.targets ?? config.targets;
  const from = (target: TargetName): string => {
    const each = config.package?.resolveFrom;
    return (typeof each === "string" ? each : each?.[target]) ?? root;
  };
  const realOutDir = await realDirectory(config.outDir);
  const diagnostics: Diagnostic[] = [];
  for (const target of requested) {
    const packager = PACKAGERS[target];
    if (!packager) {
      const message = `Unframework has no ${target} packager yet. Leave ${target} out of package.targets.`;
      diagnostics.push(problem("UF7008", target, message));
      continue;
    }
    const resolve = resolverFrom(from(target));
    for (const need of packager.needs) {
      try {
        resolve(need);
      } catch {
        const place = relative(root, from(target)).split(sep).join("/") || "the project's root";
        const message = `The ${target} packager needs ${need}, which doesn't resolve from ${place}. Install it there, point package.resolveFrom at a directory that has it, or leave ${target} out of package.targets.`;
        diagnostics.push(problem("UF7008", target, message));
      }
    }
    // The stage is under outDir, and its declarations read the framework from there.
    if (packager.types && !isInstalled(realOutDir, packager.types)) {
      const message = `The ${target} packager reads the framework's types from ${packager.types}, which doesn't resolve from ${relative(await realDirectory(root), realOutDir) || "the project's root"}, where the package is built. Without it a declaration's inferred types would be any. Install it where that directory can reach it, or leave ${target} out of package.targets.`;
      diagnostics.push(problem("UF7008", target, message));
    }
  }

  // The registry's order, so the manifest doesn't follow the order of a list in the config (P8).
  const packagers = (Object.entries(PACKAGERS) as [TargetName, Packager][]).filter(([target]) =>
    requested.includes(target),
  );

  return {
    diagnostics,
    run: async () => {
      await mkdir(config.outDir, { recursive: true });
      // Built beside the last good package, and swapped in only once every packager has passed.
      // The real path: tsgo roots itself at what it's given, and Rolldown names files by real paths.
      const stage = await realpath(await mkdtemp(join(config.outDir, ".package-")));
      // A directory of its own, as `mkdtemp`'s mode is private and would survive the rename.
      const built = join(stage, PACKAGE_DIRECTORY);
      try {
        for (const [target, packager] of packagers) {
          const work = join(stage, "work", target);
          const tree = relative(root, join(config.outDir, target));
          await mkdir(work, { recursive: true });
          try {
            await packager.run({
              files: trees.get(target) ?? [],
              out: join(built, target),
              work,
              resolve: resolverFrom(from(target)),
            });
          } catch (error) {
            const message = `The ${target} packager failed: ${failure(error, work, tree)}`;
            return [problem("UF7009", target, message)];
          }
        }
        await mkdir(built, { recursive: true });
        await writeFile(join(built, "package.json"), manifest(fields, packagers));
        for (const [file, path] of shipped) {
          const to = join(built, "source", path);
          await mkdir(dirname(to), { recursive: true });
          await copyFile(join(root, file), to);
        }
        const directory = join(config.outDir, PACKAGE_DIRECTORY);
        await rm(directory, { recursive: true, force: true });
        await rename(built, directory);
        return [];
      } finally {
        await rm(stage, { recursive: true, force: true });
      }
    },
  };
}
