import { execFile } from "node:child_process";
import { glob, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import type { OutputFile } from "@unframework/compiler";

/** What one target's packager works on. */
export interface PackagerInput {
  /** The target's files as `compile()` gave them, so with no map (ADR-0077). */
  files: readonly OutputFile[];
  /** The directory to fill, which becomes `package/<target>`. */
  out: string;
  /** A scratch directory inside the project, from which the framework resolves. */
  work: string;
  /** Resolves a module from `package.resolveFrom`. */
  resolve: (module: string) => string;
}

/** One target's line in the registry (ADR-0077). */
export interface Packager {
  /** The framework, an optional peer of the package. */
  peer: { name: string; range: string };
  /** What must resolve from `package.resolveFrom`, checked before anything is written (UF7008). */
  needs: readonly string[];
  /**
   * The package whose types a declaration's inferred types come from, which must be in the project.
   * tsgo and vue-tsc write declarations with `--noCheck`, so without it a return type is `any`,
   * silently.
   */
  types?: string;
  /** The target's subpath in the manifest's `exports`. */
  exports: string | Readonly<Record<string, string>>;
  /** Fills `out`. What it throws is the packager's failure (UF7009). */
  run(input: PackagerInput): Promise<void>;
}

/**
 * A declaration's side-effect imports gone. One holds no types, and one a declaration keeps is an
 * error (TS2882) in a consumer with `skipLibCheck` off, since nothing declares a sheet's module there.
 */
export const dropSideEffectImports = (code: string): string =>
  code.replace(/^import "[^"]+";\n/gm, "");

/** {@link dropSideEffectImports} over every declaration a tool wrote to a directory. */
export async function dropDeclarationSideEffects(directory: string): Promise<void> {
  for await (const file of glob("**/*.d.ts", { cwd: directory })) {
    const path = join(directory, file);
    await writeFile(path, dropSideEffectImports(await readFile(path, "utf8")));
  }
}

/** The script a package's manifest names for the first of these binaries it has. */
export async function binOf(manifest: string, ...names: readonly string[]): Promise<string> {
  const { name: owner, bin }: { name: string; bin: Readonly<Record<string, string>> } = JSON.parse(
    await readFile(manifest, "utf8"),
  );
  const script = names.map((name) => bin[name]).find((path) => path !== undefined);
  if (script === undefined) throw new Error(`${owner} has no ${names.join(" or ")} binary.`);
  return join(dirname(manifest), script);
}

/** TypeScript's compiler. `@typescript/typescript6`, installed under the name `typescript`, calls it `tsc6`. */
export const tscOf = (manifest: string): Promise<string> => binOf(manifest, "tsc", "tsc6");

/**
 * Runs a tool's script in `cwd`, and gives what it warned on stderr. A failure throws what the tool
 * printed: tsc prints to stdout.
 */
export async function runScript(
  script: string,
  args: readonly string[],
  cwd: string,
): Promise<string> {
  const { stderr } = await promisify(execFile)(process.execPath, [script, ...args], {
    cwd,
    maxBuffer: 2 ** 28,
  }).catch((error: { stdout?: string; stderr?: string; message: string }) => {
    throw new Error(error.stdout || error.stderr || error.message);
  });
  return stderr;
}

export async function writeFiles(directory: string, files: readonly OutputFile[]): Promise<void> {
  for (const file of files) {
    const path = join(directory, file.path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, file.contents);
  }
}
