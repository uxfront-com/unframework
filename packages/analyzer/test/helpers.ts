import { applyFixes } from "@unframework/diagnostics";
import type { Diagnostic } from "@unframework/diagnostics";
import { checkInvariants } from "@unframework/ir";
import { parseModule } from "@unframework/parser";

import { analyze } from "../src/index.ts";
import type { AnalyzeResult } from "../src/index.ts";

/**
 * Analyses a source. Every test that runs the analyser also checks that the IR it lowers keeps
 * the IR's invariants, which the compiler would otherwise report as an internal error.
 */
export function run(source: string, file = "Test.uf.tsx"): AnalyzeResult {
  const result = analyze(parseModule(file, source));
  if (result.module) {
    const broken = checkInvariants(result.module);
    if (broken.length) {
      throw new Error(`The IR of ${JSON.stringify(source)} breaks: ${JSON.stringify(broken)}`);
    }
  }
  for (const diagnostic of result.diagnostics) {
    if (typeof diagnostic.message !== "string") {
      throw new TypeError(`A ${diagnostic.code} of ${JSON.stringify(source)} has no message.`);
    }
  }
  return result;
}

/** Analyses a component that returns `jsx`. */
export function component(jsx: string): { source: string } & AnalyzeResult {
  const source = `export function A() { return ${jsx}; }`;
  return { source, ...run(source) };
}

export function codes(diagnostics: readonly Diagnostic[]): string[] {
  return diagnostics.map((diagnostic) => diagnostic.code);
}

export function slices(source: string, diagnostics: readonly Diagnostic[]): string[] {
  return diagnostics.map((diagnostic) => source.slice(diagnostic.span.start, diagnostic.span.end));
}

/**
 * Applies every fix and analyses the result, as the harness's L1 does: the diagnostics that
 * had no fix must be exactly what remains. Returns the fixed source.
 */
export function applyAndRecheck(source: string, diagnostics: readonly Diagnostic[]): string {
  const fixable = diagnostics.filter((diagnostic) => diagnostic.fixes?.length);
  const fixed = applyFixes(
    source,
    fixable.flatMap((diagnostic) => diagnostic.fixes ?? []),
  );
  const key = (diagnostic: Diagnostic) => `${diagnostic.code} ${diagnostic.message}`;
  const remaining = diagnostics.filter((diagnostic) => !fixable.includes(diagnostic)).map(key);
  const after = run(fixed).diagnostics.map(key);
  if (after.join("\n") !== remaining.join("\n")) {
    throw new Error(
      `The fixes do not recompile clean.\nFixed source: ${fixed}\nExpected:\n${remaining.join("\n")}\nGot:\n${after.join("\n")}`,
    );
  }
  return fixed;
}
