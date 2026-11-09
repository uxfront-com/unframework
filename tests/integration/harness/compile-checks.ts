// The compile project's checks besides the artefact comparisons: L1's fixes and what a case
// may expect, L2's determinism and formatting, the scoped sheets' parse, and L14's source maps. Plain functions, so `compile-checks.unit.test.ts` can prove each
// one catches what it exists for, on the real compiler; the compile project runs them on every
// case and target.
import { posix } from "node:path";

import { decodedMappings, TraceMap } from "@jridgewell/trace-mapping";
import { formatOutput } from "@unframework/codegen";
import type { Capabilities, OutputFile } from "@unframework/codegen";
import { builtinTargets } from "@unframework/compiler";
import type { CompileResult } from "@unframework/compiler";
import { applyFixes } from "@unframework/diagnostics";
import type { Diagnostic } from "@unframework/diagnostics";
import { parseStylesheet } from "@unframework/parser";
import { diffLines } from "@unframework/testing/node";

/** The diagnostics that concern a target: its own, and those of every target. */
export const forTarget = <T extends { target?: string | undefined }>(
  list: readonly T[],
  target: string,
): T[] =>
  list.filter((diagnostic) => diagnostic.target === undefined || diagnostic.target === target);

/** The built-in targets by any name: a name that is no target has no capability matrix. */
const targetsByName: Readonly<Record<string, { capabilities: Capabilities } | undefined>> =
  builtinTargets;

/** What {@link expectationProblems} reads of an expected diagnostic. */
export interface ExpectedDiagnosticText {
  code: string;
  severity: string;
  message: string;
  target?: string | undefined;
}

/**
 * L1: what a case's expected diagnostics may hold for a target, as problems (P2). No internal
 * error (UF9xxx) is ever an expectation: it is a compiler bug to fix, and an expectation would
 * keep it green. A case with a spec (a feature case, not a diagnostics case) expects no error
 * for the target but the one its capability matrix declares for a capability it lacks (a
 * UF4xxx with the cell's severity and reason, ADR-0033): any other error leaves the target
 * without output, and every later layer would skip the case for it.
 */
export function expectationProblems(
  expected: readonly ExpectedDiagnosticText[],
  target: string,
  hasSpec: boolean,
  capabilities: Capabilities | undefined = targetsByName[target]?.capabilities,
): string[] {
  const own = forTarget(expected, target);
  const problems = own
    .filter((diagnostic) => /^UF9\d{3}$/.test(diagnostic.code))
    .map(
      (diagnostic) =>
        `The case expects the internal error ${diagnostic.code} (${diagnostic.message}): an internal error is a compiler bug to fix, never an expectation.`,
    );
  if (!hasSpec) return problems;
  const declared = capabilityCellDiagnostics(target, capabilities);
  for (const diagnostic of own) {
    if (diagnostic.severity !== "error" || /^UF9\d{3}$/.test(diagnostic.code)) continue;
    if (declared.has(cellKey(diagnostic))) continue;
    problems.push(
      `The case has a spec, yet expects the error ${diagnostic.code} for ${target} (${diagnostic.message}), which is not the error the ${target} target declares for a capability it lacks: a feature case compiles on every target, or the target declares the difference (a UF4xxx capability cell).`,
    );
  }
  return problems;
}

/**
 * L1: the rules of a case's own reference (ADR-0057). A case names a target other than the run's
 * reference only when the run's reference has no output for it because it declares a capability
 * the case requires unsupported (Vue's `listbox`), and only a target whose cells for those
 * capabilities are native. A feature case the run's reference has no output for names one, or
 * no target would write its expectations.
 */
