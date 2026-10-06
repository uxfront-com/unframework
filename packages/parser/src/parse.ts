import { parseSync } from "oxc-parser";
import type { Comment, EcmaScriptModule, Program } from "oxc-parser";

import { moduleEarlyErrors } from "./early-errors.ts";

/** A half-open range `[start, end)` of UTF-16 offsets into the source. */
export interface Span {
  start: number;
  end: number;
}

/** A syntax error, with the parser's labelled spans. */
export interface ParseError {
  message: string;
  span: Span;
  labels: { span: Span; message: string | undefined }[];
  help: string | undefined;
}

/** A parsed `.uf.tsx` or `.uf.ts` module. */
export interface ParsedModule {
  file: string;
  source: string;
  /** The TS-ESTree AST. Offsets are UTF-16 code units. */
  program: Program;
  /** Static imports and exports, as the parser records them. */
  module: EcmaScriptModule;
  comments: Comment[];
  errors: ParseError[];
}

/**
 * Parses a module with oxc. The language follows the extension: `.tsx` files (including
 * `.uf.tsx`) are TSX, everything else is TypeScript. Never throws: syntax problems, and the
 * module's early errors (duplicate declarations and exports), are returned in `errors`.
 *
 * Every node carries `range` beside `start` and `end`: the analyser's scope analysis
 * (`@typescript-eslint/scope-manager`, ADR-0035) reads it to resolve references, and fails
 * without it.
 */
export function parseModule(file: string, source: string): ParsedModule {
  const result = parseSync(file, source, {
    lang: file.endsWith(".tsx") ? "tsx" : "ts",
    sourceType: "module",
    astType: "ts",
    preserveParens: false,
    showSemanticErrors: true,
    range: true,
  });
  const errors = result.errors.map((error): ParseError => {
    const labels = error.labels.map((label) => ({
      span: { start: label.start, end: label.end },
      message: label.message ?? undefined,
    }));
    return {
      message: error.message,
      span: labels[0]?.span ?? { start: 0, end: 0 },
      labels,
      help: error.helpMessage ?? undefined,
    };
  });
  return {
    file,
    source,
    program: result.program,
    module: result.module,
    comments: result.comments,
    errors: [...errors, ...moduleEarlyErrors(result.program, source, errors)],
  };
}
