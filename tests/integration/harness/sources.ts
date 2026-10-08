// A case's sources, compiled together (ADR-0057). Each `.uf.tsx` of a case compiles on its own to
// every target, and the case's artefacts join the results: one `diagnostics.json` and one
// `diagnostics.txt` for every source, and one `__output__/<target>/` tree that every source's
// files share. Plain functions, so `sources.unit.test.ts` proves them on a fixture of its own.
import { readFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";

import { createFileResolver } from "@unframework/compiler";
import type { CompileResult, Resolver } from "@unframework/compiler";
import { sortDiagnostics } from "@unframework/diagnostics";
import type { Diagnostic } from "@unframework/diagnostics";

import type { CaseInfo, CaseSource } from "./cases.ts";

/** One source of a case and its compile to every target. */
export interface SourceCompile {
  source: CaseSource;
  /** What was compiled: the input, or the input a source canary corrupted. */
  text: string;
  result: Pick<CompileResult, "diagnostics" | "outputs">;
}

/** Every source's text by its file name, as its diagnostics name it. */
export function sourceTexts(compiles: readonly SourceCompile[]): Map<string, string> {
  return new Map(compiles.map(({ source, text }) => [source.filename, text]));
}

/** Every source's diagnostics in one list, sorted by file, then by span. */
export function caseDiagnostics(compiles: readonly SourceCompile[]): Diagnostic[] {
  return sortDiagnostics(compiles.flatMap(({ result }) => result.diagnostics));
}

/**
 * One target's output files of every source, by path in `__output__/<target>/`, and the paths
 * two sources both produce: each file is named by its component (ADR-0053), so two components
 * of a case may not share a name on any target. Paths that differ only in case collide too, as
 * UF1104's names do: a case-insensitive file system (macOS) holds one file for both.
 */
export function caseOutputs(
  compiles: readonly SourceCompile[],
  target: string,
): { files: Map<string, string>; problems: string[] } {
  const files = new Map<string, string>();
  const producer = new Map<string, string>();
  const problems: string[] = [];
  for (const { source, result } of compiles) {
    for (const file of result.outputs[target] ?? []) {
      const key = file.path.toLowerCase();
      const other = producer.get(key);
      if (other !== undefined) {
        problems.push(
          `${other} and ${source.filename} both produce ${target}/${file.path}: the components of a case need names of their own on every target.`,
        );
        continue;
      }
      producer.set(key, source.filename);
      files.set(file.path, file.contents);
    }
  }
  return { files, problems };
}

/**
 * The resolver a case's sources compile with (ADR-0057): `createFileResolver` over the cases
 * directory, which finds only the files of the case itself, so each case stays self-contained.
 * An import of anything else is unresolved (UF1202), which fails the compile project.
 */
export function caseResolver(info: Pick<CaseInfo, "dir">, casesDir: string): Resolver {
  return createFileResolver({
    root: casesDir.split(sep).join("/"),
    readFile: async (path) => {
      const file = join(path);
      if (relative(info.dir, dirname(file)) !== "") return undefined;
      return readFile(file, "utf8").catch(() => undefined);
    },
  });
}
