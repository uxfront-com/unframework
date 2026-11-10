// A case's sources, compiled together (ADR-0057). Each `.uf.tsx` of a case compiles on its own to
// every target, and the case's artefacts join the results: one `diagnostics.json` and one
// `diagnostics.txt` for every source, and one `__output__/<target>/` tree that every source's
// files share. Plain functions, so `sources.unit.test.ts` proves them on a fixture of its own.
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";

import { createFileResolver, createSyntacticOracle } from "@unframework/compiler";
import type { CompileResult, Resolver, TypeOracle } from "@unframework/compiler";
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

/**
 * Every source's text by its file name, as its diagnostics name it, and the text of each other
 * file a diagnostic points into: a stylesheet beside the sources (UF5002, UF5004, ADR-0063).
 */
export function sourceTexts(compiles: readonly SourceCompile[]): Map<string, string> {
  const texts = new Map(compiles.map(({ source, text }) => [source.filename, text]));
  for (const { source, result } of compiles) {
    // The cases directory: the source's path, without its file name relative to it.
    const root = source.source.slice(0, source.source.length - source.filename.length);
    for (const { file } of result.diagnostics) {
      if (!texts.has(file)) texts.set(file, readFileSync(join(root, file), "utf8"));
    }
  }
  return texts;
}

/** Every source's diagnostics in one list, sorted by file, then by span. */
export function caseDiagnostics(compiles: readonly SourceCompile[]): Diagnostic[] {
  return sortDiagnostics(compiles.flatMap(({ result }) => result.diagnostics));
}

/**
 * One target's output files of every source, by path in `__output__/<target>/`, and the paths
 * two sources both produce: each file is named by its component (ADR-0053), so two components
 * of a case may not share a name on any target. Paths that differ only in case collide too, as
 * UF1104's names do: a case-insensitive file system (macOS) holds one file for both. Two sources
 * that import one shared `.ts` module each copy it (ADR-0070): a path two sources produce with
 * the same contents is one file.
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
      if (other !== undefined && files.get(file.path) === file.contents) continue;
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
 * An import of anything else is unresolved (UF1202), which fails the compile project. The
 * children's types are read through `typeOracle`, the compile's own (ADR-0067).
 */
export function caseResolver(
  info: Pick<CaseInfo, "dir">,
  casesDir: string,
  typeOracle?: TypeOracle,
): Resolver {
  return createFileResolver({
    root: casesDir.split(sep).join("/"),
    readFile: async (path) => {
      const file = join(path);
      if (relative(info.dir, dirname(file)) !== "") return undefined;
      return readFile(file, "utf8").catch(() => undefined);
    },
    ...(typeOracle ? { typeOracle } : {}),
  });
}

/**
 * The type oracle a case's sources compile with (ADR-0067): the syntactic adapter over the cases
 * directory, which reads the case's own files, as `caseResolver` does, and the packages they
 * import, from `node_modules`. Any other file is missing (UF6001). `compiled` is the source a
 * compile is given, which the oracle reads for its file: a canary's corruption of it, or the
 * source with its fixes applied.
 */
export function caseOracle(
  info: Pick<CaseInfo, "dir">,
  casesDir: string,
  compiled: { filename: string; text: string },
): TypeOracle {
  const root = casesDir.split(sep).join("/");
  return createSyntacticOracle({
    root,
    readFile: async (path) => {
      if (path === `${root}/${compiled.filename}`) return compiled.text;
      const file = join(path);
      if (relative(info.dir, dirname(file)) !== "" && !file.split(sep).includes("node_modules")) {
        return undefined;
      }
      return readFile(file, "utf8").catch(() => undefined);
    },
  });
}
