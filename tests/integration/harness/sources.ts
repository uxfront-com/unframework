// A case's sources, compiled together (ADR-0057). Each `.uf.tsx` of a case compiles on its own to
// every target, and the case's artefacts join the results: one `diagnostics.json` and one
// `diagnostics.txt` for every source, and one `__output__/<target>/` tree that every source's
// files share. Plain functions, so `sources.unit.test.ts` proves them on a fixture of its own.
import type { CompileResult } from "@unframework/compiler";
import { sortDiagnostics } from "@unframework/diagnostics";
import type { Diagnostic } from "@unframework/diagnostics";

import type { CaseSource } from "./cases.ts";

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
 * of a case may not share a name on any target.
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
      const other = producer.get(file.path);
      if (other !== undefined) {
        problems.push(
          `${other} and ${source.filename} both produce ${target}/${file.path}: the components of a case need names of their own on every target.`,
        );
        continue;
      }
      producer.set(file.path, source.filename);
      files.set(file.path, file.contents);
    }
  }
  return { files, problems };
}
