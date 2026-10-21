// The scoper (ADR-0063): every rewrite equals `@vue/compiler-sfc`'s `compileStyle({ scoped: true })`
// on the same input, but for the attribute's name, and both are compared as lightningcss prints
// them. Vue scopes what the scoper rejects, so each rejection has a test of its own.
import { transform } from "lightningcss";
import { describe, expect, it } from "vitest";
import { compileStyle } from "vue/compiler-sfc";

import { scopeStylesheet } from "../src/index.ts";

const ID = "70af206b";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** A sheet as lightningcss prints it, which is how the scoper prints its own. */
function printed(css: string): string {
  return decoder.decode(transform({ filename: "Card.css", code: encoder.encode(css) }).code);
}

/** Vue's scoped sheet, with Vue's attribute renamed to Unframework's. */
function vue(source: string): string {
  const result = compileStyle({ source, filename: "Card.css", id: `data-v-${ID}`, scoped: true });
  expect(result.errors).toEqual([]);
  return printed(result.code.replaceAll(`data-v-${ID}`, `data-uf-${ID}`));
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
  ])("rewrites %s as Vue does", (_name, source) => {
    expect(scoped(source)).toBe(vue(source));
  });

  it("scopes with the attribute and the keyframes suffix of the id", () => {
    expect(scoped(".label { color: red }\n@keyframes spin { to { opacity: 1 } }")).toBe(
      [
        `.label[data-uf-${ID}] {`,
        "  color: red;",
        "}",
        "",
        `@keyframes spin-${ID} {`,
        "  to {",
        "    opacity: 1;",
        "  }",
        "}",
        "",
      ].join("\n"),
    );
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
  ])("rejects %s as misused", (_name, source) => {
    expect(rejected(source)).toEqual([source.slice(0, source.indexOf("{")).trim()]);
  });

  it("points at the rejected selector of a list, in a nested rule", () => {
    const source = ".a,\n  .b { color: red; .c, html .d { color: blue } }\n:root, .e { --x: 1 }";
    expect(rejected(source)).toEqual(["html .d", ":root"]);
  });

  it("reads past comments, strings and escapes to find the selector", () => {
    const source = '.a /* :deep( */, [data-x=":global("] .b\\:c, :host { color: red }';
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
