// How the markup dialects write expression code: the token scan, the escapes each template
// scanner needs, and the literal re-printing Angular's lexer needs (design §4.3). Whether each
// framework reads the result back as written is decided by the markup targets' markup-semantics
// tests, which render the same spellings (codegen/test/markup-cases.ts).
import { describe, expect, it } from "vitest";

import { angularCode, vueAttributeCode, vueInterpolationCode } from "../src/markup.ts";
import { withoutTemplateLiterals } from "../src/markup/angular.ts";
import {
  codeTokens,
  escapeReferences,
  mapCode,
  quasiText,
  quoteString,
  separateClosingBraces,
} from "../src/markup/escape.ts";

describe("codeTokens", () => {
  it("finds strings, quasis, regular expressions, numbers and comments, in order", () => {
    const code = '`a${b}c` + "d" /* e */ + /f/g + 1_0 // g\n+ h';
    expect(
      codeTokens(code).map((token) => [token.kind, code.slice(token.start, token.end)]),
    ).toEqual([
      ["template", "a"],
      ["template", "c"],
      ["string", '"d"'],
      ["comment", "/* e */"],
      ["regex", "/f/g"],
      ["number", "1_0"],
      ["comment", "// g"],
    ]);
  });

  it("reads each literal's value", () => {
    expect(codeTokens('"\\x41" + `\\u0042${c}`')).toMatchObject([
      { kind: "string", value: "A" },
      { kind: "template", cooked: "B" },
      { kind: "template", cooked: "" },
    ]);
  });

  it("maps tokens and the code between them", () => {
    expect(
      mapCode('a + "b" /* c */ + 2', {
        string: (raw) => raw.toUpperCase(),
        comment: () => "",
        number: (_, { value }) => String(value * 2),
        other: (text) => text.replace("a", "x"),
      }),
    ).toBe('x + "B"  + 4');
  });
});

describe("escapes", () => {
  it("escapes an ampersand only where it could start a character reference", () => {
    expect(escapeReferences("a && b & c")).toBe("a && b & c");
    expect(escapeReferences('"&amp;" + "&lt" + "&#38;"')).toBe(
      '"&amp;amp;" + "&amp;lt" + "&amp;#38;"',
    );
  });

  it("separates every `}}`, in punctuation, literals, regular expressions and comments", () => {
    expect(separateClosingBraces("f({ a: { b: 1 }})")).toBe("f({ a: { b: 1 } })");
    expect(separateClosingBraces('"}}" + `}}}`')).toBe(
      '"\\u007d\\u007d" + `\\u007d\\u007d\\u007d`',
    );
    expect(separateClosingBraces("`${a}}`")).toBe("`${a}\\u007d`");
    expect(separateClosingBraces("/}}/.test(a)")).toBe("/}\\}/.test(a)");
    expect(separateClosingBraces("a /* }} */")).toBe("a /* } } */");
    expect(separateClosingBraces('"\\}}"')).toBe('"\\u007d\\u007d"');
    expect(separateClosingBraces('"}" + "}"')).toBe('"}" + "}"');
  });

  it("writes strings with only the escapes every expression language reads", () => {
    expect(quoteString("a\nb\tc\\d\"e'f", '"')).toBe('"a\\nb\\tc\\\\d\\"e\'f"');
    expect(quoteString("a'b", "'")).toBe("'a\\'b'");
    expect(quoteString("\b\0 \u{1f600}\ud800", '"')).toBe(
      '"\\u0008\\u0000\\u2028\u{1f600}\\ud800"',
    );
    expect(quoteString("{x}", '"', (c) => (c === "{" ? "\\u007b" : undefined))).toBe('"\\u007bx}"');
    expect(quasiText("a`b${c}$d")).toBe("a\\`b\\${c}$d");
  });
});

describe("Vue expression code", () => {
  it("keeps `}}` and character references out of an interpolation", () => {
    expect(vueInterpolationCode('a && "&amp;}}"')).toBe('a && "&amp;amp;\\u007d\\u007d"');
  });

  it("writes double-quoted strings in single quotes in an attribute, as Vue templates do", () => {
    expect(vueAttributeCode('a + "b" + "it\'s" + "\\"q\\""')).toBe(
      "a + 'b' + 'it\\'s' + '&quot;q&quot;'",
    );
    expect(vueAttributeCode("a ? `x${b}` : '&lt'")).toBe("a ? `x${b}` : '&amp;lt'");
  });
});

describe("Angular expression code", () => {
  it("re-prints literals with the escapes Angular's lexer reads", () => {
    // Angular reads `"\x41"` as `"x41"`, and condenses runs of spaces in an interpolation.
    expect(angularCode('"\\x41" + "a  b" + "<b>{x}</b>&"', "interpolation")).toBe(
      '"A" + "a\\u0020\\u0020b" + "\\u003cb\\u003e\\u007bx\\u007d\\u003c/b\\u003e\\u0026"',
    );
    expect(angularCode("0x10 + 1_000 + .5 + 5. + 1e3", "block")).toBe("16 + 1_000 + .5 + 5. + 1e3");
    expect(angularCode("a /* b */ + c", "block")).toBe("a   + c");
  });

  it("writes strings in single quotes in an attribute, and escapes what HTML decodes there", () => {
    expect(angularCode('a + "b\'" + `"`', "attribute")).toBe(`a + 'b\\'' + '&quot;'`);
  });

  it("keeps `}}` and tags out of an interpolation, and leaves block parameters undecoded", () => {
    expect(angularCode("f({ a: { b: 1 }}) && a<b && /<b>}}/.test(c)", "interpolation")).toBe(
      "f({ a: { b: 1 } }) && a< b && /\\x3cb>}\\}/.test(c)",
    );
    expect(angularCode("a && b<c", "block")).toBe("a && b<c");
  });

  it("writes template literals as concatenations that are strings from their first `+`", () => {
    expect(withoutTemplateLiterals("`${a}${b}`")).toBe('"" + a + b');
    expect(withoutTemplateLiterals("`${a}`")).toBe('"" + a');
    expect(withoutTemplateLiterals("`${n}px`")).toBe('n + "px"');
    expect(withoutTemplateLiterals("`${a ?? b}px`")).toBe('(a ?? b) + "px"');
    expect(withoutTemplateLiterals("`x${a - b}y${c * d}`.length")).toBe(
      '("x" + (a - b) + "y" + c * d).length',
    );
    expect(withoutTemplateLiterals("f(`-${`}`}`)")).toBe('f("-" + "}")');
    expect(withoutTemplateLiterals("a + b")).toBe("a + b");
  });

  // Parentheses only where `+` would bind wrongly: `n * "" + a` is not `n * ("" + a)`.
  it("parenthesises a concatenation only where `+` binds wrongly", () => {
    expect(withoutTemplateLiterals("[`a${b}`, c ? `d${e}` : x ?? `f${g}`, { k: `h${i}` }]")).toBe(
      '["a" + b, c ? "d" + e : x ?? "f" + g, { k: "h" + i }]',
    );
    expect(withoutTemplateLiterals("`a${b}` === c && `${d}e` - 1 < f")).toBe(
      '"a" + b === c && d + "e" - 1 < f',
    );
    expect(withoutTemplateLiterals("n * `${a}` + c + `${d}e` + !`${f}`")).toBe(
      'n * ("" + a) + c + (d + "e") + !("" + f)',
    );
  });
});
