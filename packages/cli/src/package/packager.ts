import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
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

/** Runs a tool's script in `cwd`. A failure throws what the tool printed: tsc prints to stdout. */
export async function runScript(
  script: string,
  args: readonly string[],
  cwd: string,
): Promise<void> {
  await promisify(execFile)(process.execPath, [script, ...args], {
    cwd,
    maxBuffer: 2 ** 28,
  }).catch((error: { stdout?: string; stderr?: string; message: string }) => {
    throw new Error(error.stdout || error.stderr || error.message);
  });
}

export async function writeFiles(directory: string, files: readonly OutputFile[]): Promise<void> {
  for (const file of files) {
    const path = join(directory, file.path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, file.contents);
  }
}
