// The scoper (ADR-0063): every rewrite equals `@vue/compiler-sfc`'s `compileStyle({ scoped: true })`
// on the same input, but for the attribute's name and the whitespace between tokens: both keep
// every declaration as written. Vue scopes what the scoper rejects, so each rejection has a test
// of its own, and so has each form where Vue's output does not parse.
import { describe, expect, it } from "vitest";
import { compileStyle } from "vue/compiler-sfc";

import { scopeStylesheet } from "../src/index.ts";

const ID = "70af206b";

/**
 * A sheet without the whitespace around its punctuation, which Vue's printer and the scoper's
 * splices lay out differently, and without the `;` before a `}`. Nothing else changes.
 */
function squashed(css: string): string {
  return css
    .replace(/\s+/g, " ")
    .replace(/\s*([{};,>+~])\s*/g, "$1")
    .replaceAll(";}", "}")
    .trim();
}

/** Vue's scoped sheet, with Vue's attribute renamed to Unframework's. */
function vue(source: string): string {
  const result = compileStyle({ source, filename: "Card.css", id: `data-v-${ID}`, scoped: true });
  expect(result.errors).toEqual([]);
  return result.code.replaceAll(`data-v-${ID}`, `data-uf-${ID}`);
}

function scoped(source: string): string {
  const result = scopeStylesheet("Card.css", source, ID);
  expect(result.diagnostics).toEqual([]);
  return result.code;
}

