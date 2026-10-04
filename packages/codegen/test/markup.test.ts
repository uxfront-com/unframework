// How each dialect writes markup: layout and escaping snapshots, so a change to the printed
// form is reviewed. Whether a framework renders that form as the IR describes is not decided
// here but by each markup target's render-parity and markup-semantics tests, which run the
// framework's own compiler and server renderer over the same trees (codegen/test/render-parity.ts,
// codegen/test/markup-cases.ts).
import { createElement, createStaticAttribute, createText } from "@unframework/ir";
import type { ElementNode, FragmentNode, RenderNode } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import {
  angularDialect,
  astroDialect,
  conjoin,
  htmlDialect,
  member,
  negate,
  printMarkup,
  svelteDialect,
  vueDialect,
} from "../src/markup.ts";
import type { MarkupOptions } from "../src/markup.ts";
import { suite } from "./markup-cases.ts";
import type { Builder, PropSpec } from "./markup-cases.ts";

const at = { start: 0, end: 0 };
const el = (tag: string, children: RenderNode[] = [], attributes: [string, string | true][] = []) =>
  createElement(
    tag,
    attributes.map(([name, value]) => createStaticAttribute(name, value, at)),
    children,
    at,
  );
const text = (value: string) => createText(value, at);
const p = (...children: RenderNode[]) => el("p", children);

describe("escaping", () => {
  /** Printed on one line, so the snapshots show the escapes alone. */
  const flat = { printWidth: Number.POSITIVE_INFINITY };
  const tricky = el(
    "p",
    [text("a < b & {{ c }} {d} @if ok\u00a0x")],
    [["title", 'say "hi" & {x}']],
  );

  it("escapes HTML", () => {
    expect(printMarkup(tricky, htmlDialect, flat)).toBe(
      '<p title="say &quot;hi&quot; &amp; {x}">a &lt; b &amp; {{ c }} {d} @if ok&nbsp;x</p>',
    );
  });

  it("escapes Vue interpolation", () => {
    expect(printMarkup(tricky, vueDialect, flat)).toBe(
      '<p title="say &quot;hi&quot; &amp; {x}">a &lt; b &amp; {&#123; c }} {d} @if ok&nbsp;x</p>',
    );
  });

  it("escapes Svelte expressions in text and attributes", () => {
    expect(printMarkup(tricky, svelteDialect, flat)).toBe(
      '<p title="say &quot;hi&quot; &amp; &#123;x&#125;">a &lt; b &amp; &#123;&#123; c &#125;&#125; &#123;d&#125; @if ok&nbsp;x</p>',
    );
  });

  it("escapes Angular interpolation, braces and blocks", () => {
    // Angular decodes `&#123;&#123;` before it looks for interpolations, so a run of `{` is an
    // interpolated string literal.
    expect(printMarkup(tricky, angularDialect, flat)).toBe(
      '<p title="say &quot;hi&quot; &amp; &#123;x&#125;">a &lt; b &amp; {{ "\\u007b\\u007b" }} c &#125;&#125; &#123;d&#125; &#64;if ok&nbsp;x</p>',
    );
  });

  it("binds a Svelte option's attribute that its server renderer would escape twice", () => {
    const option = el(
      "option",
      [text("x")],
      [
        ["title", 'a<b & "c"'],
        ["value", "v"],
      ],
    );
    expect(printMarkup(option, svelteDialect)).toBe(
      '<option title={"a\\u003cb \\u0026 \\"c\\""} value="v">x</option>',
    );
    expect(printMarkup(el("p", [], [["title", "a<b"]]), svelteDialect)).toBe('<p title="a<b"></p>');
  });

  it("escapes Astro expressions in text only", () => {
    expect(printMarkup(tricky, astroDialect, flat)).toBe(
      '<p title="say &quot;hi&quot; &amp; {x}">a &lt; b &amp; &#123;&#123; c &#125;&#125; &#123;d&#125; @if ok&nbsp;x</p>',
    );
  });

  it("writes carriage returns as references, which HTML would turn into line feeds", () => {
    expect(printMarkup(el("pre", [text("a\rb")], [["title", "c\rd"]]), htmlDialect)).toBe(
      '<pre title="c&#13;d">a&#13;b</pre>',
    );
  });
});

