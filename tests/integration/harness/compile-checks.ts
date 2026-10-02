// The compile project's checks besides the artefact comparisons: L1's fixes, and L2's
// determinism and formatting. Plain functions, so `compile-checks.unit.test.ts` can prove each
// one catches what it exists for, on the real compiler; the compile project runs them on every
// case and target.
import { formatOutput } from "@unframework/codegen";
import type { OutputFile } from "@unframework/codegen";
import type { CompileResult } from "@unframework/compiler";
import { applyFixes } from "@unframework/diagnostics";
import type { Diagnostic } from "@unframework/diagnostics";
import { diffLines } from "@unframework/testing/node";

/** The diagnostics that concern a target: its own, and those of every target. */
export const forTarget = <T extends { target?: string | undefined }>(
  list: readonly T[],
  target: string,
): T[] =>
  list.filter((diagnostic) => diagnostic.target === undefined || diagnostic.target === target);

/**
 * L1: applying every fix of the target's diagnostics and compiling again leaves exactly the
 * diagnostics that had no fix. Throws with the difference otherwise.
 */
export async function checkFixes(
  source: string,
  diagnostics: readonly Diagnostic[],
  target: string,
  recompile: (source: string) => Promise<readonly Diagnostic[]>,
): Promise<void> {
  const own = forTarget(diagnostics, target);
  const fixable = own.filter((diagnostic) => diagnostic.fixes?.length);
  if (!fixable.length) return;
  const fixed = applyFixes(
    source,
    fixable.flatMap((diagnostic) => diagnostic.fixes ?? []),
  );
  const remaining = own
    .filter((diagnostic) => !fixable.includes(diagnostic))
    .map(diagnosticKey)
    .toSorted();
  const after = forTarget(await recompile(fixed), target)
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