describe("scopeStylesheet", () => {
  it.each([
    ["a descendant selector", ".a .b { color: red }"],
    ["a selector list", ".a, .b > .c { color: red }"],
    ["an id, a tag and an attribute", "#a, p, [data-state='open'] { color: red }"],
    ["a pseudo-class", ".a:hover { color: red }"],
    ["a pseudo-element", ".a::before { content: 'x' }"],
    ["a pseudo-element and a pseudo-class", ".a::after:hover { color: red }"],
    ["a lone pseudo-element", "::before { content: 'x' }"],
    ["a lone pseudo-class", ":not(.a) { color: red }"],
    ["a pseudo-class after a combinator", ".a :hover { color: red }"],
    ["a universal selector alone", "* { margin: 0 }"],
    ["a universal selector first", "* .a, *.b { margin: 0 }"],
    ["a universal selector last", ".a > * { margin: 0 }"],
    [":is() alone", ":is(.a, .b) { color: red }"],
    [":is() before a compound", ":is(.a, .b) .c { color: red }"],
    [":where() after a compound", ".a:where(.b) { color: red }"],
    [":deep()", ".a :deep(.b) { color: red }"],
    [":deep() first", ":deep(.b) { color: red }"],
    [":deep() on a compound", ".a:deep(.b) { color: red }"],
    [":deep() after a combinator", ".a > :deep(.b) { color: red }"],
    [":deep() with a compound after it", ".a :deep(.b) .c { color: red }"],
    [":deep() of a complex selector", ".a :deep(.b > .c) { color: red }"],
    [":global()", ":global(.b) { color: red }"],
    [":global() of a complex selector", ":global(.page .title) { color: red }"],
    [":global() of the root", ":global(:root) { --gap: 4px }"],
    [":slotted()", ":slotted(.b) { color: red }"],
    [":slotted() between compounds", ".a :slotted(.b) .c { color: red }"],
    [":slotted() of a pseudo-class", ":slotted(.b:hover) { color: red }"],
    ["@media", "@media (min-width: 600px) { .a { color: red } }"],
    ["@supports", "@supports (display: grid) { .a { display: grid } }"],
    ["@layer", "@layer base { .a { color: red } } @layer base, theme;"],
    ["@container", "@container (min-width: 400px) { .a { color: red } }"],
    ["nested at-rules", "@layer base { @media print { .a { color: red } } }"],
    [
      "@keyframes and animation",
      "@keyframes spin { to { rotate: 1turn } } .a { animation: spin 1s linear infinite }",
    ],
    [
      "@keyframes and animation-name",
      "@keyframes fade { from { opacity: 0 } } .a { animation-name: fade, other }",
    ],
    [
      "@keyframes in @media",
      "@media (min-width: 1px) { @keyframes spin { to { rotate: 1turn } } } .a { animation: spin 1s }",
    ],
    [
      "a vendor-prefixed @keyframes",
      "@-webkit-keyframes spin { to { opacity: 1 } } .a { -webkit-animation-name: spin }",
    ],
    [
      "an animation of an unknown name",
      "@keyframes spin { to { opacity: 1 } } .a { animation: other 1s }",
    ],
    ["custom properties", ".a { --gap: 4px; gap: var(--gap) }"],
    [
      "custom properties set on the root's descendants",
      ".a { --tone: red } .a .b { color: var(--tone) }",
    ],
    ["a nested rule", ".a { color: red; .b { color: blue } }"],
    ["a nested rule without declarations", ".a { .b { color: blue } }"],
    ["a nested rule with &", ".a { & .b { color: blue } &:hover { color: green } }"],
    ["declarations after a nested rule", ".a { color: red; .b { color: blue } margin: 0 }"],
    ["a nested at-rule", ".a { color: red; @media print { color: blue } }"],
    [
      "a nested at-rule beside a nested rule",
      ".a { .b { color: blue } @media print { color: green } }",
    ],
    [":deep() with a nested rule", ".a :deep(.b) { color: red; .c { color: blue } }"],
    [":deep() first in a nested rule", ".a { :deep(.b) { color: blue } }"],
    ["!important", ".a { color: red !important }"],
    [
      "an animation with !important",
      "@keyframes spin { to { opacity: 1 } } .a { animation: spin 1s !important }",
    ],
    [
      "an animation through var()",
      "@keyframes spin { to { opacity: 1 } } .a { animation: spin var(--d) }",
    ],
    [
      "fallback declarations",
      ".a { height: 100vh; height: 100dvh; color: red; color: oklch(70% 0.1 200) }",
    ],
    [
      "values lightningcss cannot read back",
      ".a { border-radius: calc(infinity * 1px); opacity: 1e10; font-weight: 2147483648 }",
    ],
    [
      "custom properties as written",
      ".a { --z: rgb(255, 0, 0); --t: 1000ms; --w: calc(100% - 1px) }",
    ],
    [
      "a prefixed animation beside a longhand",
      "@keyframes spin { to { opacity: 1 } } .a { -webkit-animation: spin 1s; animation-name: spin }",
    ],
    ["an @import into a layer", '@import "x.css" layer; .a { color: red }'],
    ["comments", "/* a */ .a /* b */ { color: red /* c */ }"],
    [":nth-child() of a selector", ".a :nth-child(2n + 1 of .b) { color: red }"],
    ["an escaped class", ".sm\\:p-2 { padding: 2px }"],
    ["an attribute holding a bracket", '[data-x="]"] { color: red }'],
    ["a /* in an unquoted url()", ".a { background: url(/*.png) } .b { color: red }"],
    ["a { in an unquoted url()", ".a { background: url(x{y.png) } .b { color: red }"],
    ["an @import of an unquoted url() with a {", "@import url(a{b.css); .a { color: red }"],
    ["an @import of an unquoted url() with a /*", "@import url(/*.css); .a { color: red }"],
    [":deep() after a leading *", "* :deep(.a) { color: red }"],
    [":deep() after a nested leading *", ".x { * :deep(.a) { color: red } }"],
    [
      "animation-name with !important",
      "@keyframes spin { to { opacity: 1 } } .a { animation-name: spin !important }",
    ],
    [
      "animation-name lists with !important",
      "@keyframes spin { to { opacity: 1 } } .a { animation-name: other, spin !important }",
    ],
    [
      "animation-name with !important unspaced",
      "@keyframes spin { to { opacity: 1 } } .a { animation-name: spin!important }",
    ],
    ["an escaped quote in an attribute value", '[data-x=\\"a\\"] { color: red }'],
    ["an escaped space in an attribute value", "[data-x=a\\ b] { color: red }"],
    ["a hex escape in an attribute value", "[data-x=\\31 0] { color: red }"],
    ["a hex escape in an attribute name", "[\\64 ata-x] { color: red }"],
    ["a comment in an attribute selector", '[data-x/*c*/=a], [data-x="a"/*c*/] { color: red }'],
    [
      "a plain selector before :deep() with nested rules",
      ".c, .a :deep(.b) { color: red; .d { color: blue } }",
    ],
    [
      ":deep() before a plain selector with nested rules",
      ".a :deep(.b), .c { color: red; .d { color: blue } }",
    ],
    [
      "an animation moved with nested rules",
      "@keyframes spin { to { opacity: 1 } } .a { animation: spin 1s; .b { color: blue } }",
    ],
    [
      "two animations moved with nested rules",
      "@keyframes spin { to { opacity: 1 } } @keyframes fade { to { opacity: 0 } } .a { animation: spin 1s, fade 2s; .b { color: blue } }",
    ],
    [
      "an animation in @media",
      "@keyframes spin { to { opacity: 1 } } @media (min-width: 1px) { .a { animation: spin 1s } }",
    ],
    ["a minified grouping rule", "@media print{:deep(.b){color:red}}"],
    ["a custom property holding braces", ".a { --x: { a: b }; color: red }"],
    ["@starting-style", "@starting-style { .a { opacity: 0 } }"],
    ["@scope", "@scope (.card) { .a { color: red } }"],
    ["@-moz-document", "@-moz-document url-prefix() { .a { color: red } }"],
    ["non-ASCII identifiers", ".café .b { color: red }"],
  ])("rewrites %s as Vue does", (_name, source) => {
    expect(squashed(scoped(source))).toBe(squashed(vue(source)));
  });

  it("keeps the sheet's text, and changes only selectors and keyframe names", () => {
    expect(scoped(".label { color: #ff0000 }\n@keyframes spin { to { opacity: 1 } }\n")).toBe(
      `.label[data-uf-${ID}] { color: #ff0000 }\n@keyframes spin-${ID} { to { opacity: 1 } }\n`,
    );
  });

  // Vue's output for these does not parse, or names keyframes that no longer exist.
  it.each([
    [
      "a leading * before a sibling combinator",
      "* + * { margin: 0 }",
      `* + *[data-uf-${ID}] { margin: 0 }`,
    ],
    [
      "a leading * before a child combinator",
      "* > .a { margin: 0 }",
      `* > .a[data-uf-${ID}] { margin: 0 }`,
    ],
    [
      "a nested * + *",
      ".stack { * + * { margin-top: 1em } }",
      `.stack { * + *[data-uf-${ID}] { margin-top: 1em } }`,
    ],
    [
      "a lone * with nested rules",
      "* { color: red; .b { color: blue } }",
      `* { &[data-uf-${ID}] { color: red; }  .b[data-uf-${ID}] { color: blue } }`,
    ],
    [
      "quoted keyframe names",
      '@keyframes "q" { to { opacity: 1 } } .a { animation: "q" 1s } .b { animation-name: q }',
      `@keyframes "q-${ID}" { to { opacity: 1 } } .a[data-uf-${ID}] { animation: "q-${ID}" 1s } .b[data-uf-${ID}] { animation-name: q-${ID} }`,
    ],
    [
      "a leading * before a pseudo-element",
      "* + ::before { content: '' }",
      `*[data-uf-${ID}] + ::before { content: '' }`,
    ],
    [
      ":deep() after a comment",
      ".a/*c*/:deep(.p) { color: red }",
      `.a[data-uf-${ID}]/*c*/ .p { color: red }`,
    ],
  ])("writes %s so that it parses", (_name, source, expected) => {
    expect(scoped(source)).toBe(expected);
    expect(scopeStylesheet("Out.css", expected, "0000ffff").diagnostics).toEqual([]);
  });

  it("reports an at-rule lightningcss does not know as UF5002, since its rules would leak", () => {
    for (const source of [
      "@unknown-rule foo { .a { color: red } }",
      "@document url(http://x) { .a { color: red } }",
    ]) {
      const result = scopeStylesheet("Card.css", source, ID);
      expect(result.code).toBe("");
      expect(result.diagnostics.map(({ code }) => code)).toEqual(["UF5002"]);
    }
  });

  it("stamps the -s attribute for :slotted(), and says the sheet uses it", () => {
    const result = scopeStylesheet("Card.css", ":slotted(.b) { color: red }", ID);
    expect(result.code).toContain(`.b[data-uf-${ID}-s]`);
    expect(result.slotted).toBe(true);
    expect(scopeStylesheet("Card.css", ".a :deep(.b) {}", ID).slotted).toBe(false);
  });

  it("is deterministic", () => {
    const source =
      "@keyframes spin { to { opacity: 1 } } .a :deep(.b), :slotted(.c) { animation: spin 1s }";
    expect(scopeStylesheet("Card.css", source, ID)).toEqual(
      scopeStylesheet("Card.css", source, ID),
    );
  });

  it("reports a sheet that does not parse as UF5002, in the sheet", () => {
    const source = ".a { color: red }\n.b > { }";
    const result = scopeStylesheet("src/Card.css", source, ID);
    expect(result.code).toBe("");
    expect(result.diagnostics.map(({ code, file }) => [code, file])).toEqual([
      ["UF5002", "src/Card.css"],
    ]);
  });
});

