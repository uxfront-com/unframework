import { describe, expect, it } from "vitest";

import { decodeJsx, readJsxAttribute, readJsxText } from "../src/index.ts";

describe("decodeJsx", () => {
  it("decodes named, decimal and hex references", () => {
    expect(decodeJsx("Tom &amp; Jerry &lt;3 &#38; &#x26; &nbsp;!", "text")).toBe(
      "Tom & Jerry <3 & & \u00a0!",
    );
  });

  it("decodes astral code points", () => {
    expect(decodeJsx("&#x1F600;", "text")).toBe("😀");
  });

  it("keeps unknown, unterminated and malformed references as written", () => {
    expect(decodeJsx("&unknown; &amp &#; &#x; &#xZZ; &#X41; a & b", "text")).toBe(
      "&unknown; &amp &#; &#x; &#xZZ; &#X41; a & b",
    );
  });

  it("only knows the XHTML entity set, as every JSX implementation", () => {
    // `&lbrace;` is HTML5-only.
    expect(decodeJsx("&lbrace;&hearts;", "text")).toBe("&lbrace;♥");
  });

  it("reads CRLF in text, but not in attribute strings, as LF", () => {
    expect(decodeJsx("a\r\nb", "text")).toBe("a\nb");
    expect(decodeJsx("a\r\nb", "attribute")).toBe("a\r\nb");
  });
});

/** The value of text every implementation reads alike. */
function agreed(raw: string): string {
  const reading = readJsxText(raw);
  expect(reading.divergences).toEqual([]);
  return reading.value;
}

/** The one divergence in `raw`: what it covers, and its fix. */
function divergence(raw: string) {
  const { divergences } = readJsxText(raw);
  expect(divergences).toHaveLength(1);
  const [found] = divergences;
  return { at: raw.slice(found!.start, found!.end), ...found! };
}

