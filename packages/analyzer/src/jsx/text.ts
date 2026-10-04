// JSX text has no single meaning: the JSX implementations that authors and the targets run
// read the same source in two ways, which differ in the order of two steps.
//
// - Babel (`cleanJSXElementLiteralChild`, which Vue's `@vue/babel-plugin-jsx` and
//   `babel-preset-solid` copy) decodes character references first, then splits the text into
//   lines at LF, CR and CRLF, decoded ones included, turns every tab into a space, trims spaces
//   where a line meets a line break, drops the lines left empty, and joins the rest with one
//   space.
// - TypeScript, oxc (Vite's JSX transform, so the React target's toolchain) and esbuild split
//   the raw text at LF, CR, U+2028 and U+2029, trim Unicode whitespace (the no-break space,
//   U+3000 and others; esbuild a narrower set) where a line meets a line break, keep tabs, and
//   decode references only in what is left.
//
// Both agree on ordinary text. The analyser lowers text only where they agree, and reports
// every place where they do not (UF3009), with a rewrite that every implementation reads as
// Babel reads the original wherever one exists. Character references whose syntax the
// implementations disagree on are reported the same way, in text and attribute strings alike.
//
// A character HTML does not keep (a vertical tab, U+0085) is UF3010 wherever it is, so text
// that holds one is never lowered. The analyser reads it as Babel does, as a character, even
// where TypeScript, oxc and esbuild trim it as whitespace, and reports the rest of the text as
// it would with any other character there: applying every fix then leaves exactly the
// diagnostics that have none, that character's UF3010 among them.
//
// One consequence: accepted JSX text never holds a tab, a line feed or a carriage return. A
// string expression (`{"\n"}`) writes them, as JavaScript reads it; a leading line feed in
// <pre>, <textarea> and <listing> is reported then (UF3017), because the HTML parser drops it
// from server-rendered markup.
import { unkeptCharacter } from "@unframework/ir";

import { XHTML_ENTITIES } from "./entities.ts";
import { HTML_ONLY_ENTITIES } from "./html-entities.ts";

/** One raw character, or one character reference, of JSX text or an attribute string. */
export interface Piece {
  /** What it decodes to. */
  value: string;
  /** Its range in the raw text. */
  start: number;
  end: number;
  /** Whether it is a character reference (`&amp;`, `&#10;`). */
  reference: boolean;
}

/** A place where JSX implementations read the same source differently. */
export interface Divergence {
  /** Its range in the raw text. */
  start: number;
  end: number;
  message: string;
  help?: string;
  /** Raw text for the range that every implementation reads as Babel reads the original. */
  replacement?: string;
}

/** What JSX text or an attribute string means. */
export interface JsxReading {
  /**
   * The decoded value, by Babel's rules. Every implementation reads the same value when
   * `divergences` is empty and the text holds no character HTML does not keep (which `kept`
   * then holds, for UF3010); otherwise it must not be lowered.
   */
  value: string;
  divergences: Divergence[];
  /** The pieces whose characters make up `value`, in order (what HTML must keep). */
  kept: Piece[];
}

/**
 * Decodes the character references in raw JSX text or a JSX attribute string: the named
 * entities of XHTML 1.0 (`&amp;`; JSX does not know HTML5's), and decimal (`&#38;`) and
 * lower-case hex (`&#x26;`) references. Anything else stays as written. Text, but not an
 * attribute string, reads CRLF as LF, as Babel's tokenizer does.
 */
export function decodeJsx(raw: string, kind: "text" | "attribute"): string {
  return decodePieces(raw, kind)
    .map((piece) => piece.value)
    .join("");
}

/** A named character reference HTML decodes and JSX does not, so every target renders it as written. */
export interface HtmlOnlyReference {
  /** Its range in the raw text. */
  start: number;
  end: number;
  /** The name, without `&` and `;`. */
  name: string;
  /** What HTML decodes it to. */
  value: string;
  /** Its code points (two for a few, such as `&NotEqualTilde;`). */
  codePoints: number[];
  /** The numeric reference every JSX implementation decodes to `value` (`&#x2713;`). */
  numeric: string;
}