describe("elements", () => {
  it("writes void elements per dialect and closes empty elements explicitly", () => {
    const node = el("div", [el("br"), el("span")]);
    expect(printMarkup(node, htmlDialect)).toBe("<div><br><span></span></div>");
    expect(printMarkup(node, svelteDialect)).toBe("<div>\n  <br /><span></span>\n</div>");
  });

  it("writes attributes without a value bare", () => {
    const input = el(
      "input",
      [],
      [
        ["disabled", true],
        ["type", "text"],
      ],
    );
    expect(printMarkup(input, vueDialect)).toBe('<input disabled type="text" />');
  });

  it("lets the caller write attributes its way", () => {
    expect(
      printMarkup(el("p", [], [["class", "a"]]), vueDialect, {
        attribute: (attribute) =>
          attribute.kind === "Static"
            ? `:${attribute.name}="'${String(attribute.value)}'"`
            : undefined,
      }),
    ).toBe(`<p :class="'a'"></p>`);
  });
});

describe("layout", () => {
  const blocks = el("article", [
    el("h2", [text("Title")]),
    el("p", [text("Body")]),
    el("hr"),
    el("label", [text("Note")]),
    el("input"),
  ]);
  const inlines = el("p", [el("b", [text("a")]), el("i", [text("b")])]);

  it("breaks lines between any two elements where the compiler drops the break", () => {
    for (const dialect of [vueDialect, angularDialect, astroDialect]) {
      expect(printMarkup(blocks, dialect)).toBe(
        "<article>\n  <h2>Title</h2>\n  <p>Body</p>\n  <hr />\n  <label>Note</label>\n  <input />\n</article>",
      );
      expect(printMarkup(inlines, dialect)).toBe("<p>\n  <b>a</b>\n  <i>b</i>\n</p>");
    }
  });

  it("breaks inside a tag where Svelte would keep the break as a space", () => {
    // Block-level siblings start lines; inline ones stay together.
    expect(printMarkup(blocks, svelteDialect)).toBe(
      "<article>\n  <h2>Title</h2\n  ><p>Body</p\n  ><hr\n  /><label>Note</label><input />\n</article>",
    );
    expect(printMarkup(inlines, svelteDialect)).toBe("<p>\n  <b>a</b><i>b</i>\n</p>");
    // A closing `/>` alone on its line takes the next sibling after it.
    const header = el("header", [
      el(
        "img",
        [],
        [
          ["src", "x".repeat(80)],
          ["alt", "An image"],
        ],
      ),
      el("h2", [text("T")]),
    ]);
    expect(printMarkup(header, svelteDialect)).toBe(
      `<header>\n  <img\n    src="${"x".repeat(80)}"\n    alt="An image"\n  /><h2>T</h2>\n</header>`,
    );
  });

  it("never breaks plain HTML, which keeps all whitespace", () => {
    const span: ElementNode = el("span", [el("b", [text("a")]), el("div", [text("b")])]);
    expect(printMarkup(span, htmlDialect)).toBe("<span><b>a</b><div>b</div></span>");
    expect(printMarkup(blocks, htmlDialect)).toBe(
      "<article><h2>Title</h2><p>Body</p><hr><label>Note</label><input></article>",
    );
  });

  it("keeps text hugging its neighbours", () => {
    const node = el("p", [text("Line one"), el("br"), text("Line two")]);
    expect(printMarkup(node, vueDialect)).toBe("<p>Line one<br />Line two</p>");
  });

  it("never reflows whitespace-preserving elements", () => {
    const node = el("pre", [el("b", [text("a")]), el("div", [text("b")])]);
    expect(printMarkup(node, vueDialect)).toBe("<pre><b>a</b><div>b</div></pre>");
  });

  it("indents from the given level", () => {
    expect(printMarkup(el("article", [el("h2", [text("Title")])]), vueDialect, { level: 1 })).toBe(
      "  <article>\n    <h2>Title</h2>\n  </article>",
    );
  });

  it("puts one attribute per line in an inline tag that would pass the line's end", () => {
    const link = (href: string) =>
      el(
        "a",
        [text("link")],
        [
          ["class", "article-link article-link--external"],
          ["href", href],
        ],
      );
    const node = p(text("See "), link(`https://example.com/${"a".repeat(30)}`), text("."));
    const wrapped = [
      "<p>See <a",
      '  class="article-link article-link--external"',
      `  href="https://example.com/${"a".repeat(30)}"`,
      ">link</a>.</p>",
    ].join("\n");
    for (const dialect of [vueDialect, svelteDialect, angularDialect, astroDialect]) {
      expect(printMarkup(node, dialect)).toBe(wrapped);
    }
    // Indented from the line the tag starts on; a short tag stays on its line.
    expect(printMarkup(el("div", [node]), vueDialect, { level: 1 }).split("\n")).toEqual([
      "  <div>",
      "    <p>See <a",
      '      class="article-link article-link--external"',
      `      href="https://example.com/${"a".repeat(30)}"`,
      "    >link</a>.</p>",
      "  </div>",
    ]);
    expect(printMarkup(p(text("See "), link("/a"), text(".")), vueDialect)).toBe(
      '<p>See <a class="article-link article-link--external" href="/a">link</a>.</p>',
    );
  });

  it("breaks a run of inline siblings inside a tag on Svelte once the line is too long", () => {
    const tags = "typescript compilers frameworks testing parity markup".split(" ");
    const nav = el(
      "nav",
      tags.map((tag) => el("a", [text(tag)], [["href", `/t/${tag}`]])),
    );
    expect(printMarkup(nav, svelteDialect)).toBe(
      [
        "<nav>",
        '  <a href="/t/typescript">typescript</a><a href="/t/compilers">compilers</a',
        '  ><a href="/t/frameworks">frameworks</a><a href="/t/testing">testing</a',
        '  ><a href="/t/parity">parity</a><a href="/t/markup">markup</a>',
        "</nav>",
      ].join("\n"),
    );
  });

  it("puts a single attribute on its own line too, and never breaks text or a bare tag", () => {
    const topics = ["setup", "components", "styling", "testing", "deployment", "migration"];
    const links = topics.flatMap((topic, index) => [
      ...(index ? [text(" ")] : []),
      el("a", [text(topic)], [["href", `/docs/guides/${topic}/introduction`]]),
    ]);
    const lines = printMarkup(p(...links), vueDialect).split("\n");
    expect(lines).toEqual([
      "<p>",
      '  <a href="/docs/guides/setup/introduction">setup</a> <a',
      '    href="/docs/guides/components/introduction"',
      '  >components</a> <a href="/docs/guides/styling/introduction">styling</a> <a',
      '    href="/docs/guides/testing/introduction"',
      '  >testing</a> <a href="/docs/guides/deployment/introduction">deployment</a> <a',
      '    href="/docs/guides/migration/introduction"',
      "  >migration</a>",
      "</p>",
    ]);
    for (const dialect of [svelteDialect, astroDialect]) {
      expect(printMarkup(p(...links), dialect)).toBe(lines.join("\n"));
    }
    expect(printMarkup(p(...links), angularDialect)).toBe(
      lines.join("\n").replaceAll("</a> <a", "</a>&ngsp;<a"),
    );
    const long = "word ".repeat(30).trimEnd();
    expect(printMarkup(p(text("a "), el("b", [text(long)])), vueDialect)).toBe(
      `<p>a <b>${long}</b></p>`,
    );
  });

  it("puts one attribute per line when a tag is too long", () => {
    const node = el(
      "img",
      [],
      [
        ["src", "x".repeat(80)],
        ["alt", "An image"],
      ],
    );
    expect(printMarkup(node, svelteDialect)).toBe(
      `<img\n  src="${"x".repeat(80)}"\n  alt="An image"\n/>`,
    );
    const parent = el(
      "p",
      [text("text")],
      [
        ["class", "y".repeat(80)],
        ["title", "t"],
      ],
    );
    expect(printMarkup(parent, svelteDialect)).toBe(
      `<p\n  class="${"y".repeat(80)}"\n  title="t"\n>text</p>`,
    );
  });
});

