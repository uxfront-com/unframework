// The compile project's checks besides the artefact comparisons: L1's fixes and what a case
// may expect, and L2's determinism and formatting. Plain functions, so `compile-checks.unit.test.ts` can prove each
// one catches what it exists for, on the real compiler; the compile project runs them on every
// case and target.
import { formatOutput } from "@unframework/codegen";
import type { Capabilities, OutputFile } from "@unframework/codegen";
import { builtinTargets } from "@unframework/compiler";
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