/** The named references in raw JSX text or an attribute string that only HTML decodes. */
export function htmlOnlyReferences(raw: string): HtmlOnlyReference[] {
  const found: HtmlOnlyReference[] = [];
  for (const match of raw.matchAll(/&([A-Za-z][A-Za-z0-9]*);/g)) {
    const name = match[1]!;
    const value = HTML_ONLY_ENTITIES.get(name);
    if (value === undefined) continue;
    const codePoints: number[] = [];
    for (const char of value) codePoints.push(char.codePointAt(0)!);
    const numeric = codePoints.map((code) => `&#x${code.toString(16).toUpperCase()};`).join("");
    const end = match.index + match[0].length;
    found.push({ start: match.index, end, name, value, codePoints, numeric });
  }
  return found;
}

/** Reads an attribute string: JSX applies no whitespace rules there, only references. */
export function readJsxAttribute(raw: string): JsxReading {
  const pieces = decodePieces(raw, "attribute");
  return {
    value: pieces.map((piece) => piece.value).join(""),
    divergences: referenceDivergences(raw),
    kept: pieces,
  };
}

/** Reads JSX text: its value under JSX's whitespace rules, and where the implementations differ. */
export function readJsxText(raw: string): JsxReading {
  const { reading, rewrites } = readText(raw);
  offerRewrites(raw, reading, rewrites);
  return reading;
}

/** {@link readJsxText}, with the rewrites of whitespace references it has yet to offer as fixes. */
function readText(raw: string): {
  reading: JsxReading;
  rewrites: ReadonlyMap<Divergence, string>;
} {
  const pieces = decodePieces(raw, "text");
  const babel = babelReading(pieces);
  const divergences = referenceDivergences(raw);
  const typescript = typescriptReading(raw, (code) => isTypeScriptWhitespace(code) && isKept(code));
  const esbuild = typescriptReading(raw, (code) => isEsbuildWhitespace(code) && isKept(code));
  let rewrites: ReadonlyMap<Divergence, string> = new Map();
  if (babel.value !== typescript.value || babel.value !== esbuild.value) {
    const found = whitespaceDivergences(
      raw,
      pieces,
      babel.trimmed,
      typescript.trimmed,
      esbuild.trimmed,
    );
    rewrites = found.rewrites;
    divergences.push(
      ...(found.divergences.length
        ? found.divergences
        : [
            {
              start: 0,
              end: raw.length,
              message: `JSX implementations read this text differently: Babel's JSX reads ${JSON.stringify(babel.value)}, and TypeScript's ${JSON.stringify(typescript.value)}.`,
            },
          ]),
    );
  }
  divergences.sort((a, b) => a.start - b.start);
  return { reading: { value: babel.value, divergences, kept: babel.kept }, rewrites };
}

/**
 * Offers the rewrites of whitespace references (a space for `&#9;`, a line break for `&#10;`
 * and `&#13;`, nothing for a `&#32;` Babel trims) as the fixes of their divergences, only when
 * applying every fix of the text reads as Babel read it and leaves exactly the divergences that
 * have none. Each keeps Babel's reading on its own, but a new raw line break, or a removed
 * reference, can bring raw Unicode whitespace to a line's edge, where TypeScript, oxc and
 * esbuild trim what Babel keeps.
 */
function offerRewrites(
  raw: string,
  reading: JsxReading,
  rewrites: ReadonlyMap<Divergence, string>,
): void {
  if (!rewrites.size) return;
  let fixed = raw;
  for (const divergence of reading.divergences.toReversed()) {
    const replacement = divergence.replacement ?? rewrites.get(divergence);
    if (replacement === undefined) continue;
    fixed = fixed.slice(0, divergence.start) + replacement + fixed.slice(divergence.end);
  }
  const after = readText(fixed).reading;
  const unfixed = reading.divergences
    .filter((divergence) => divergence.replacement === undefined && !rewrites.has(divergence))
    .map((divergence) => divergence.message);
  const left = after.divergences.map((divergence) => divergence.message);
  if (after.value !== reading.value || left.join("\n") !== unfixed.join("\n")) return;
  for (const [divergence, replacement] of rewrites) divergence.replacement = replacement;
}

function decodePieces(raw: string, kind: "text" | "attribute"): Piece[] {
  const pieces: Piece[] = [];
  let index = 0;
  while (index < raw.length) {
    const char = raw[index]!;
    if (char === "\r" && kind === "text" && raw[index + 1] === "\n") {
      pieces.push({ value: "\n", start: index, end: index + 2, reference: false });
      index += 2;
      continue;
    }
    const reference = char === "&" ? readReference(raw, index + 1) : undefined;
    if (reference) {
      pieces.push({ value: reference.value, start: index, end: reference.end, reference: true });
      index = reference.end;
      continue;
    }
    pieces.push({ value: char, start: index, end: index + 1, reference: false });
    index++;
  }
  return pieces;
}

