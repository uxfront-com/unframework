import { docsUrl } from "./catalogue.ts";
import { strictPositions } from "./location.ts";
import type { Position } from "./location.ts";
import type { Diagnostic, DiagnosticCode, Severity } from "./types.ts";

/** A diagnostic with resolved positions: the `--format json` output for agents and CI. */
export interface JsonDiagnostic {
  code: DiagnosticCode;
  severity: Severity;
  message: string;
  file: string;
  start: Position;
  end: Position;
  url: string;
  help?: string;
  target?: string;
  related?: { start: Position; end: Position; message: string }[];
  fixes?: Diagnostic["fixes"];
}

/**
 * Resolves diagnostics' spans to lines and columns. `sources` must hold the source of every
 * diagnostic's file: a missing source, or a span outside its file, throws instead of writing
 * a wrong position.
 */
export function toJsonDiagnostics(
  diagnostics: readonly Diagnostic[],
  sources: ReadonlyMap<string, string>,
): JsonDiagnostic[] {
  const position = strictPositions(sources, "toJsonDiagnostics");
  return diagnostics.map((diagnostic) => {
    const file = diagnostic.file;
    const json: JsonDiagnostic = {
      code: diagnostic.code,
      severity: diagnostic.severity,
      message: diagnostic.message,
      file,
      start: position(file, diagnostic.span.start),
      end: position(file, diagnostic.span.end),
      url: docsUrl(diagnostic.code),
    };
    if (diagnostic.help) json.help = diagnostic.help;
    if (diagnostic.target) json.target = diagnostic.target;
    if (diagnostic.related) {
      json.related = diagnostic.related.map((related) => ({
        start: position(file, related.span.start),
        end: position(file, related.span.end),
        message: related.message,
      }));
    }
    if (diagnostic.fixes) json.fixes = diagnostic.fixes;
    return json;
  });
}