describe("whitespace and delimiters that template compilers rewrite", () => {
  const runs = p(text("a  b\tc\nd"));

  it("keeps Vue's condensed whitespace and edge whitespace in interpolated literals", () => {
    expect(printMarkup(runs, vueDialect)).toBe('<p>{{ "a  b\\tc\\nd" }}</p>');
    expect(printMarkup(p(text("one space")), vueDialect)).toBe("<p>one space</p>");
    // Vue drops whitespace-only text with no sibling on one side.
    expect(printMarkup(p(el("span", [text(" "), el("b")]), el("i", [text(" ")])), vueDialect)).toBe(
      '<p>\n  <span>{{ " " }}<b></b></span>\n  <i>{{ " " }}</i>\n</p>',
    );
  });

  it("escapes what Vue reads inside an interpolation before the expression parser does", () => {
    // Vue decodes entities in `{{ }}`, ends one at the first `}}`, and tools see markup in `<`.
    expect(printMarkup(p(text("a  &amp; </p> {{ x }}")), vueDialect)).toBe(
      '<p>{{ "a  \\u0026amp; \\u003c/p\\u003e \\u007b\\u007b x \\u007d\\u007d" }}</p>',
    );
  });

  it("binds a Vue attribute holding a carriage return, which its server compiler would lose", () => {
    expect(printMarkup(el("p", [], [["title", "a\rb"]]), vueDialect)).toBe(
      `<p :title="'a\\rb'"></p>`,
    );
  });

  it("keeps edge whitespace through Svelte's trimming with an expression", () => {
    expect(printMarkup(p(text(" a ")), svelteDialect)).toBe('<p>{" a "}</p>');
    expect(printMarkup(p(text(" a"), el("b", [text("b")])), svelteDialect)).toBe(
      '<p>{" a"}<b>b</b></p>',
    );
    // Only the edges of an element's content are trimmed.
    expect(printMarkup(p(el("b", [text("a")]), text(" b "), el("i")), svelteDialect)).toBe(
      "<p>\n  <b>a</b> b <i></i>\n</p>",
    );
    expect(printMarkup(runs, svelteDialect)).toBe('<p>{"a  b\\tc\\nd"}</p>');
  });

  it("escapes every space Angular's whitespace removal would condense or drop", () => {
    expect(
      printMarkup(p(el("b", [text("a")]), text(" "), el("i", [text("b")])), angularDialect),
    ).toBe("<p>\n  <b>a</b>&ngsp;<i>b</i>\n</p>");
    expect(printMarkup(runs, angularDialect)).toBe('<p>{{ "a\\u0020\\u0020b\\tc\\nd" }}</p>');
    expect(printMarkup(p(text("a  \u2009\u3000b")), angularDialect)).toBe(
      '<p>{{ "a\\u0020\\u0020\\u2009\\u3000b" }}</p>',
    );
    expect(printMarkup(p(el("b"), text("\u2009"), el("i")), angularDialect)).toBe(
      '<p>\n  <b></b>{{ "\\u2009" }}<i></i>\n</p>',
    );
  });

  it("writes an Angular element whose attribute holds `{{` where Angular reads it as written", () => {
    // Angular would interpolate `{{` even as entities, and a binding goes through its sanitizer:
    // the element goes in a non-binding container that keeps its whitespace, and so its text
    // needs no interpolated literals, only references for what Angular's lexer still reads.
    const link = el("a", [text("a  b {{ c }} @if\t")], [["href", "/q?x={{ y }}"]]);
    const region = "<ng-container ngNonBindable ngPreserveWhitespaces>";
    expect(printMarkup(link, angularDialect).split("\n")).toEqual([
      `${region}<a`,
      '  href="/q?x=&#123;&#123; y &#125;&#125;"',
      ">a  b &#123;&#123; c &#125;&#125; &#64;if\t</a></ng-container>",
    ]);
    // Its children stay on its line, where a line break would be text; outside it, the layout
    // goes on as before.
    const list = el("ul", [el("li", [text("a")]), el("li", [text(" b ")])], [["title", "{{"]]);
    expect(printMarkup(el("div", [list, p(text("x"))]), angularDialect).split("\n")).toEqual([
      "<div>",
      `  ${region}<ul`,
      '    title="&#123;&#123;"',
      "  ><li>a</li><li> b </li></ul></ng-container>",
      "  <p>x</p>",
      "</div>",
    ]);
    // Only an element printed in its region may hold `{{`.
    expect(() => angularDialect.attribute("title", "{{", "p")).toThrow("literal region");
  });

  it("keeps line breaks and tabs through Astro's JSX whitespace rules", () => {
    expect(printMarkup(runs, astroDialect)).toBe('<p>{"a  b\\tc\\nd"}</p>');
    expect(printMarkup(p(text("a  b")), astroDialect)).toBe("<p>a  b</p>");
  });

  it("leaves text inside whitespace-preserving elements as written", () => {
    const pre = el("pre", [text(" a  b\n")]);
    expect(printMarkup(pre, vueDialect)).toBe("<pre> a  b\n</pre>");
    expect(printMarkup(pre, svelteDialect)).toBe("<pre> a  b\n</pre>");
    expect(printMarkup(pre, angularDialect)).toBe("<pre> a  b\n</pre>");
  });
});