function readReference(raw: string, start: number): { value: string; end: number } | undefined {
  if (raw[start] === "#") {
    const hex = raw[start + 1] === "x";
    const digitsStart = start + (hex ? 2 : 1);
    const pattern = hex ? /[0-9a-fA-F]/ : /[0-9]/;
    let end = digitsStart;
    while (end < raw.length && pattern.test(raw[end]!)) end++;
    if (end === digitsStart || raw[end] !== ";") return undefined;
    const codePoint = Number.parseInt(raw.slice(digitsStart, end), hex ? 16 : 10);
    // Out of range, the implementations disagree (see referenceDivergences); it stays text.
    if (codePoint > 0x10ffff) return undefined;
    return { value: String.fromCodePoint(codePoint), end: end + 1 };
  }
  const semicolon = raw.indexOf(";", start);
  if (semicolon === -1 || semicolon - start > 10) return undefined;
  const value = XHTML_ENTITIES.get(raw.slice(start, semicolon));
  return value === undefined ? undefined : { value, end: semicolon + 1 };
}

const REFERENCE_SYNTAX = /&#x?[+-][0-9a-fA-F]*;?|&#x([0-9a-fA-F]+);|&#([0-9]+);/g;

/**
 * Numeric references the implementations decode differently: a signed one (`&#+65;`, which
 * esbuild, and oxc with a plus sign, decode and the others leave as text), one past U+10FFFF
 * (Babel and TypeScript fail, oxc leaves it as text, esbuild wraps it into another character)
 * and a UTF-16 surrogate (oxc leaves it as text, the others decode it).
 */
function referenceDivergences(raw: string): Divergence[] {
  const divergences: Divergence[] = [];
  const matches = [...raw.matchAll(REFERENCE_SYNTAX)];
  for (let index = 0; index < matches.length; index++) {
    const match = matches[index]!;
    const [written, hex, decimal] = match;
    const start = match.index;
    const end = start + written.length;
    if (hex === undefined && decimal === undefined) {
      divergences.push({
        start,
        end,
        message: `\`${written}\` is a signed character reference: esbuild's JSX decodes it (and oxc's, with a plus sign), and Babel's and TypeScript's keep it as text.`,
        help: "Write the reference without a sign, or `&amp;` for a literal `&`.",
      });
      continue;
    }
    const codePoint = Number.parseInt(hex ?? decimal!, hex === undefined ? 10 : 16);
    if (codePoint > 0x10ffff) {
      divergences.push({
        start,
        end,
        message: `\`${written}\` names no Unicode character: Babel's and TypeScript's JSX fail on it, oxc's keeps it as text and esbuild's reads another character.`,
        help: "Write the character you mean, or `&amp;` for a literal `&`.",
      });
      continue;
    }
    if (codePoint < 0xd800 || codePoint > 0xdfff) continue;
    const next = matches[index + 1];
    const low =
      next && next.index === end
        ? Number.parseInt(next[1] ?? next[2] ?? "", next[1] === undefined ? 10 : 16)
        : Number.NaN;
    if (codePoint <= 0xdbff && low >= 0xdc00 && low <= 0xdfff) {
      const combined = (codePoint - 0xd800) * 0x400 + (low - 0xdc00) + 0x10000;
      const pair = `${written}${next![0]}`;
      const code = combined.toString(16).toUpperCase();
      divergences.push({
        start,
        end: end + next![0].length,
        message: `\`${pair}\` is a UTF-16 surrogate pair: oxc's JSX keeps it as text, and the others read U+${code}.`,
        help: "Write the character's code point.",
        replacement: `&#x${code};`,
      });
      index++;
      continue;
    }
    divergences.push({
      start,
      end,
      message: `\`${written}\` is half of a UTF-16 surrogate pair, not a character: oxc's JSX keeps it as text, and the others decode it alone, which HTML cannot encode.`,
      help: "Write the character's code point, such as `&#x1F600;`.",
    });
  }
  return divergences;
}

