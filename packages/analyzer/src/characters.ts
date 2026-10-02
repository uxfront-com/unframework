import { unkeptCharacter } from "@unframework/ir";

import type { Piece } from "./jsx/text.ts";

/** A character of a static value that HTML would not keep, at the raw text that wrote it. */
export interface UnportableCharacter {
  /** Its range in the raw text. */
  start: number;
  end: number;
  message: string;
  help: string;
  /** A rewrite of the range to what the browser would show. */
  fix?: { title: string; text: string };
}

/**
 * The characters of a static text or attribute value that do not survive HTML, so the server's
 * markup and the client's DOM would differ (`unkeptCharacter`, which the IR's invariants
 * share): a carriage return (the parser reads it, and CRLF, as a line feed, and Svelte's
 * compiler does the same), NUL, a lone UTF-16 surrogate, and the controls and noncharacters
 * HTML does not allow in a document. Each is reported once, at the character or reference
 * that wrote it, unless it lies in a range already reported (`reported`).
 */
export function unportableCharacters(
  raw: string,
  kept: readonly Piece[],
  reported: readonly { start: number; end: number }[],
): UnportableCharacter[] {
  const pieces = kept.filter(
    (piece) => !reported.some((range) => piece.start >= range.start && piece.start < range.end),
  );
  // The decoded value, and the piece each of its UTF-16 units came from: a raw astral
  // character is two pieces, one per surrogate.
  let value = "";
  const origin: number[] = [];
  pieces.forEach((piece, index) => {
    value += piece.value;
    for (let unit = 0; unit < piece.value.length; unit++) origin.push(index);
  });
  const found = new Map<number, UnportableCharacter>();
  for (let unit = 0; unit < value.length;) {
    const codePoint = value.codePointAt(unit)!;
    const piece = pieces[origin[unit]!]!;
    const problem = problemOf(codePoint, piece.reference);
    if (problem && !found.has(origin[unit]!)) {
      found.set(origin[unit]!, {
        start: piece.start,
        end: piece.end,
        ...problem,
        // A raw carriage return is a line ending; written as a reference, it is meant.
        ...(codePoint === 0x0d && !piece.reference
          ? {
              fix:
                raw[piece.end] === "\n"
                  ? { title: "Remove the carriage return", text: "" }
                  : { title: "Write a line feed", text: "\n" },
            }
          : {}),
      });
    }
    unit += codePoint > 0xffff ? 2 : 1;
  }
  return [...found.values()];
}

function problemOf(
  codePoint: number,
  reference: boolean,
): { message: string; help: string } | undefined {
  const name = `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
  switch (unkeptCharacter(codePoint)) {
    case undefined:
      return undefined;
    case "carriage-return":
      return {
        message:
          "A carriage return does not survive HTML: the parser reads it as a line feed, and so does Svelte's compiler.",
        help: reference
          ? "Write a line feed (`&#10;`), which is what the browser would show, or remove it."
          : "Use a line feed: save the file with LF line endings.",
      };
    case "nul":
      return {
        message:
          "A NUL character (U+0000) does not survive HTML: the parser drops it from text and replaces it in attribute values.",
        help: "Remove it.",
      };
    case "surrogate":
      return {
        message: `A lone UTF-16 surrogate (${name}) is not a character: UTF-8 cannot encode it, so server-rendered HTML holds U+FFFD instead.`,
        help: "Remove it, or write the whole character.",
      };
    case "control":
      return {
        message: `${name} is a control character, which HTML does not allow in a document.`,
        help: "Remove it.",
      };
    case "noncharacter":
      return {
        message: `${name} is a noncharacter, which HTML does not allow in a document.`,
        help: "Remove it.",
      };
  }
}