export function referenceProblems(
  expected: readonly ExpectedDiagnosticText[],
  hasSpec: boolean,
  runReference: string,
  reference: string | undefined,
): string[] {
  if (!hasSpec) {
    return reference === undefined
      ? []
      : ["The case names a reference, and has no spec: only a spec's expectations have a writer."];
  }
  const capabilities: Partial<Capabilities> = targetsByName[runReference]?.capabilities ?? {};
  const lacking = Object.entries(capabilities).flatMap(([capability, cell]) =>
    cell &&
    cell.support === "unsupported" &&
    cell.severity === "error" &&
    forTarget(expected, runReference).some(
      (diagnostic) =>
        cellKey(diagnostic) ===
        `${cell.code} ${cell.severity} The ${runReference} target does not support ${capability}: ${cell.reason}`,
    )
      ? [capability]
      : [],
  );
  if (reference === undefined) {
    return lacking.length
      ? [
          `${runReference}, the run's reference, has no output for the case: it leaves ${lacking.join(", ")} unsupported. Name a target whose cells are native as the case's "reference" in case.json (ADR-0057), so a reviewed target writes its expectations.`,
        ]
      : [];
  }
  if (!lacking.length) {
    return [
      `The case names ${reference} as its reference, yet ${runReference} renders it: a case names another reference only for a capability ${runReference} leaves unsupported (ADR-0057).`,
    ];
  }
  const cells: Partial<Capabilities> = targetsByName[reference]?.capabilities ?? {};
  return lacking.flatMap((capability) =>
    cells[capability as keyof Capabilities]?.support === "native"
      ? []
      : [
          `The case names ${reference} as its reference, whose ${capability} cell is not native: a case's reference renders what ${runReference} cannot as the capability means it (ADR-0057).`,
        ],
  );
}

/**
 * The diagnostics a target's capability cells report, as {@link cellKey} writes them: one for
 * each capability the target leaves unsupported, with the cell's code, severity and reason, in
 * the compiler's words (ADR-0033). A capability the matrix does not declare is no cell.
 */
function capabilityCellDiagnostics(
  target: string,
  capabilities: Capabilities | undefined = targetsByName[target]?.capabilities,
): Set<string> {
  return new Set(
    Object.entries(capabilities ?? {}).flatMap(([capability, cell]) =>
      cell.support === "unsupported"
        ? [
            `${cell.code} ${cell.severity} The ${target} target does not support ${capability}: ${cell.reason}`,
          ]
        : [],
    ),
  );
}

/** A diagnostic as a capability cell would report it: its code, severity and message. */
function cellKey(diagnostic: { code: string; severity: string; message: string }): string {
  return `${diagnostic.code} ${diagnostic.severity} ${diagnostic.message}`;
}

/**
 * L1: applying every fix of the target's diagnostics and compiling again leaves exactly the
 * diagnostics that had no fix. Throws with the difference otherwise. What the target's
 * capability cells report is left out of the comparison, whatever its severity: a declared
 * difference about a feature the source uses (Astro's inert listeners, Qwik's late props), which
 * the compiler checks only once the module lowers (a fix may be what makes it lower), and which a
 * right fix may bring (a snapshot of an optional prop fixed into a derived value that reads it).
 */
export async function checkFixes(
  source: string,
  diagnostics: readonly Diagnostic[],
  target: string,
  recompile: (source: string) => Promise<readonly Diagnostic[]>,
  capabilities: Capabilities | undefined = targetsByName[target]?.capabilities,
): Promise<void> {
  const own = forTarget(diagnostics, target);
  const fixable = own.filter((diagnostic) => diagnostic.fixes?.length);
  if (!fixable.length) return;
  const fixed = applyFixes(
    source,
    fixable.flatMap((diagnostic) => diagnostic.fixes ?? []),
  );
  const declared = capabilityCellDiagnostics(target, capabilities);
  const compared = (diagnostic: Diagnostic) => !declared.has(cellKey(diagnostic));
  const remaining = own
    .filter((diagnostic) => !fixable.includes(diagnostic) && compared(diagnostic))
    .map(diagnosticKey)
    .toSorted();
  const after = forTarget(await recompile(fixed), target)
    .filter(compared)
    .map(diagnosticKey)
    .toSorted();
  if (after.join("\n") !== remaining.join("\n")) {
    throw new Error(
      `Applying the fixes of ${fixable.map((diagnostic) => diagnostic.code).join(", ")} does not recompile clean:\n${diffLines(remaining.join("\n"), after.join("\n"))}`,
    );
  }
}

