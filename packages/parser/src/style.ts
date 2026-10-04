import { transformStyleAttribute } from "lightningcss";

import type { Span } from "./parse.ts";
import { offsetOf } from "./stylesheet.ts";

/** A declaration of a `style` attribute's declaration list, as written. */
export interface CssDeclaration {
  /** The property as written: whitespace and comments around it are not part of it. */
  property: string;
  /** The value as written, without the whitespace around it (`!important` included). */
  value: string;
  /** From the property's start to the value's end. */
  span: Span;
  propertySpan: Span;
  valueSpan: Span;
}

/** A `style` attribute's declaration list, read as written, and its syntax errors. */
export interface ParsedDeclarations {
  source: string;
  /** The declarations, in source order; empty ones (`;;`) are not listed. */
  declarations: CssDeclaration[];
  /** Syntax errors: lightningcss's, and declarations without a property or a colon. */
  errors: { message: string; span: Span }[];
}

const encoder = new TextEncoder();

/**
 * Parses the declaration list of a `style` attribute (`color: red; margin-top: 4px`). The
 * declarations keep their source text (ADR-0038): the targets write them as the author did, so
 * the list is split here, at the `;` and `:` outside strings, comments and brackets, and
 * lightningcss checks the syntax. Spans are UTF-16 offsets into `source`. Never throws.
 */
export function parseDeclarations(source: string): ParsedDeclarations {
  const declarations: CssDeclaration[] = [];
  const errors: { message: string; span: Span }[] = [];
  for (const chunk of split(source, ";")) {
    const colon = split(source.slice(chunk.start, chunk.end), ":")[0]!;
    const before = trim(source, { start: chunk.start, end: chunk.start + colon.end });
    if (chunk.start + colon.end === chunk.end) {
      // No colon: an empty declaration (`;;`, or only whitespace and comments) is skipped.
      if (before.start !== before.end) {
        errors.push({ message: "Expected a colon after the property", span: before });
      }
      continue;
    }
    const after = trim(source, { start: chunk.start + colon.end + 1, end: chunk.end });
    if (before.start === before.end) {
      errors.push({ message: "Expected a property before the colon", span: before });
      continue;
    }
    declarations.push({
      property: source.slice(before.start, before.end),
      value: source.slice(after.start, after.end),
      span: { start: before.start, end: after.end },
      propertySpan: before,
      valueSpan: after,
    });
  }
  if (!errors.length) {
    try {
      transformStyleAttribute({ code: encoder.encode(source), errorRecovery: false });
    } catch (error) {
      const { message, loc } = error as { message: string; loc?: { line: number; column: number } };
      const offset = loc ? offsetOf(source, loc.line, loc.column) : 0;
      errors.push({ message, span: { start: offset, end: offset } });
    }
  }
  return { source, declarations, errors };
}

/**
 * The ranges of `text` between the `separator`s that are outside strings, comments and
 * brackets: CSS's own nesting, so a `;` in `url("a;b")` does not end a declaration.
 */
function split(text: string, separator: string): Span[] {
  const ranges: Span[] = [];
  const closing: string[] = [];
  let quote: string | undefined;
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    const character = text[index]!;
    if (quote) {
      if (character === "\\") index++;
      else if (character === quote) quote = undefined;
    } else if (character === "\\") {
      index++;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "/" && text[index + 1] === "*") {
      const end = text.indexOf("*/", index + 2);
      index = end === -1 ? text.length : end + 1;
    } else if (character === "(" || character === "[" || character === "{") {
      closing.push(character === "(" ? ")" : character === "[" ? "]" : "}");
    } else if (character === closing.at(-1)) {
      closing.pop();
    } else if (character === separator && !closing.length) {
      ranges.push({ start, end: index });
      start = index + 1;
    }
  }
  ranges.push({ start, end: text.length });
  return ranges;
}

/** A range without the whitespace and comments at its ends. */
function trim(text: string, range: Span): Span {
  let { start, end } = range;
  for (;;) {
    while (start < end && /\s/.test(text[start]!)) start++;
    if (text.startsWith("/*", start)) {
      const close = text.indexOf("*/", start + 2);
      if (close !== -1 && close + 2 <= end) {
        start = close + 2;
        continue;
      }
    }
    break;
  }
  for (;;) {
    while (end > start && /\s/.test(text[end - 1]!)) end--;
    if (text.endsWith("*/", end) && end - 2 >= start) {
      const open = text.lastIndexOf("/*", end - 3);
      if (open >= start) {
        end = open;
        continue;
      }
    }
    break;
  }
  return { start, end };
}
