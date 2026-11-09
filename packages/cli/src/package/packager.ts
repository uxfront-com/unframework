import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import type { OutputFile } from "@unframework/compiler";

/** A subpath's entry in `exports`: a path, or conditions that each hold one. */
export type SubpathExports = string | { readonly [condition: string]: SubpathExports };

/** An optional peer of the package. */
export interface PackagePeer {
  name: string;
  range: string;
}

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
  /** The framework, an optional peer of the package, or its packages where there are several. */
  peer: PackagePeer | readonly PackagePeer[];
  /** What must resolve from `package.resolveFrom`, checked before anything is written (UF7008). */
  needs: readonly string[];
  /**
   * The package whose types a declaration's inferred types come from, which must be in the project.
   * tsgo and vue-tsc write declarations with `--noCheck`, so without it a return type is `any`,
   * silently.
   */
  types?: string;
  /** The target's subpath in the manifest's `exports`, or how to read it from a finished `out`. */
  exports: SubpathExports | ((out: string) => Promise<SubpathExports>);
  /** Fills `out`. What it throws is the packager's failure (UF7009). */
  run(input: PackagerInput): Promise<void>;
}

/**
 * A declaration's side-effect imports gone. One holds no types, and one a declaration keeps is an
 * error (TS2882) in a consumer with `skipLibCheck` off, since nothing declares a sheet's module there.
 */
export const dropSideEffectImports = (code: string): string =>
  code.replace(/^import "[^"]+";\n/gm, "");

/**
 * Runs a tool's script in `cwd`. A failure throws what the tool printed: tsc prints to stdout, and
 * a tool that reports progress there, like ng-packagr, passes `"stderr"` to skip it.
 */
export async function runScript(
  script: string,
  args: readonly string[],
  cwd: string,
  errors: "stdout" | "stderr" = "stdout",
): Promise<void> {
  await promisify(execFile)(process.execPath, [script, ...args], {
    cwd,
    maxBuffer: 2 ** 28,
  }).catch((error: { stdout?: string; stderr?: string; message: string }) => {
    const printed = errors === "stderr" ? error.stderr : error.stdout || error.stderr;
    throw new Error(printed || error.message);
  });
}

export async function writeFiles(directory: string, files: readonly OutputFile[]): Promise<void> {
  for (const file of files) {
    const path = join(directory, file.path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, file.contents);
  }
}