/** Babel's reading of decoded pieces, with the pieces it keeps and the ones it trims. */
function babelReading(pieces: readonly Piece[]): {
  value: string;
  kept: Piece[];
  trimmed: Set<Piece>;
} {
  // Lines end at LF, CR or CRLF, decoded or raw (`/\r\n|\n|\r/` over the decoded text).
  const lines: Piece[][] = [[]];
  for (let index = 0; index < pieces.length; index++) {
    const piece = pieces[index]!;
    if (piece.value === "\n" || piece.value === "\r") {
      if (piece.value === "\r" && pieces[index + 1]?.value === "\n") index++;
      lines.push([]);
    } else {
      lines.at(-1)!.push(piece);
    }
  }
  const blank = (piece: Piece) => piece.value === " " || piece.value === "\t";
  let lastNonEmptyLine = 0;
  lines.forEach((line, index) => {
    if (line.some((piece) => !blank(piece))) lastNonEmptyLine = index;
  });
  const kept: Piece[] = [];
  const trimmed = new Set<Piece>();
  let value = "";
  lines.forEach((line, index) => {
    let from = 0;
    let to = line.length;
    if (index !== 0) while (from < to && blank(line[from]!)) from++;
    if (index !== lines.length - 1) while (to > from && blank(line[to - 1]!)) to--;
    for (const piece of [...line.slice(0, from), ...line.slice(to)]) trimmed.add(piece);
    if (from === to) return;
    const content = line.slice(from, to);
    kept.push(...content);
    value += content.map((piece) => (piece.value === "\t" ? " " : piece.value)).join("");
    if (index !== lastNonEmptyLine) value += " ";
  });
  return { value, kept, trimmed };
}

/** TypeScript's line terminators in JSX text, which oxc and esbuild share. */
const isLineTerminator = (code: number) =>
  code === 0x0a || code === 0x0d || code === 0x2028 || code === 0x2029;

/** TypeScript's `isWhiteSpaceSingleLine`, which oxc shares. */
function isTypeScriptWhitespace(code: number): boolean {
  return (
    code === 0x20 ||
    code === 0x09 ||
    code === 0x0b ||
    code === 0x0c ||
    code === 0xa0 ||
    code === 0x85 ||
    code === 0x1680 ||
    (code >= 0x2000 && code <= 0x200b) ||
    code === 0x202f ||
    code === 0x205f ||
    code === 0x3000 ||
    code === 0xfeff
  );
}

/** esbuild's `IsWhitespace`: TypeScript's without U+0085 and U+200B. */
function isEsbuildWhitespace(code: number): boolean {
  return code !== 0x85 && code !== 0x200b && isTypeScriptWhitespace(code);
}

/**
 * Whether HTML keeps a character. The readings take one it does not keep (of the whitespace,
 * a vertical tab and U+0085) for a character, as Babel does: it is UF3010 wherever it is.
 */
function isKept(code: number): boolean {
  return unkeptCharacter(code) === undefined;
}

/**
 * TypeScript's reading (`fixupWhitespaceAndDecodeEntities`): trims the raw lines, then decodes
 * each one, with the raw offsets it trims. `isWhitespace` is what it trims.
 */
function typescriptReading(
  raw: string,
  isWhitespace: (code: number) => boolean,
): { value: string; trimmed: Set<number> } {
  const lines: { start: number; end: number }[] = [];
  let start = 0;
  for (let index = 0; index < raw.length; index++) {
    if (!isLineTerminator(raw.charCodeAt(index))) continue;
    lines.push({ start, end: index });
    start = index + 1;
  }
  lines.push({ start, end: raw.length });
  const trimmed = new Set<number>();
  const kept: string[] = [];
  lines.forEach((line, index) => {
    let from = line.start;
    let to = line.end;
    while (from < to && isWhitespace(raw.charCodeAt(from))) from++;
    while (to > from && isWhitespace(raw.charCodeAt(to - 1))) to--;
    // The first line keeps its leading whitespace and the last its trailing, unless the text is
    // one line of whitespace, which is kept whole; a line of whitespace among others is dropped.
    if (from === to && lines.length > 1) {
      for (let offset = line.start; offset < line.end; offset++) trimmed.add(offset);
      return;
    }
    if (index === 0) from = line.start;
    if (index === lines.length - 1) to = line.end;
    for (let offset = line.start; offset < from; offset++) trimmed.add(offset);
    for (let offset = to; offset < line.end; offset++) trimmed.add(offset);
    kept.push(decodeJsx(raw.slice(from, to), "attribute"));
  });
  return { value: kept.join(" "), trimmed };
}

const CHARACTER_NAMES: ReadonlyMap<string, string> = new Map([
  ["\u000c", "A form feed"],
  ["\u00a0", "A no-break space"],
  ["\u1680", "An ogham space mark"],
  ["\u200b", "A zero-width space"],
  ["\u2028", "A line separator"],
  ["\u2029", "A paragraph separator"],
  ["\u202f", "A narrow no-break space"],
  ["\u205f", "A medium mathematical space"],
  ["\u3000", "An ideographic space"],
  ["\ufeff", "A zero-width no-break space"],
]);

