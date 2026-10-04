// JavaScript string and template literals, read piece by piece: each character of the value
// with the source text that wrote it. The analyser reports a character HTML would not keep at
// the escape or character that wrote it (UF3010), and rewrites the escapes Angular's lexer cannot
// read (`\u{…}`, UF1002) one by one (ADR-0035).

import { unkeptCharacter } from "@unframework/ir";
import type { AST } from "@unframework/parser";

import type { Reporter } from "./context.ts";
import type { Piece } from "./jsx/text.ts";

/** A `\u{…}` escape: where it is written, and the `\uXXXX` escapes every target reads. */
export interface CodePointEscape {
  start: number;
  end: number;
  replacement: string;
}

/** A literal read as pieces, offsets in the source. */
export interface LiteralReading {
  /** Each character of the value, with the raw text that wrote it (`reference` for escapes). */
  pieces: Piece[];
  /** The `\u{…}` escapes. */
  codePointEscapes: CodePointEscape[];
}

const SIMPLE_ESCAPES: ReadonlyMap<string, string> = new Map([
  ["b", "\b"],
  ["f", "\f"],
  ["n", "\n"],
  ["r", "\r"],
  ["t", "\t"],
  ["v", "\v"],
  ["0", "\0"],
]);

/**
 * Reads the raw text of a string literal's content, or a template literal's quasi, that starts
 * at `offset` in the source. The parser has already checked it, so every escape is complete. In
 * a template, a raw CR or CRLF reads as LF, as the language's cooked value does.
 */
export function readLiteral(raw: string, offset: number, template: boolean): LiteralReading {
  const pieces: Piece[] = [];
  const codePointEscapes: CodePointEscape[] = [];
  const push = (value: string, start: number, end: number, reference: boolean) => {
    pieces.push({ value, start: offset + start, end: offset + end, reference });
  };
  for (let index = 0; index < raw.length;) {
    const character = raw[index]!;
    if (character !== "\\") {
      if (template && character === "\r") {
        const end = raw[index + 1] === "\n" ? index + 2 : index + 1;
        push("\n", index, end, false);
        index = end;
        continue;
      }
      const codePoint = raw.codePointAt(index)!;
      const width = codePoint > 0xffff ? 2 : 1;
      push(raw.slice(index, index + width), index, index + width, false);
      index += width;
      continue;
    }
    const next = raw[index + 1] ?? "";
    if (next === "u" && raw[index + 2] === "{") {
      const close = raw.indexOf("}", index + 3);
      const codePoint = Number.parseInt(raw.slice(index + 3, close), 16);
      const value = String.fromCodePoint(codePoint);
      push(value, index, close + 1, true);
      codePointEscapes.push({
        start: offset + index,
        end: offset + close + 1,
        // One `\uXXXX` per UTF-16 unit: a surrogate pair for an astral character.
        replacement: Array.from(
          { length: value.length },
          (_, unit) => `\\u${value.charCodeAt(unit).toString(16).toUpperCase().padStart(4, "0")}`,
        ).join(""),
      });
      index = close + 1;
    } else if (next === "u") {
      const unit = Number.parseInt(raw.slice(index + 2, index + 6), 16);
      push(String.fromCharCode(unit), index, index + 6, true);
      index += 6;
    } else if (next === "x") {
      const unit = Number.parseInt(raw.slice(index + 2, index + 4), 16);
      push(String.fromCharCode(unit), index, index + 4, true);
      index += 4;
    } else if (next === "\r" || next === "\n" || next === "\u2028" || next === "\u2029") {
      // A line continuation writes nothing.
      index += next === "\r" && raw[index + 2] === "\n" ? 3 : 2;
    } else {
      const codePoint = raw.codePointAt(index + 1)!;
      const width = codePoint > 0xffff ? 2 : 1;
      push(
        SIMPLE_ESCAPES.get(next) ?? raw.slice(index + 1, index + 1 + width),
        index,
        index + 1 + width,
        true,
      );
      index += 1 + width;
    }
  }
  return { pieces, codePointEscapes };
}

/** A string literal, or a template literal without expressions: a static string in the source. */
export type StaticString = AST.StringLiteral | AST.TemplateLiteral;

/** The pieces of a static string's value, with the source text that wrote each. */
export function piecesOf(node: StaticString, source: string): Piece[] {
  if (node.type === "Literal") {
    return readLiteral(source.slice(node.start + 1, node.end - 1), node.start + 1, false).pieces;
  }
  return node.quasis.flatMap((quasi) => readLiteral(quasi.value.raw, quasi.start + 1, true).pieces);
}

/** A static string's value. */
export function valueOf(node: StaticString): string {
  return node.type === "Literal"
    ? node.value
    : node.quasis.map((quasi) => quasi.value.cooked ?? "").join("");
}

/** Whether an expression is a static string: a string literal, or a template without holes. */
export function isStaticString(node: AST.Expression): node is StaticString {
  return (
    (node.type === "Literal" && typeof node.value === "string") ||
    (node.type === "TemplateLiteral" && !node.expressions.length)
  );
}

/**
 * Reports each character of a static string that HTML would not keep (UF3010), at the escape or
 * character that wrote it: a carriage return, NUL, a lone surrogate, a control character or a
 * noncharacter. Returns whether it reported one.
 */
export function reportCharacters(node: StaticString, source: string, reporter: Reporter): boolean {
  const pieces = piecesOf(node, source);
  let reported = false;
  for (let index = 0; index < pieces.length; index++) {
    const piece = pieces[index]!;
    let value = piece.value;
    let end = piece.end;
    // An astral character written as two escapes is one character.
    const next = pieces[index + 1];
    if (/^[\uD800-\uDBFF]$/.test(value) && next && /^[\uDC00-\uDFFF]$/.test(next.value)) {
      value += next.value;
      end = next.end;
      index++;
    }
    const codePoint = value.codePointAt(0)!;
    const problem = unkeptCharacter(codePoint);
    if (!problem) continue;
    const name = `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
    reporter.report(
      "UF3010",
      { start: piece.start, end },
      problem === "carriage-return"
        ? "A carriage return does not survive HTML: the parser reads it as a line feed, and so does Svelte's compiler."
        : problem === "nul"
          ? "A NUL character (U+0000) does not survive HTML: the parser drops it from text and replaces it in attribute values."
          : problem === "surrogate"
            ? `A lone UTF-16 surrogate (${name}) is not a character: UTF-8 cannot encode it, so server-rendered HTML holds U+FFFD instead.`
            : `${name} is a ${problem === "control" ? "control character" : "noncharacter"}, which HTML does not allow in a document.`,
      {
        help:
          problem === "carriage-return"
            ? "Write a line feed (`\\n`), which is what the browser would show, or remove it."
            : problem === "surrogate"
              ? "Remove it, or write the whole character."
              : "Remove it.",
      },
    );
    reported = true;
  }
  return reported;
}
