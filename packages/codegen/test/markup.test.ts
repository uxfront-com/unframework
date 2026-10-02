// How each dialect writes markup: layout and escaping snapshots, so a change to the printed
// form is reviewed. Whether a framework renders that form as the IR describes is not decided
// here but by each target package's render-parity test, which runs the framework's own
// compiler and server renderer over the same tricky text (codegen/test/render-parity.ts).
import { createElement, createStaticAttribute, createText } from "@unframework/ir";
import type { ElementNode, RenderNode } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import {
  angularDialect,
  astroDialect,
  htmlDialect,
  printMarkup,
  svelteDialect,
  vueDialect,
} from "../src/index.ts";

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
        attribute: (attribute) => `:${attribute.name}="'${String(attribute.value)}'"`,
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
