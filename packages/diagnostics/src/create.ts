import { catalogue } from "./catalogue.ts";
import type {
  Diagnostic,
  DiagnosticCode,
  Fix,
  RelatedInformation,
  Severity,
  Span,
} from "./types.ts";

/** What a pass knows when it reports a catalogued diagnostic. */
export interface DiagnosticInit {
  file: string;
  span: Span;
  message: string;
  severity?: Severity;
  help?: string;
  fixes?: Fix[];
  related?: RelatedInformation[];
  target?: string;
}

/**
 * Creates a diagnostic for a catalogued code, with the catalogue's default severity.
 * An uncatalogued code is a bug in the caller, so it is reported as UF9001.
 */
export function createDiagnostic(code: DiagnosticCode, init: DiagnosticInit): Diagnostic {
  const entry = catalogue.get(code);
  if (!entry) {
    return {
      code: "UF9001",
      severity: "error",
      message: `Internal: the compiler reported the uncatalogued code ${code} (${init.message})`,
      file: init.file,
      span: init.span,
      ...(init.target ? { target: init.target } : {}),
    };
  }
  const diagnostic: Diagnostic = {
    code,
    severity: init.severity ?? entry.severity,
    message: init.message,
    file: init.file,
    span: init.span,
  };
  if (init.related?.length) diagnostic.related = init.related;
  if (init.help) diagnostic.help = init.help;
  if (init.fixes?.length) diagnostic.fixes = init.fixes;
  if (init.target) diagnostic.target = init.target;
  return diagnostic;
}

/** Whether any diagnostic is an error. */
export function hasErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}

/** Sorts diagnostics by file, position, target and code, so output is deterministic. */
export function sortDiagnostics(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return diagnostics.toSorted(
    (a, b) =>
      compare(a.file, b.file) ||
      a.span.start - b.span.start ||
      a.span.end - b.span.end ||
      compare(a.target ?? "", b.target ?? "") ||
      compare(a.code, b.code) ||
      compare(a.message, b.message),
  );
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