/** `U+00A0`. */
function codePointOf(char: string): string {
  return `U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;
}

/** A character reference for a character, which no implementation trims or splits at. */
function referenceFor(char: string): string {
  return char === "\u00a0" ? "&nbsp;" : `&#x${char.codePointAt(0)!.toString(16).toUpperCase()};`;
}

/**
 * The places where Babel's and TypeScript's whitespace rules part: raw Unicode whitespace that
 * TypeScript trims at a line break and Babel keeps, raw U+2028 and U+2029 (line breaks to
 * TypeScript only), raw tabs that Babel keeps as spaces, and references to whitespace, which
 * Babel decodes before it trims and splits. Each fix keeps Babel's reading, so the fixes
 * together make every implementation read what Babel reads. The references' rewrites are
 * returned apart, for {@link offerRewrites} to check together. esbuild trims a subset of what
 * TypeScript trims, since its whitespace is a subset of TypeScript's.
 */
function whitespaceDivergences(
  raw: string,
  pieces: readonly Piece[],
  babelTrimmed: ReadonlySet<Piece>,
  typescriptTrimmed: ReadonlySet<number>,
  esbuildTrimmed: ReadonlySet<number>,
): { divergences: Divergence[]; rewrites: Map<Divergence, string> } {
  const divergences: Divergence[] = [];
  const rewrites = new Map<Divergence, string>();
  const rewrite = (divergence: Divergence, replacement: string) => {
    divergences.push(divergence);
    rewrites.set(divergence, replacement);
  };
  for (const piece of pieces) {
    const { start, end, value } = piece;
    if (piece.reference) {
      const written = raw.slice(start, end);
      // A raw space, a raw line break and nothing read in every implementation as these
      // references read in Babel's, which trims and splits after it decodes.
      if (value === "\t") {
        const message = `\`${written}\` is a space to Babel's JSX, which turns tabs into spaces, and a tab to TypeScript's, oxc's and esbuild's.`;
        const help = 'Write a space, or a string expression (`{"\\t"}`) for a tab.';
        rewrite({ start, end, message, help }, " ");
      } else if (value === "\n" || value === "\r") {
        const message = `\`${written}\` is a line break to Babel's JSX, which trims the text around it, and a ${value === "\n" ? "line feed" : "carriage return"} character to TypeScript's, oxc's and esbuild's.`;
        const help =
          'Write a line break, which every JSX implementation reads as Babel reads this, or a string expression (`{"\\n"}`) for a line feed character.';
        rewrite({ start, end, message, help }, "\n");
      } else if (value === " " && babelTrimmed.has(piece)) {
        const message = `\`${written}\` next to a line break is trimmed by Babel's JSX, which decodes it first, and kept by TypeScript's, oxc's and esbuild's.`;
        const help =
          "Remove it, as Babel does, or write the space on the same line as the text it separates.";
        rewrite({ start, end, message, help }, "");
      }
      continue;
    }
    const code = value.charCodeAt(0);
    if (code === 0x2028 || code === 0x2029) {
      divergences.push({
        start,
        end,
        message: `${CHARACTER_NAMES.get(value)} (${codePointOf(value)}) is a line break to TypeScript's, oxc's and esbuild's JSX, which trim the text around it, and a character to Babel's.`,
        help: `Write it as \`${referenceFor(value)}\`, or as a line break.`,
        replacement: referenceFor(value),
      });
    } else if (value === "\t" && !babelTrimmed.has(piece)) {
      divergences.push({
        start,
        end,
        message:
          "A tab in JSX text is a space to Babel's JSX and a tab to TypeScript's, oxc's and esbuild's.",
        help: "Write a space.",
        replacement: " ",
      });
    } else if (value !== " " && value !== "\t" && typescriptTrimmed.has(start)) {
      const trimmedBy = esbuildTrimmed.has(start)
        ? "TypeScript's, oxc's and esbuild's"
        : "TypeScript's and oxc's";
      divergences.push({
        start,
        end,
        message: `${CHARACTER_NAMES.get(value) ?? "A Unicode space"} (${codePointOf(value)}) next to a line break is text to Babel's JSX and whitespace that ${trimmedBy} trim.`,
        help: `Write it as \`${referenceFor(value)}\`, which every JSX implementation keeps, or remove it.`,
        replacement: referenceFor(value),
      });
    }
  }
  return { divergences, rewrites };
}