const DIALECTS = {
  vue: vueDialect,
  svelte: svelteDialect,
  angular: angularDialect,
  astro: astroDialect,
} as const;

/**
 * A tree built with the markup cases' builder, printed by every markup dialect: each prop is
 * spelled `c0Name`, and called on Angular (`c0Name()`), as the targets' rewrite rules will.
 */
function printed(
  props: Readonly<Record<string, PropSpec>>,
  render: (build: Builder) => ElementNode | FragmentNode,
  options: MarkupOptions = {},
): Record<keyof typeof DIALECTS, string> {
  const cases = suite([{ name: "printed", props, render, expected: "" }], "self");
  const print = (name: keyof typeof DIALECTS) =>
    printMarkup(cases.component.render, DIALECTS[name], {
      ...options,
      component: cases.component,
      rewrite: cases.rules(name === "angular"),
    });
  return {
    vue: print("vue"),
    svelte: print("svelte"),
    angular: print("angular"),
    astro: print("astro"),
  };
}

const lines = (...each: string[]) => each.join("\n");
const on = { type: "boolean", value: true } as const;

describe("control flow", () => {
  it("writes a conditional as each language does, on lines only where content allows", () => {
    // The middle branch starts with text, so Svelte's and Angular's blocks stay on one line;
    // Vue's directives and Astro's parenthesised branches break around elements anyway.
    expect(
      printed({ a: on, b: on }, (b) =>
        b.el(
          "div",
          [],
          b.if(
            ["a", b.el("p", [], "A")],
            ["b", "text ", b.i("a")],
            [undefined, b.el("p", [], "C")],
          ),
        ),
      ),
    ).toEqual({
      vue: lines(
        "<div>",
        '  <p v-if="c0A">A</p>',
        '  <template v-else-if="c0B">text {{ c0A }}</template>',
        "  <p v-else>C</p>",
        "</div>",
      ),
      svelte: lines(
        "<div>",
        "  {#if c0A}<p>A</p>{:else if c0B}text {c0A}{:else}<p>C</p>{/if}",
        "</div>",
      ),
      angular: lines(
        "<div>",
        "  @if (c0A()) {<p>A</p>} @else if (c0B()) {text {{ c0A() }}} @else {<p>C</p>}",
        "</div>",
      ),
      astro: lines(
        "<div>",
        "  {c0A ? (",
        "    <p>A</p>",
        "  ) : c0B ? (",
        "    <>text {c0A}</>",
        "  ) : (",
        "    <p>C</p>",
        "  )}",
        "</div>",
      ),
    });
  });

  it("folds an empty branch into the conditions after it, where the language has no empty branch", () => {
    // angular-eslint rejects `@if (c) {}`; Astro's ternary says `null`.
    expect(
      printed({ a: on, b: on }, (b) =>
        b.el("div", [], b.if(["a"], ["b", b.el("p", [], "B")], [undefined, b.el("p", [], "C")])),
      ),
    ).toEqual({
      vue: lines("<div>", '  <p v-if="!c0A && c0B">B</p>', '  <p v-else-if="!c0A">C</p>', "</div>"),
      svelte: lines(
        "<div>",
        "  {#if !c0A && c0B}",
        "    <p>B</p>",
        "  {:else if !c0A}",
        "    <p>C</p>",
        "  {/if}",
        "</div>",
      ),
      angular: lines(
        "<div>",
        "  @if (!c0A() && c0B()) {",
        "    <p>B</p>",
        "  } @else if (!c0A()) {",
        "    <p>C</p>",
        "  }",
        "</div>",
      ),
      astro: lines(
        "<div>",
        "  {c0A ? null : c0B ? (",
        "    <p>B</p>",
        "  ) : (",
        "    <p>C</p>",
        "  )}",
        "</div>",
      ),
    });
  });

  it("writes a list, with its index only when an expression reads it", () => {
    const items = { type: "string[]", value: [] };
    expect(
      printed({ items }, (b) =>
        b.el(
          "ul",
          [],
          b.for("items", "item", "index", "item", () =>
            b.el("li", [b.attr("id", "x")], b.i("index")),
          ),
        ),
      ),
    ).toEqual({
      // `vue/attributes-order`: `v-for`, then `id`, then `:key`.
      vue: lines(
        "<ul>",
        '  <li v-for="(item, index) in c0Items" id="x" :key="item">{{ index }}</li>',
        "</ul>",
      ),
      svelte: lines(
        "<ul>",
        "  {#each c0Items as item, index (item)}",
        '    <li id="x">{index}</li>',
        "  {/each}",
        "</ul>",
      ),
      angular: lines(
        "<ul>",
        "  @for (item of c0Items(); track item; let index = $index) {",
        '    <li id="x">{{ index }}</li>',
        "  }",
        "</ul>",
      ),
      astro: lines(
        "<ul>",
        "  {c0Items.map((item, index) => (",
        '    <li id="x">{index}</li>',
        "  ))}",
        "</ul>",
      ),
    });
    const unread = printed({ items }, (b) =>
      b.el(
        "ul",
        [],
        b.for("items", "item", "index", "item", () => b.el("li", [], b.i("item"))),
      ),
    );
    expect(unread.vue).toContain('v-for="item in c0Items"');
    expect(unread.svelte).toContain("{#each c0Items as item (item)}");
    expect(unread.angular).toContain("@for (item of c0Items(); track item) {");
    expect(unread.astro).toContain("{c0Items.map((item) => (");
  });

  it("keeps blocks off the whitespace Svelte keeps between siblings", () => {
    expect(
      printed({ a: on }, (b) =>
        b.el("div", [], b.el("p", [], "x"), b.if(["a", b.el("p", [], "a")]), b.el("p", [], "y")),
      ),
    ).toEqual({
      vue: lines("<div>", "  <p>x</p>", '  <p v-if="c0A">a</p>', "  <p>y</p>", "</div>"),
      svelte: lines(
        "<div>",
        "  <p>x</p",
        "  >{#if c0A}",
        "    <p>a</p>",
        "  {/if}<p>y</p>",
        "</div>",
      ),
      angular: lines(
        "<div>",
        "  <p>x</p>",
        "  @if (c0A()) {",
        "    <p>a</p>",
        "  }",
        "  <p>y</p>",
        "</div>",
      ),
      astro: lines(
        "<div>",
        "  <p>x</p>",
        "  {c0A ? (",
        "    <p>a</p>",
        "  ) : null}",
        "  <p>y</p>",
        "</div>",
      ),
    });
  });

  it("keeps control flow in a <pre> on the text's lines", () => {
    expect(
      printed({ a: on }, (b) =>
        b.el("pre", [], "a\n", b.if(["a", b.el("b", [], "x")], [undefined, b.el("i", [], "y")])),
      ),
    ).toEqual({
      vue: '<pre>a\n<b v-if="c0A">x</b><i v-else>y</i></pre>',
      svelte: "<pre>a\n{#if c0A}<b>x</b>{:else}<i>y</i>{/if}</pre>",
      angular: "<pre>a\n@if (c0A()) {<b>x</b>} @else {<i>y</i>}</pre>",
      astro: "<pre>a\n{c0A ? <b>x</b> : <i>y</i>}</pre>",
    });
  });
});

