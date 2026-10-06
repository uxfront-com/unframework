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
    expect(angularCode('a + "b" + `"`', "attribute")).toBe(`a + 'b' + '&quot;'`);
  });

  it("keeps `}}` and tags out of an interpolation, and leaves block parameters undecoded", () => {
    expect(angularCode("f({ a: { b: 1 }}) && a<b && /<b>}}/.test(c)", "interpolation")).toBe(
      "f({ a: { b: 1 } }) && a< b && /\\x3cb>}\\}/.test(c)",
    );
    expect(angularCode("a && b<c", "block")).toBe("a && b<c");
  });

  // Angular's lexers look for an interpolation's `}}`, a block's `;` and `)` and a comment's `//`
  // outside quotes, which they track in a regular expression too; its whitespace processing
  // condenses runs and turns U+E500 into a space there.
  it("writes escapes in a regular expression for what Angular's template reads in it", () => {
    expect(angularCode("/'\"`;/.test(s)", "block")).toBe("/\\x27\\x22\\x60\\x3b/.test(s)");
    expect(angularCode("s.split(/[;)(]/)", "block")).toBe("s.split(/[\\x3b\\x29\\x28]/)");
    // A group's parentheses balance; an escaped one, a bracket or a `/` is an escape, since the
    // raw text angular-eslint lints doubles its backslash, which then escapes only itself.
    expect(angularCode("/(a)\\)\\[\\]/.test(s)", "block")).toBe("/(a)\\x29\\x5b\\x5d/.test(s)");
    expect(angularCode("/a  b c\ue500/.test(s)", "interpolation")).toBe(
      "/a\\x20\\x20b c\\ue500/.test(s)",
    );
    // Every `/` of a body that would write `//`, which Angular reads as a comment.
    expect(angularCode("/^\\//.test(s)", "attribute")).toBe("/^\\x2f/.test(s)");
    expect(angularCode("/\\/a[/]\\//.test(s)", "block")).toBe("/\\x2fa[/]\\x2f/.test(s)");
    expect(angularCode("/a[//]/.test(s)", "block")).toBe("/a[\\x2f\\x2f]/.test(s)");
    expect(angularCode("/\\/a\\/b/.test(s)", "block")).toBe("/\\x2fa\\x2fb/.test(s)");
    expect(angularCode("/a//2", "block")).toBe("/a/ /2");
  });

  // Angular's template lexer opens a tag at `<` before a letter or `!`, in an interpolation too.
  it("writes a regular expression's `<` so that no interpolation opens a tag", () => {
    expect(angularCode("/a<b/.test(s)", "interpolation")).toBe("/a\\x3cb/.test(s)");
    expect(angularCode("/a<b/.test(s)", "block")).toBe("/a<b/.test(s)");
    // A group's name and a lookbehind have no escape: a reference, once every `&` is one.
    expect(angularCode("s && /(?<x>a)\\k<x>(?<!b)/.test(s)", "interpolation")).toBe(
      "s &amp;&amp; /(?&lt;x>a)\\k&lt;x>(?&lt;!b)/.test(s)",
    );
    expect(angularCode("a</b/.test(s)", "interpolation")).toBe("a< /b/.test(s)");
  });

  // angular-eslint lints the raw text of the TypeScript template literal around the template,
  // where a `\'` reads as an escaped backslash and a closing quote, and Angular's search for a
  // comment (`//`) ends a string at any quote of its kind: no backslash ever comes before a quote.
  it("writes a string in the quote its value does not hold, or its own quote as an escape", () => {
    expect(angularCode('"a\\"b" + "c//d"', "interpolation")).toBe(`'a"b' + "c//d"`);
    expect(angularCode('s ? "Saved" : "Don\'t"', "attribute")).toBe(
      "s ? 'Saved' : &quot;Don't&quot;",
    );
    expect(angularCode("`${s}'s`", "attribute")).toBe("s + &quot;'s&quot;");
    expect(angularCode('`Results for "${s}"`', "interpolation")).toBe(`'Results for "' + s + '"'`);
    expect(angularCode(`s === 'say "hi"'`, "block")).toBe(`s === 'say "hi"'`);
    expect(angularCode(`"it's \\"x\\" // y"`, "interpolation")).toBe(
      '"it\'s \\u0022x\\u0022 // y"',
    );
    expect(angularCode(`"it's \\"x\\""`, "attribute")).toBe("'it\\u0027s &quot;x&quot;'");
  });

  // Angular's lexer takes every `.` after a number into it, and reads `?.` as optional chaining.
  it("keeps a number apart from a `.` after it and a `?` before it", () => {
    expect(angularCode("1.5.toFixed(1) + 5..toString() + 1e3.toString()", "interpolation")).toBe(
      "(1.5).toFixed(1) + (5).toString() + (1e3).toString()",
    );
    expect(angularCode(".5.toFixed(1) + 0x10.toString()", "attribute")).toBe(
      "(.5).toFixed(1) + (16).toString()",
    );
    expect(angularCode("String(n > 1?.5:1)", "block")).toBe("String(n > 1?0.5:1)");
    expect(angularCode("x?.y ?? .5 + 1.5 .toFixed(1) + 1.5?.toFixed()", "block")).toBe(
      "x?.y ?? .5 + 1.5 .toFixed(1) + 1.5?.toFixed()",
    );
  });

  // Angular decodes an interpolation's references with `/&([^;]+);/` once it has found its end,
  // so a bare `&` would take the `;` of a reference after it; an attribute value's lexer decodes
  // each reference on its own, and a block's parameters are read as written.
  it("writes every `&` as a reference in an interpolation that needs one", () => {
    expect(angularCode('(a&&b) || "none"', "interpolation")).toBe('(a&amp;&amp;b) || "none"');
    expect(angularCode("s && /R&D/.test(s)", "interpolation")).toBe(
      "s &amp;&amp; /R&amp;D/.test(s)",
    );
    expect(angularCode("a && b & c", "interpolation")).toBe("a && b & c");
    expect(angularCode('(a&&b) || "none"', "attribute")).toBe("(a&&amp;b) || 'none'");
    expect(angularCode("s && /R&D/.test(s)", "block")).toBe("s && /R&D/.test(s)");
  });

  // An attribute value's lexer reads `{{` as an interpolation, and decodes its text as one.
  it("keeps `{{` out of a regular expression", () => {
    expect(angularCode("/a{{b/.test(s)", "attribute")).toBe("/a\\x7b{b/.test(s)");
    expect(angularCode("/\\{{2}/.test(s)", "block")).toBe("/\\x7b{2}/.test(s)");
  });

  it("writes U+E500 in a literal as an escape, which Angular's whitespace processing keeps", () => {
    expect(angularCode('s + "x\\ue500"', "interpolation")).toBe('s + "x\\ue500"');
    expect(angularCode('s + "x\ue500"', "attribute")).toBe("s + 'x\\ue500'");
  });

  // Angular's expression lexer reads only ASCII whitespace and the no-break space.
  it("writes whitespace outside ASCII between tokens as a space", () => {
    expect(angularCode("a\u3000+\u2028b +\ufeffc\u00a0+ d", "block")).toBe("a + b + c\u00a0+ d");
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