/** A diagnostic as the fix check compares it: its code and message, not where it is. */
function diagnosticKey(diagnostic: Diagnostic): string {
  return `${diagnostic.code} ${diagnostic.message}`;
}

/** L2 (P8): how two compiles of one source differ for a target, or `undefined` if they do not. */
export function nondeterminism(
  first: CompileResult,
  second: CompileResult,
  target: string,
): string | undefined {
  const stable = (result: CompileResult) =>
    JSON.stringify({
      ir: result.ir,
      diagnostics: result.diagnostics,
      files: result.outputs[target],
    });
  if (stable(first) === stable(second)) return undefined;
  return `Compiling twice gave different results:\n${diffLines(stable(first).replaceAll(",", ",\n"), stable(second).replaceAll(",", ",\n"))}`;
}

/**
 * Every scoped sheet (`.css`) of a target's output that lightningcss cannot read, or that holds an
 * at-rule it does not know: the check that stands in for L3 on sheets, which no framework
 * compiler reads (ADR-0063, closing ADR-0025's open item).
 */
export function stylesheetProblems(target: string, files: readonly OutputFile[]): string[] {
  return files
    .filter((file) => file.path.endsWith(".css"))
    .flatMap((file) =>
      parseStylesheet(file.path, file.contents).errors.map(
        ({ message, span }) =>
          `${target}/${file.path} is not valid CSS at offset ${span.start}: ${message}`,
      ),
    );
}

/**
 * L2: every copy of a case's `.ts` module in a target's output tree that is not the module
 * byte for byte: each output tree holds the modules unchanged (ADR-0070). A copy sits at the
 * module's own file name; the files an output imports are L4's.
 */
export function moduleCopyProblems(
  target: string,
  outputs: ReadonlyMap<string, string>,
  modules: readonly OutputFile[],
): string[] {
  return modules.flatMap(({ path, contents }) => {
    const copy = outputs.get(path);
    if (copy === undefined || copy === contents) return [];
    return [`${target}/${path} is not the case's ${path} unchanged:\n${diffLines(contents, copy)}`];
  });
}

/** L2: every output file that formatting again would change, or that no longer parses. */
export async function formattingProblems(
  target: string,
  files: readonly OutputFile[],
): Promise<string[]> {
  const problems: string[] = [];
  for (const file of files) {
    const again = await formatOutput(file);
    if (again.error) {
      problems.push(`${target}/${file.path} does not parse when formatted again: ${again.error}`);
    } else if (again.file.contents !== file.contents) {
      problems.push(
        `${target}/${file.path} is not formatted idempotently:\n${diffLines(file.contents, again.file.contents)}`,
      );
    }
  }
  return problems;
}

/**
 * A token of the source, as the compiler anchors them (`packages/codegen/src/sourcemap.ts`): a
 * word or a number whole, any other character alone. Written out here so that a change to the
 * compiler's tokens can't quietly change what this check compares.
 */
const SOURCE_TOKEN = /[\p{ID_Start}$_][\p{ID_Continue}$]*|\d[\w.]*|\S/uy;

/** What `mappings` may hold: VLQ digits, split into segments and lines. */
const VLQ = /^[A-Za-z0-9+/,;]*$/;

/** The source's token at a column of one of its lines, or `""` where there is none. */
export function sourceTokenAt(line: string, column: number): string {
  SOURCE_TOKEN.lastIndex = column;
  return SOURCE_TOKEN.exec(line)?.[0] ?? "";
}

/** The source a target's output files were compiled from. */
export interface MapSource {
  filename: string;
  text: string;
}