describe("bindings", () => {
  it("writes bound attributes, class, style and a spread's keys", () => {
    const attrs = { type: '{ id?: string; class?: string; "data-x"?: string }' };
    expect(
      printed({ t: { type: "string", value: "t" }, on, attrs }, (b) =>
        b.el("input", [
          b.attr("type", "text"),
          b.bind("title", 't + "!"'),
          b.bind("disabled", "on"),
          b.cls("a", { code: "t" }, ["on", "on"]),
          b.style(["color", "red"], ["margin-top", { code: "t" }]),
          b.spread("attrs", "id", "class", "data-x"),
        ]),
      ),
    ).toEqual({
      // The spread's `class` joins the element's; its object may be absent, so `?.`.
      vue: lines(
        "<input",
        '  :id="c0Attrs?.id"',
        '  type="text"',
        `  :title="c0T + '!'"`,
        '  :disabled="c0On"',
        '  class="a"',
        '  :class="[c0T, { on: c0On }, c0Attrs?.class]"',
        '  style="color: red"',
        '  :style="{ marginTop: c0T }"',
        `  :data-x="c0Attrs?.['data-x']"`,
        "/>",
      ),
      svelte: lines(
        "<input",
        '  type="text"',
        '  title={c0T + "!"}',
        "  disabled={c0On}",
        '  class={["a", c0T, { on: c0On }, c0Attrs?.class]}',
        '  style:color="red"',
        "  style:margin-top={c0T}",
        "  id={c0Attrs?.id}",
        '  data-x={c0Attrs?.["data-x"]}',
        "/>",
      ),
      angular: lines(
        "<input",
        '  type="text"',
        `  [attr.title]="c0T() + '!'"`,
        `  [attr.disabled]="c0On() ? '' : null"`,
        '  class="a"',
        `  [class]="[c0T(), c0On() ? 'on' : null, c0Attrs()?.class].join(' ')"`,
        '  style="color: red"',
        '  [style.margin-top]="c0T()"',
        '  [attr.id]="c0Attrs()?.id"',
        `  [attr.data-x]="c0Attrs()?.['data-x']"`,
        "/>",
      ),
      astro: lines(
        "<input",
        '  type="text"',
        '  title={c0T + "!"}',
        "  disabled={c0On}",
        '  class:list={["a", c0T, { on: c0On }, c0Attrs?.class]}',
        '  style={{ color: "red", marginTop: c0T }}',
        "  id={c0Attrs?.id}",
        '  data-x={c0Attrs?.["data-x"]}',
        "/>",
      ),
    });
    const passed = printed({ attrs: { type: "{ id: string }", value: { id: "i" } } }, (b) =>
      b.el("p", [b.spread("attrs", "id")], "x"),
    );
    expect(passed.angular).toBe('<p [attr.id]="c0Attrs().id">x</p>');
  });

  it("writes class toggles as an object, quoting names that are not identifiers", () => {
    expect(printed({ on }, (b) => b.el("p", [b.cls(["on", "on"], ["w-1.5", "!on"])], "x"))).toEqual(
      {
        vue: `<p :class="{ on: c0On, 'w-1.5': !c0On }">x</p>`,
        svelte: '<p class={[{ on: c0On, "w-1.5": !c0On }]}>x</p>',
        angular: `<p [class]="{ on: c0On(), 'w-1.5': !c0On() }">x</p>`,
        astro: '<p class:list={[{ on: c0On, "w-1.5": !c0On }]}>x</p>',
      },
    );
  });

  it("writes a bound boolean so that false is no attribute", () => {
    // Angular binds every attribute with `[attr.x]`; Astro's renderer does not know `multiple`.
    expect(
      printed({ on }, (b) =>
        b.el(
          "select",
          [b.bind("multiple", "on"), b.bind("disabled", "on || !on"), b.bind("aria-hidden", "on")],
          b.el("option", [], "a"),
        ),
      ),
    ).toEqual({
      vue: lines(
        '<select :multiple="c0On" :disabled="c0On || !c0On" :aria-hidden="c0On">',
        "  <option>a</option>",
        "</select>",
      ),
      svelte: lines(
        "<select multiple={c0On} disabled={c0On || !c0On} aria-hidden={c0On}>",
        "  <option>a</option>",
        "</select>",
      ),
      angular: lines(
        "<select",
        `  [attr.multiple]="c0On() ? '' : null"`,
        `  [attr.disabled]="c0On() || !c0On() ? '' : null"`,
        '  [attr.aria-hidden]="c0On()"',
        ">",
        "  <option>a</option>",
        "</select>",
      ),
      astro: lines(
        '<select multiple={c0On ? "" : undefined} disabled={c0On || !c0On} aria-hidden={c0On}>',
        "  <option>a</option>",
        "</select>",
      ),
    });
  });

  it("writes a style of static declarations as a static attribute", () => {
    const style = printed({}, (b) => b.el("p", [b.style(["color", "red"], ["--gap", "1px"])], "x"));
    for (const dialect of Object.values(style))
      expect(dialect).toBe('<p style="color: red; --gap: 1px">x</p>');
  });
});

