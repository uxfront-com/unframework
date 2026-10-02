// What L3 and L4 make of a toolchain's results (DESIGN §4.1). A case fails on every message the
// tool reported on its own output files, and on every message the tool reported on any other
// path: the toolchain's tsconfig (an option the checker does not know is ignored, so the check
// is weaker than configured), or a file an output imports. Each case was checked with that
// configuration, so each fails, loudly, rather than passing a check that did not run as set up.
import { relative, sep } from "node:path";

import type { FrameworkCompileResult, ToolchainMessage } from "@unframework/codegen";

import { ROOT } from "./paths.ts";

/** L3: the framework compiler's errors and warnings on a case's files, and outside the outputs. */
export function frameworkCompileProblems(
  results: ReadonlyMap<string, FrameworkCompileResult>,
  caseFiles: readonly string[],
  outputs: ReadonlySet<string>,
): string[] {
  const problems = caseFiles.flatMap((file) => {
    const result = results.get(file);
    return result
      ? describeCompile(file, result)
      : [`${display(file)}: the framework compiler reported nothing for this file.`];
  });
  const outside = [...results].filter(([path]) => !outputs.has(path));
  const elsewhere = outside.flatMap(([path, result]) => describeCompile(path, result));
  if (elsewhere.length) {
    problems.push("The framework compiler reported problems outside the outputs:", ...elsewhere);
  }
  return problems;
}

/** L4: every checker diagnostic on a case's files, and outside the outputs. */
export function typecheckProblems(
  results: ReadonlyMap<string, readonly ToolchainMessage[]>,
  caseFiles: readonly string[],
  outputs: ReadonlySet<string>,
): string[] {
  const problems = caseFiles.flatMap((file) => {
    const messages = results.get(file);
    return messages
      ? describeCheck(file, messages)
      : [`${display(file)}: the checker reported nothing for this file.`];
  });
  const outside = [...results].filter(([path]) => !outputs.has(path));
  const elsewhere = outside.flatMap(([path, messages]) => describeCheck(path, messages));
  if (elsewhere.length) {
    problems.push("The checker reported problems outside the outputs:", ...elsewhere);
  }
  return problems;
}

/** A path as the report shows it: relative to the integration package. */
export function display(path: string): string {
  return relative(ROOT, path).split(sep).join("/");
}

function describeCompile(path: string, result: FrameworkCompileResult): string[] {
  return [
    ...result.errors.map((message) => `${display(path)}: error ${describeMessage(message)}`),
    ...result.warnings.map((message) => `${display(path)}: warning ${describeMessage(message)}`),
  ];
}

/** A checker's diagnostics carry no kind: L4 tolerates none of them. */
function describeCheck(path: string, messages: readonly ToolchainMessage[]): string[] {
  return messages.map((message) => `${display(path)}: ${describeMessage(message)}`);
}

function describeMessage(message: ToolchainMessage): string {
  const column = message.column === undefined ? "" : `, column ${message.column}`;
  const at = message.line === undefined ? "" : ` (line ${message.line}${column})`;
  return `${message.code ? `${message.code} ` : ""}${message.message}${at}`;
}