/** The rejected selectors' text, as each diagnostic's span covers it in the sheet. */
function rejected(source: string): string[] {
  const { code, diagnostics } = scopeStylesheet("src/Card.css", source, ID);
  for (const diagnostic of diagnostics) {
    expect(diagnostic.code).toBe("UF5004");
    expect(diagnostic.file).toBe("src/Card.css");
  }
  if (diagnostics.length) expect(code).toBe("");
  return diagnostics.map(({ span }) => source.slice(span.start, span.end));
}

describe("scopeStylesheet's rejected selectors (UF5004)", () => {
  // Vue scopes these, and the scoped selector matches nothing: `[data-v-x]:root`.
  it.each([
    [":root", ":root { --gap: 4px }"],
    ["html", "html { font-size: 16px }"],
    ["body in a complex selector", "body .a { margin: 0 }"],
    [":root inside :deep()", ".a :deep(:root) { color: red }"],
    [":root inside :not()", ".a:not(:root) { color: red }"],
  ])("rejects %s outside :global()", (_name, source) => {
    expect(rejected(source)).toEqual([source.slice(0, source.indexOf("{")).trim()]);
  });

  it.each([
    [":host", ":host { display: block }"],
    [":host()", ":host(.open) { display: block }"],
    [":host-context()", ":host-context(.dark) { color: white }"],
    [":host inside :global()", ":global(:host) { display: block }"],
  ])("rejects %s, which no target renders", (_name, source) => {
    expect(rejected(source)).toEqual([source.slice(0, source.indexOf("{")).trim()]);
  });

  it.each([
    ["[class]", "[class] { color: red }"],
    ["[style]", ".a[style] { color: red }"],
    ['[class=""]', '[class=""] { color: red }'],
    ['[style|=""]', '[style|=""] { color: red }'],
    [":not([class])", ".a:not([class]) { color: red }"],
    ["[class] inside :global()", ":global([class]) { color: red }"],
  ])("rejects %s, which tells an empty attribute from none", (_name, source) => {
    expect(rejected(source)).toEqual([source.slice(0, source.indexOf("{")).trim()]);
  });

  it.each([
    ["an empty :deep()", ":deep() { color: red }"],
    ["an empty :slotted()", ".a :slotted() { color: red }"],
    ["an empty :global()", ":global() { color: red }"],
    ["a list in :slotted()", ":slotted(.a, .b) { color: red }"],
    [":global() beside other selectors", ":global(.a) .b { color: red }"],
    [":global() after other selectors", ".a :global(.b) { color: red }"],
    ["two scoping pseudo-classes", ".a :deep(.b) :deep(.c) { color: red }"],
    [":slotted() inside :deep()", ".a :deep(:slotted(.b)) { color: red }"],
    [":deep() inside :is()", ":is(.a :deep(.b)) { color: red }"],
    [":deep() without an argument", ".a :deep .b { color: red }"],
    ["::v-deep()", ".a ::v-deep(.b) { color: red }"],
    ["::slotted()", "::slotted(.b) { color: red }"],
    [":slotted() in a rule with nested rules", ".a:slotted(*) { .b { color: red } }"],
    [
      ":slotted() with declarations and nested rules",
      ":slotted(.a) { color: red; .b { color: blue } }",
    ],
  ])("rejects %s as misused", (_name, source) => {
    expect(rejected(source)).toEqual([source.slice(0, source.indexOf("{")).trim()]);
  });

  // Vue's `[data-v-x]` for `*|*` drops the namespace, and its `svg|[data-v-x]*` does not parse.
  it.each([
    ["*|*", "*|* { color: red }"],
    ["svg|*", "svg|* { color: red }"],
    ["|*", "|* { color: red }"],
    ["svg|circle", ".a svg|circle { fill: red }"],
  ])("rejects the namespace prefix of %s", (_name, source) => {
    expect(rejected(source)).toEqual([source.slice(0, source.indexOf("{")).trim()]);
  });

  it("rejects :slotted() inside a rule that uses :deep()", () => {
    expect(rejected(":deep(.p) { div:slotted(*) { color: red } }")).toEqual(["div:slotted(*)"]);
  });

  it("reads an escaped attribute name before it checks it", () => {
    expect(rejected('[cl\\61ss=""] { color: red }')).toEqual(['[cl\\61ss=""]']);
  });

  it("points at the rejected selector of a list, in a nested rule", () => {
    const source = ".a,\n  .b { color: red; .c, html .d { color: blue } }\n:root, .e { --x: 1 }";
    expect(rejected(source)).toEqual(["html .d", ":root"]);
  });

  it("reads past comments, strings and escapes to find the selector", () => {
    const source = '.a /* :deep( */, [data-x=":global("] .b\\:c, /* x */ :host { color: red }';
    expect(rejected(source)).toEqual([":host"]);
  });

  it("allows the page's elements inside :global(), and attribute tests that never match an empty value", () => {
    expect(
      rejected(
        ':global(:root) { --x: 1 } :global(html body) { margin: 0 } [class~="a"], [style*="color"] { color: red }',
      ),
    ).toEqual([]);
  });

  it("says how to fix each", () => {
    const { diagnostics } = scopeStylesheet("Card.css", ":root { --x: 1 }", ID);
    expect(diagnostics).toEqual([
      {
        code: "UF5004",
        severity: "error",
        file: "Card.css",
        span: { start: 0, end: 5 },
        message:
          "`:root` matches an element of the page, never one of this component, so it cannot be scoped.",
        help: "Wrap the selector in `:global()`, or move the rule to a global stylesheet.",
      },
    ]);
  });
});