describe("expressions", () => {
  it("escapes code for what each template scanner reads inside it", () => {
    expect(
      printed({ s: { type: "string", value: "s" } }, (b) =>
        b.el(
          "p",
          [b.bind("title", `s + "&amp;\\"" + 'q'`)],
          b.i(`"}}" + s /* c */`),
          b.i("`${s}-${1_000}`"),
          b.i(`/a}}b/.test(s)`),
          b.i("0x10"),
        ),
      ),
    ).toEqual({
      // Vue ends `{{` at any `}}` and decodes references, in interpolations and attributes.
      vue: lines(
        "<p",
        `  :title="c0S + '&amp;amp;&quot;' + 'q'"`,
        '>{{ "\\u007d\\u007d" + c0S /* c */ }}{{ `${c0S}-${1_000}` }}{{ /a}\\}b/.test(c0S) }}{{ 0x10 }}</p>',
      ),
      // `{/` closes a Svelte block.
      svelte: lines(
        "<p",
        '  title={c0S + "&amp;\\"" + \'q\'}',
        '>{"}}" + c0S /* c */}{`${c0S}-${1_000}`}{(/a}}b/.test(c0S))}{0x10}</p>',
      ),
      // Angular's lexer: literals from their values, no comments, no template literals.
      angular: lines(
        "<p",
        `  [attr.title]="c0S() + '\\u0026amp;&quot;' + 'q'"`,
        '>{{ "\\u007d\\u007d" + c0S() }}{{ c0S() + "-" + 1_000 }}{{ /a}\\}b/.test(c0S()) }}{{ 16 }}</p>',
      ),
      astro:
        '<p title={c0S + "&amp;\\"" + \'q\'}>{"}}" + c0S /* c */}{`${c0S}-${1_000}`}{/a}}b/.test(c0S)}{0x10}</p>',
    });
  });

  it("keeps a `{` before an interpolation from opening it", () => {
    expect(
      printed({ s: { type: "string", value: "s" } }, (b) => b.el("p", [], "a{", b.i("s"), "}")),
    ).toEqual({
      vue: "<p>a&#123;{{ c0S }}}</p>",
      svelte: "<p>a&#123;{c0S}&#125;</p>",
      angular: '<p>a{{ "\\u007b" }}{{ c0S() }}&#125;</p>',
      astro: "<p>a&#123;{c0S}&#125;</p>",
    });
  });

  it("composes conditions with the parentheses they need", () => {
    expect(negate("a")).toBe("!a");
    expect(negate("a.b()")).toBe("!a.b()");
    expect(negate("!a")).toBe("!!a");
    expect(negate("a && b")).toBe("!(a && b)");
    expect(negate("(a || b)")).toBe("!(a || b)");
    expect(conjoin(["!a", "b || c", "d ?? e", "f ? g : h", "i && j", "(k || l)"])).toBe(
      "!a && (b || c) && (d ?? e) && (f ? g : h) && i && j && (k || l)",
    );
    expect(member("attrs", "id", false)).toBe("attrs.id");
    expect(member("a ?? b", "data-x", true)).toBe('(a ?? b)?.["data-x"]');
  });

  it("prints expressions as written without rewrite rules, and needs the component for them", () => {
    const cases = suite(
      [
        {
          name: "",
          props: { s: { type: "string", value: "s" } },
          render: (b) => b.el("p", [], b.i("s")),
          expected: "",
        },
      ],
      "self",
    );
    expect(printMarkup(cases.component.render, vueDialect)).toBe("<p>{{ s }}</p>");
    expect(() =>
      printMarkup(cases.component.render, vueDialect, { rewrite: cases.rules(false) }),
    ).toThrow("needs the `component`");
    expect(() => printMarkup(cases.component.render, htmlDialect)).toThrow("no expressions");
  });
});

