import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

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
   * Without it tsdown's declarations, which tsgo writes with `--noCheck`, type a return as `any`,
   * silently, and vue-tsc fails only after the trees are written.
   */
  types?: string;
  /** The target's subpath in the manifest's `exports`. */
  exports: string | Readonly<Record<string, string>>;
  /** Fills `out`. What it throws is the packager's failure (UF7009). */
  run(input: PackagerInput): Promise<void>;
}

export async function writeFiles(directory: string, files: readonly OutputFile[]): Promise<void> {
  for (const file of files) {
    const path = join(directory, file.path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, file.contents);
  }
}