describe("readJsxText", () => {
  // The rules Babel and TypeScript share: lines are trimmed where they meet a line break, the
  // first line keeps its leading whitespace and the last its trailing, lines left empty are
  // dropped, and the rest are joined with one space.
  it.each([
    ["Hello, world!", "Hello, world!"],
    ["  spaces on one line  ", "  spaces on one line  "],
    ["\n    Line one\n    Line two\n  ", "Line one Line two"],
    ["\n\n  ", ""],
    ["a\n\n\nb", "a b"],
    ["a\r\n  b\rc", "a b c"],
    ["trailing on first line   \n  next", "trailing on first line next"],
    ["  leading\n", "  leading"],
    ["\n  only last line   ", "only last line   "],
    ["a \n b", "a b"],
    ["\n\t\tindented with tabs\n\t", "indented with tabs"],
  ])("reads %j as %j", (raw, value) => {
    expect(agreed(raw)).toBe(value);
  });

  // References are decoded in what is kept, and never trimmed or split at, so writing a
  // character as one is how to keep it next to a line break.
  it.each([
    ["Mathematician &amp; writer\n  next", "Mathematician & writer next"],
    ["&nbsp;\n  x", "\u00a0 x"],
    ["x&#160;\n", "x\u00a0"],
    ["a&#x2028;\nb", "a\u2028 b"],
    ["a&#32;b", "a b"],
    ["a\u00a0b", "a\u00a0b"],
  ])("reads %j as %j", (raw, value) => {
    expect(agreed(raw)).toBe(value);
  });

  // Babel decodes references, then trims; TypeScript, oxc and esbuild trim, then decode. The
  // fix writes what Babel reads, raw, which every implementation reads alike.
  it.each([
    ["Hello&#32;\n  next", "&#32;", "trimmed by Babel's JSX", ""],
    ["a&#10;b", "&#10;", "a line break to Babel's JSX", "\n"],
    ["a&#xA;b", "&#xA;", "a line break to Babel's JSX", "\n"],
    ["a&#13;b", "&#13;", "a carriage return character", "\n"],
    ["a&#9;b", "&#9;", "a space to Babel's JSX", " "],
  ])("reports %j, whose reference Babel reads before it trims", (raw, at, message, fix) => {
    const found = divergence(raw);
    expect(found).toMatchObject({ at, replacement: fix });
    expect(found.message).toContain(message);
    const fixed = raw.replace(at, fix);
    expect(agreed(fixed)).toBe(readJsxText(raw).value);
  });

  // The rewrite would bring raw Unicode whitespace to a line's edge, where TypeScript trims it.
  it.each([
    ["a&#10;\u00a0b", "&#10;"],
    ["a\u3000&#13;b", "&#13;"],
    ["a\u00a0&#32;\nb", "&#32;"],
  ])("offers no fix for the reference in %j, which would reveal another divergence", (raw, at) => {
    const found = divergence(raw);
    expect(found.at).toBe(at);
    expect(found.replacement).toBeUndefined();
  });

  // TypeScript, oxc and esbuild trim Unicode whitespace and split lines at U+2028 and U+2029;
  // Babel trims spaces and tabs only, and turns tabs into spaces. The fixes keep Babel's text.
  it.each([
    ["x\u00a0\n  y", "\u00a0", "&nbsp;"],
    ["x\n\u3000\ny", "\u3000", "&#x3000;"],
    ["a\u200b\nb", "\u200b", "&#x200B;"],
    ["a\u2028b", "\u2028", "&#x2028;"],
    ["a\u2029b", "\u2029", "&#x2029;"],
    ["a\tb", "\t", " "],
    ["\ta", "\t", " "],
  ])("reports %j, and fixes it", (raw, at, replacement) => {
    expect(divergence(raw)).toMatchObject({ at, replacement });
  });

  it("names which implementations trim a character", () => {
    expect(divergence("a\u00a0\nb").message).toBe(
      "A no-break space (U+00A0) next to a line break is text to Babel's JSX and whitespace that TypeScript's, oxc's and esbuild's trim.",
    );
    // esbuild keeps a zero-width space, and so the no-break space before one.
    expect(divergence("a\u200b\nb").message).toContain("that TypeScript's and oxc's trim");
    expect(readJsxText("a\u00a0\u200b\nb").divergences.map(({ message }) => message)).toEqual([
      "A no-break space (U+00A0) next to a line break is text to Babel's JSX and whitespace that TypeScript's and oxc's trim.",
      "A zero-width space (U+200B) next to a line break is text to Babel's JSX and whitespace that TypeScript's and oxc's trim.",
    ]);
  });

  // A vertical tab or U+0085 is UF3010 wherever it is, so the text is read with it as Babel
  // reads it, as a character, though TypeScript, oxc and esbuild trim it at a line break.
  it.each([
    ["a\u000b\nb", "a\u000b b"],
    ["a \u0085\nb", "a \u0085 b"],
    ["\u000b\n", "\u000b"],
  ])("reads %j as %j: HTML does not keep that character", (raw, value) => {
    expect(agreed(raw)).toBe(value);
  });

  it("reads the rest of the text as it would with any other character there", () => {
    // As in "a\u00a0x\nb", the no-break space is not at the line's edge.
    expect(agreed("a\u00a0\u000b\nb")).toBe("a\u00a0\u000b b");
    // As in "ax\u00a0\nb", it is.
    expect(divergence("a\u000b\u00a0\nb")).toMatchObject({ at: "\u00a0", replacement: "&nbsp;" });
  });

  it("does not report a tab that every implementation trims", () => {
    expect(agreed("a\t\n\tb")).toBe("a b");
  });

  it("reports each place apart", () => {
    const { divergences } = readJsxText("a\tb\u00a0\nc&#10;d");
    expect(divergences.map(({ start, end }) => [start, end])).toEqual([
      [1, 2],
      [3, 4],
      [6, 11],
    ]);
  });
});

describe("readJsxAttribute", () => {
  it("keeps whitespace and decodes references", () => {
    expect(readJsxAttribute("a\n  b\t&amp;&#10;")).toMatchObject({
      value: "a\n  b\t&\n",
      divergences: [],
    });
  });

  it.each([
    ["&#+65;", "a signed character reference"],
    ["&#99999999;", "names no Unicode character"],
    ["&#xD800;", "half of a UTF-16 surrogate pair"],
    ["&#xD83D;&#xDE00;", "a UTF-16 surrogate pair"],
  ])("reports %j, which the implementations decode differently", (raw, message) => {
    const { divergences } = readJsxAttribute(raw);
    expect(divergences).toHaveLength(1);
    expect(divergences[0]!.message).toContain(message);
  });
});