describe("roots and SVG", () => {
  it("protects text and interpolations at the root's edges from the target's own line breaks", () => {
    expect(
      printed({ s: { type: "string", value: "s" } }, (b) =>
        b.fragment("a ", b.el("b", [], "b"), b.i("s")),
      ),
    ).toEqual({
      vue: '{{ "a " }}<b>b</b>{{ c0S }}',
      svelte: "a <b>b</b>{c0S}",
      angular: "<ng-container>a </ng-container><b>b</b><ng-container>{{ c0S() }}</ng-container>",
      astro: "a <b>b</b>{c0S}",
    });
    expect(printed({}, (b) => b.fragment(b.el("p", [], "a"), b.el("p", [], "b")))).toEqual({
      vue: lines("<p>a</p>", "<p>b</p>"),
      svelte: lines("<p>a</p", "><p>b</p>"),
      angular: lines("<p>a</p>", "<p>b</p>"),
      astro: lines("<p>a</p>", "<p>b</p>"),
    });
  });

  it("closes childless SVG elements themselves", () => {
    const svg = printed({ r: { type: "number", value: 1 } }, (b) =>
      b.el(
        "svg",
        [b.attr("viewBox", "0 0 1 1")],
        b.el("circle", [b.bind("r", "r")]),
        b.el("g", [], b.el("title", [], "T")),
      ),
    );
    expect(svg.vue).toBe(
      lines(
        '<svg viewBox="0 0 1 1">',
        '  <circle :r="c0R" />',
        "  <g>",
        "    <title>T</title>",
        "  </g>",
        "</svg>",
      ),
    );
    expect(svg.svelte).toBe(
      lines('<svg viewBox="0 0 1 1">', "  <circle r={c0R} /><g><title>T</title></g>", "</svg>"),
    );
    expect(svg.angular).toContain('<circle [attr.r]="c0R()" />');
    expect(svg.astro).toContain("<circle r={c0R} />");
    expect(printMarkup(el("svg", [el("path", [], [["d", "M0 0"]])]), htmlDialect)).toBe(
      '<svg><path d="M0 0" /></svg>',
    );
  });

  it("prints only static content in Angular's literal region", () => {
    const cases = suite(
      [
        {
          name: "",
          props: { s: { type: "string", value: "s" } },
          render: (b) => b.el("p", [b.attr("title", "{{")], b.i("s")),
          expected: "",
        },
      ],
      "self",
    );
    expect(() =>
      printMarkup(cases.component.render, angularDialect, {
        component: cases.component,
        rewrite: cases.rules(true),
      }),
    ).toThrow("binds nothing");
  });
});
