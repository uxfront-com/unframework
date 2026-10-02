import { transform } from "lightningcss";

import type { Span } from "./parse.ts";

/**
 * A parsed stylesheet. Scoping (M4) rewrites the selectors through lightningcss's own AST in
 * the target kit, so the parser reports only whether the sheet parses.
 */
export interface ParsedStylesheet {
  file: string;
  source: string;
  errors: { message: string; span: Span }[];
}

const encoder = new TextEncoder();

/** Parses a stylesheet with lightningcss. Never throws: a syntax error is returned in `errors`. */
export function parseStylesheet(file: string, source: string): ParsedStylesheet {
  try {
    transform({ filename: file, code: encoder.encode(source), errorRecovery: false });
    return { file, source, errors: [] };
  } catch (error) {
    const { message, loc } = error as { message: string; loc?: { line: number; column: number } };
    const offset = loc ? offsetOf(source, loc.line, loc.column) : 0;
    return { file, source, errors: [{ message, span: { start: offset, end: offset } }] };
  }
}

/**
 * The UTF-16 offset of lightningcss's error location: a 1-based line and a 1-based column in
 * UTF-16 code units. Lines end at CSS's line breaks: LF, CRLF, CR and form feed.
 */
function offsetOf(source: string, line: number, column: number): number {
  let offset = 0;
  for (let current = 1; current < line; current++) {
    const end = /\r\n|[\n\r\f]/g;
    end.lastIndex = offset;
    const match = end.exec(source);
    if (!match) return source.length;
    offset = match.index + match[0].length;
  }
  return Math.min(source.length, offset + column - 1);
}