/**
 * L14 (ADR-0078): every way a target's output files' maps fail to round-trip to the source. Each
 * map decodes and names its one source with that source's content, relative to the file: the
 * `.uf.tsx`, or for a copy of a shared module (`modules`, by path) the copy itself (ADR-0070).
 * Each segment without a name maps to the same text in both files, read for the length of the
 * source's token: oxfmt may lengthen a number the output still starts with (`5.` to `5.0`), and a
 * token it rewrites otherwise has lost its segment (ADR-0074). A segment with a name marks a
 * reference, which a target respells, so only its position is checked. A scoped sheet's text
 * comes from a stylesheet, so its map holds no segments (ADR-0063).
 */
export function sourceMapProblems(
  target: string,
  files: readonly OutputFile[],
  source: MapSource,
  modules: ReadonlySet<string>,
): string[] {
  return files.flatMap((file) => fileMapProblems(`${target}/${file.path}`, file, source, modules));
}

function fileMapProblems(
  where: string,
  file: OutputFile,
  source: MapSource,
  modules: ReadonlySet<string>,
): string[] {
  const { map } = file;
  if (!map) return [`${where} has no source map.`];
  const copy = modules.has(file.path);
  const expected = copy ? posix.basename(file.path) : posix.basename(source.filename);
  const text = copy ? file.contents : source.text;
  const named = map.sources.map((name) =>
    posix.normalize(posix.join(posix.dirname(file.path), name)),
  );
  if (named.length !== 1 || named[0] !== expected) {
    return [`${where}'s map names ${JSON.stringify(map.sources)}, not its source ${expected}.`];
  }
  if (map.sourcesContent[0] !== text) {
    return [`${where}'s map does not hold the content of its source ${expected}.`];
  }
  // The decoder reads a character outside the alphabet as zero rather than throw on it.
  if (!VLQ.test(map.mappings)) return [`${where}'s map does not decode: its mappings are not VLQ.`];
  const lines = decodedMappings(new TraceMap(map));
  const segments = lines.reduce((count, line) => count + line.length, 0);
  if (file.path.endsWith(".css")) {
    return segments ? [`${where}'s map has ${segments} segment(s): a scoped sheet has none.`] : [];
  }
  const outputLines = file.contents.split("\n");
  const sourceLines = text.split("\n");
  const wrong: string[] = [];
  for (const [line, row] of lines.entries()) {
    for (const segment of row) {
      if (segment.length === 1) continue;
      const [column, index, fromLine, fromColumn] = segment;
      const output = outputLines[line];
      const original = sourceLines[fromLine];
      if (
        index !== 0 ||
        output === undefined ||
        original === undefined ||
        !(column >= 0 && column <= output.length) ||
        !(fromColumn >= 0 && fromColumn <= original.length)
      ) {
        wrong.push(`${line + 1}:${column} points outside its files`);
        continue;
      }
      if (segment.length === 5) continue;
      const token = sourceTokenAt(original, fromColumn);
      const reads = output.slice(column, column + token.length);
      if (!token || reads !== token) {
        wrong.push(
          `${line + 1}:${column} reads ${JSON.stringify(reads)}, where ${expected}:${fromLine + 1}:${fromColumn} reads ${JSON.stringify(token)}`,
        );
      }
    }
  }
  if (!wrong.length) return [];
  // One map can hold thousands of wrong tokens, so the first says what the rest would.
  return [`${where}'s map has ${wrong.length} wrong segment(s), the first at ${wrong[0]}.`];
}

/**
 * How many segments of a compiled file's map compare text (ADR-0074): those without a name. A
 * copy of a shared module names itself and counts none, since its identity map says nothing of
 * how the compiler maps a source.
 */
export function comparedSegments(file: OutputFile): number {
  if (!file.map || file.map.sources[0] === posix.basename(file.path)) return 0;
  return decodedMappings(new TraceMap(file.map))
    .flat()
    .filter((segment) => segment.length === 4).length;
}
