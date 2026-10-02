// The render-parity kit: IR that is hard to print, a seeded fuzz, the DOM an IR tree describes,
// and a strict parser for server-rendered HTML. Every target package's render-parity tests import
// it by relative path (it is test code, not codegen's API): the target's output, formatted or not,
// goes through the framework's own compiler and renderer, on the server and in the browser, and
// the DOM that comes out must be exactly the DOM the IR describes under JSX semantics. String
// tests of the printers cannot show that; only the frameworks can.
//
// This module runs anywhere (Node and the browser). Emitting the cases, the attribute sweep and
// the Vite plugin that serves them to the browser are in ./render-parity-node.ts; reading a live
// DOM is in ./render-parity-client.ts.
import {
  createElement,
  createStaticAttribute,
  createText,
  FIXED_VALUE_INPUT_TYPES,
  isBooleanAttribute,
  isVoidElement,
} from "@unframework/ir";
import type { ElementNode, RenderNode } from "@unframework/ir";

/** A DOM node as a comparable value: a text node is its data. */
export type DomNode = string | DomElement;

/** An element: its tag, its attributes by lower-case name, and its children. */
export interface DomElement {
  tag: string;
  attributes: Record<string, string>;
  children: DomNode[];
  /**
   * A live form control's state (`value`, `checked`, `selected`), which renderers may set as
   * DOM properties rather than attributes. Only a live DOM has it (./render-parity-client.ts).
   */
  state?: Record<string, string>;
}

/**
 * One IR tree to render, named for the failure message. A target renders it exactly unless its
 * capability matrix marks a capability the tree uses unsupported (`unsupportedCapabilities`).
 */
export interface ParityCase {
  name: string;
  render: ElementNode;
}

/** A titled list of cases, as every target's render-parity tests run them. */
export type ParitySuite = readonly [title: string, cases: readonly ParityCase[]];

const at = { start: 0, end: 0 };

/** An element with its attributes in order and its text children as strings. */
export function el(
  tag: string,
  attributes: Record<string, string | true> = {},
  ...children: (RenderNode | string)[]
): ElementNode {
  return createElement(
    tag,
    Object.entries(attributes).map(([name, value]) => createStaticAttribute(name, value, at)),
    children.map((child) => (typeof child === "string" ? createText(child, at) : child)),
    at,
  );
}

const LONG_LINKS = el(
  "p",
  {},
  "Tags: ",
  el("a", { href: "/tags/typescript" }, "typescript"),
  " ",
  el("a", { href: "/tags/compilers" }, "compilers"),
  " ",
  el("a", { href: "/tags/frameworks" }, "frameworks"),
  " ",
  el("a", { href: "/tags/testing" }, "testing"),
);

/** A link with enough attributes that its tag alone is longer than a line. */
const longLink = (href: string, label: string) =>
  el(
    "a",
    {
      class: "article-link article-link--external",
      href,
      target: "_blank",
      rel: "noopener noreferrer",
      title: `Read ${label} in a new tab`,
    },
    label,
  );

/**
 * Invisible characters: TypeScript and oxc trim U+200B as whitespace where a line meets a line
 * break, Angular's whitespace removal treats U+180E as a space, and the others look the same.
 */
const ZERO_WIDTH = ["\u200b", "\u200c", "\u200d", "\u2060", "\u00ad", "\u180e"];

/**
 * Text and attributes that each template language, JSX transform or formatter rewrites unless
 * the printer guards them: whitespace runs, edges and whitespace-only text, Unicode spaces,
 * zero-width characters and line separators, entity look-alikes, delimiters, carriage returns,
 * lines long enough for a formatter to wrap, and the attributes renderers set as properties.
 */
export const TRICKY_CASES: readonly ParityCase[] = [
  { name: "runs of spaces", render: el("p", {}, "a  b   c") },
  { name: "tabs and line breaks", render: el("p", {}, "a\tb\nc\n\nd\fe\vf") },
  { name: "edge spaces in text", render: el("p", {}, " lead and trail ") },
  {
    name: "edge spaces beside elements",
    render: el("p", {}, " lead ", el("b", {}, "x"), " trail "),
  },
  {
    name: "whitespace-only text between inline elements",
    render: el(
      "div",
      {},
      el("p", {}, el("b", {}, "a"), " ", el("i", {}, "b")),
      el("p", {}, el("b", {}, "a"), "   ", el("i", {}, "b")),
      el("p", {}, el("b", {}, "a"), "\t", el("i", {}, "b")),
      el("p", {}, el("b", {}, "a"), "\n", el("i", {}, "b")),
    ),
  },
  {
    name: "whitespace-only text at the edges of inline elements",
    render: el(
      "p",
      {},
      "a",
      el("span", {}, " ", el("b", {}, "x")),
      el("span", {}, el("b", {}, "y"), " "),
      "b",
      el("i", {}, " "),
      "c",
      el("em", {}, "  "),
      el("label", {}, " ", el("input", { type: "checkbox" })),
    ),
  },
  {
    name: "whitespace-only text at the edges of block elements",
    render: el(
      "div",
      {},
      el("section", {}, " ", el("div", {}, "x")),
      el("section", {}, el("div", {}, "y"), "  "),
      el("section", {}, "\t"),
    ),
  },
  {
    name: "block siblings with and without whitespace between them",
    render: el(
      "div",
      {},
      el("ul", {}, el("li", {}, "one"), el("li", {}, "two"), el("li", {}, "three")),
      el("div", {}, el("span", {}, "a"), el("div", {}, "b"), el("span", {}, "c")),
      el("div", {}, el("p", {}, "a"), " ", el("p", {}, "b")),
      el("header", {}, el("h2", {}, "Title"), el("hr"), el("label", {}, "Note"), el("input")),
    ),
  },
  {
    name: "Unicode spaces in text",
    render: el(
      "p",
      {},
      "10\u2009km, a\u3000\u3000b, x\u00a0y, \u2003\u2003indent, \u00a0lead, nbsp\u00a0\u00a0run",
    ),
  },
  {
    name: "every Unicode space alone between elements",
    render: el(
      "p",
      {},
      ...["\u00a0", "\u1680", "\u2000", "\u2009", "\u200a", "\u202f", "\u205f", "\u3000", "\ufeff"]
        .concat(ZERO_WIDTH)
        .flatMap((space, index) => [el("b", {}, String(index)), space])
        .concat(el("b", {}, "end")),
    ),
  },
  {
    name: "zero-width characters at word edges",
    render: el("p", {}, ZERO_WIDTH.map((char) => `${char}a${char} b${char}`).join(" ")),
  },
  {
    // A breadcrumb that separates its parts with zero-width spaces, long enough that a
    // formatter puts one at the end of a line.
    name: "a breadcrumb separated by zero-width spaces",
    render: el(
      "nav",
      { "aria-label": "Breadcrumb" },
      el("a", { href: "/" }, "Home"),
      "\u200b",
      el("span", { "aria-hidden": "true" }, "/"),
      "\u200b",
      el("a", { href: "/docs" }, "Documentation"),
      "\u200b",
      el("span", { "aria-hidden": "true" }, "/"),
      "\u200b",
      el("a", { href: "/docs/getting-started" }, "Getting started"),
      "\u200b",
    ),
  },
  {
    name: "line and paragraph separators",
    render: el("p", {}, "a\u2028b\u2029c ", el("b", {}, "\u2028"), " d\u2028\u2028e"),
  },
  {
    name: "markup and entity look-alikes",
    render: el("p", {}, "a & b < c > d &amp; &lt;p&gt; &nbsp; &#123; </p> <!-- x --> <b>"),
  },
  {
    name: "template delimiters",
    render: el("p", {}, "{braces} {{ mustache }} }} {{{triple}}} {#if x} {@html y} @if (z) {"),
  },
  {
    name: "delimiters and entities beside whitespace runs",
    render: el(
      "div",
      {},
      el("p", {}, "a  &amp; b&lt;c"),
      el("p", {}, "a  </p> c"),
      el("p", {}, "x  <!-- y"),
      el("p", {}, "{{  a  }}  }}"),
      el("p", {}, "@if  (x)  {\t}"),
    ),
  },
  { name: "quotes and escapes", render: el("p", {}, "\"double\" 'single' `${tpl}` \\back\\") },
  { name: "a long line of inline elements", render: LONG_LINKS },
  {
    // Tags with one attribute each, between spaces: only breaks inside the tags shorten it.
    name: "a paragraph of links with one attribute each",
    render: el(
      "p",
      {},
      ...["setup", "components", "styling", "testing", "deployment", "migration"].flatMap(
        (topic, index) => [
          ...(index ? [" "] : []),
          el("a", { href: `/docs/guides/${topic}/introduction` }, topic),
        ],
      ),
    ),
  },
  {
    name: "a paragraph of links whose tags are longer than a line",
    render: el(
      "article",
      {},
      el("h2", {}, "Further reading"),
      el(
        "p",
        {},
        "See ",
        longLink("https://example.com/articles/compilers", "the compilers article"),
        " and ",
        longLink("https://example.com/articles/frameworks", "the frameworks article"),
        ".",
      ),
      el(
        "nav",
        {},
        ...["typescript", "compilers", "frameworks", "testing", "parity"].map((tag) =>
          el("a", { class: "tag-link tag-link--small", href: `/tags/${tag}`, rel: "tag" }, tag),
        ),
      ),
    ),
  },
  {
    name: "a long label in an element",
    render: el(
      "div",
      {},
      el("button", { type: "button" }, "click me please now ".repeat(6).trimEnd()),
    ),
  },
  // `class` and `style` are left out on purpose: Vue, Svelte and Angular rewrite their static
  // values (`"  b   a "` renders `"b a"`, and each normalises `style` differently), which no
  // printing can prevent. M1 owns their forms; until then the analyzer should canonicalise both
  // (class tokens joined by one space, style declarations in one format) so every target writes
  // the same string.
  {
    name: "attribute values",
    render: el(
      "div",
      {},
      el("p", { title: "{{ 1 + 1 }}" }, "interpolation"),
      el("p", { title: "{x} {{y}} }}", "data-x": "@if (a) {}" }, "braces"),
      el("p", { title: "a\nb\tc  d", "data-x": "  edges  " }, "whitespace"),
      el("p", { title: "a\u2028b\u2029c\u2009d\u00a0e\u3000f\u200bg" }, "Unicode"),
      el("p", { title: "say \"hi\" & 'bye' <b>", "data-x": "&amp; &lt;" }, "markup"),
      el("p", { "aria-label": "`${x}` \\y", "data-empty": "" }, "escapes"),
    ),
  },
  {
    // Angular reads `{{` in any attribute value as an interpolation, written as references or
    // not, and a binding goes through its security checks: a URL its sanitizer rejects
    // (`a{{b:c` looks like a scheme) gets an `unsafe:` prefix, a resource URL (`iframe src`,
    // `object data`) fails, and a bound `sandbox` removes the iframe.
    name: "template delimiters in attributes Angular checks",
    render: el(
      "div",
      {},
      el("a", { href: "a{{b:c" }, "unsafe-looking"),
      el("a", { href: "/search?q={{ term }}" }, "interpolation"),
      el("img", { src: "data:,{{x}}", alt: "{{ alt }}" }),
      el("iframe", { src: "about:blank#{{x}}", title: "{{ frame }}", sandbox: "{{ y }}" }),
      el("object", { data: "about:blank#{{x}}", title: "object" }),
    ),
  },
  {
    name: "boolean attributes and attributes without a value",
    render: el(
      "div",
      {},
      el("input", { disabled: true, readonly: "readonly", required: "" }),
      el("details", { open: true }, el("summary", {}, "More")),
      el("p", { hidden: true, "data-on": true, "aria-hidden": "true" }, "x"),
    ),
  },
  {
    // The input types whose `value` is a label or a submitted value, which every renderer must
    // write as the attribute (React's client ignores a `defaultValue` on submit and reset).
    name: "inputs with a fixed value",
    render: el(
      "form",
      {},
      el("input", { type: "submit", value: "Send" }),
      el("input", { type: "reset", value: "Clear" }),
      el("input", { type: "button", value: "Go" }),
      el("input", { type: "hidden", name: "token", value: "a  b" }),
      el("input", { type: "checkbox", name: "c", value: "yes" }),
      el("input", { type: "radio", name: "r", value: "one" }),
      el("input", { type: "image", alt: "Send", src: "data:,", value: "image" }),
    ),
  },
  {
    name: "lists, tables and selects",
    render: el(
      "div",
      {},
      el("ol", { start: "3", reversed: true }, el("li", {}, "three"), el("li", {}, "two")),
      el(
        "table",
        {},
        el("caption", {}, "Totals"),
        el(
          "tbody",
          {},
          el("tr", {}, el("th", { scope: "row" }, "a"), el("td", { colspan: "2" }, "1  2")),
          el("tr", {}, el("th", { scope: "row" }, "b"), el("td", { rowspan: "1" }, " 3 ")),
        ),
      ),
      el(
        "select",
        { name: "s" },
        el("option", { value: "a" }, "First"),
        el("optgroup", { label: "More" }, el("option", { value: "b" }, " Second  option ")),
      ),
    ),
  },
  {
    // A list box (`size` above 1, no `multiple`) starts with no option selected, where a
    // drop-down selects its first. Vue's client inserts the options before it sets `size`, so
    // Vue's matrix marks `listbox` unsupported. Each list box is a case of its own, small enough
    // that Vue renders it alone through `patchProp`, not as a stringified template.
    name: "a single-selection list box",
    render: el(
      "select",
      { name: "listbox", size: "2" },
      el("option", { value: "a" }, "First"),
      el("option", { value: "b" }, "Second"),
    ),
  },
  {
    name: "a single-selection list box of option groups",
    render: el(
      "select",
      { name: "grouped", size: "3" },
      el("optgroup", { label: "Group" }, el("option", {}, "First"), el("option", {}, "Second")),
    ),
  },
  {
    // What a drop-down would not select either: no target selects an option here, so these
    // use no `listbox`, and Vue renders them too.
    name: "list boxes with no option a drop-down would select",
    render: el(
      "div",
      {},
      el(
        "select",
        { name: "many", size: "2", multiple: true },
        el("option", {}, "a"),
        el("option", {}, "b"),
      ),
      el(
        "select",
        { name: "off", size: "2" },
        el("option", { disabled: true }, "a"),
        el("optgroup", { label: "G", disabled: true }, el("option", {}, "b")),
      ),
    ),
  },
  {
    name: "whitespace-preserving elements",
    render: el(
      "div",
      {},
      el("pre", {}, "  a  b\n\tc  "),
      el("pre", {}, el("b", {}, "a"), "\n  ", el("i", {}, "b"), "  "),
      el("pre", {}, "{{ x }} {y} @if & <z>"),
      el("pre", {}, "x\n", el("span", {}, "  y\n"), el("br"), "\u200b z"),
      el("textarea", {}, "  a  {{ b }} {c} @if &amp; <d>\n\t"),
    ),
  },
  {
    name: "nested inline and block elements",
    render: el(
      "div",
      {},
      el("div", {}, "a", el("span", {}, " ", el("b", {}, "x"))),
      el("section", {}, el("section"), "  "),
      el("article", {}, el("p", {}, "x"), el("span", {}, "y"), " z"),
    ),
  },
];

/**
 * Carriage returns, kept apart from the other cases because not every framework can render
 * them: HTML turns a raw one into a line feed, and Svelte's compiler folds static text and
 * attributes into JavaScript template literals, which do the same. JSX can only write one as
 * `&#13;`.
 */
export const CARRIAGE_RETURN_CASES: readonly ParityCase[] = [
  { name: "carriage returns in text", render: el("p", {}, "a\rb\r\nc") },
  { name: "carriage returns in preformatted text", render: el("pre", {}, "a\rb\r\nc") },
  {
    name: "carriage returns in attribute values",
    render: el("p", { title: "a\rb", "data-x": "c\r\nd" }, "x"),
  },
];

/** A small deterministic PRNG (mulberry32), so a seed always gives the same trees (P8). */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The pieces random text is made of: the characters and sequences printers must guard. */
const TEXT_PIECES = [
  "a",
  "b",
  "word",
  " ",
  " ",
  "  ",
  "\t",
  "\n",
  "&",
  "&amp;",
  "<",
  "</p>",
  ">",
  "{",
  "}",
  "{{",
  "}}",
  "@",
  '"',
  "'",
  "`",
  "${",
  "\\",
  "\u00a0",
  "\u2009",
  "\u3000",
  "\u2028",
  "\u200b",
];

/** Elements that hold flow content: blocks, phrasing and text. */
const FLOW = ["div", "section"];
/** Block-level children of flow content, besides the containers with a fixed content model. */
const BLOCKS = ["div", "section", "p", "pre", "ul", "ol", "table", "hr"];
/** Phrasing elements that hold phrasing content. */
const INLINES = ["span", "b", "i", "em", "a", "label", "button"];
/** Phrasing elements with no children or text only. */
const LEAVES = ["br", "wbr", "img", "input", "select", "textarea"];
/**
 * Interactive content, which HTML does not nest: an `<a>` or `<button>` inside another, or a
 * control inside a link, is moved or ignored by the parser and rejected by the analyzer.
 */
const INTERACTIVE = new Set(["a", "label", "button", "input", "select", "textarea"]);
/** Inputs whose `value` is a label or a submitted value, which the analyzer accepts. */
const FIXED_VALUE_TYPES = [...FIXED_VALUE_INPUT_TYPES];

/**
 * Children without a line feed at the start, for `<pre>` and `<textarea>`. HTML's parser drops
 * that line feed, so a server-rendered one is lost unless the serialiser doubles it, which only
 * React's does; in the browser, Solid and Svelte lose it too (they clone parsed templates), and
 * so does Vue (its template compiler drops it as HTML does). The analyzer cannot produce one in
 * M0 (JSX trims a raw one, and `&#10;` is UF3009); M1's expressions can (`{"\nx"}`), and must
 * report it until every target renders it.
 */
function withoutLeadingLineFeed(children: RenderNode[]): RenderNode[] {
  const [first, ...rest] = children;
  if (first?.kind !== "Text" || !first.value.startsWith("\n")) return children;
  const value = first.value.replace(/^\n+/, "");
  return value ? [createText(value, at), ...rest] : rest;
}

/** Where a random element sits: what it may contain is decided by these. */
interface Context {
  depth: number;
  /** Inside an interactive element, which may hold no other interactive element. */
  interactive: boolean;
}

/**
 * A random tree with random text and attribute values: blocks and inline elements, lists,
 * tables and selects, preformatted text with elements in it, void elements, boolean attributes
 * and tags with enough attributes to be longer than a line. It keeps to nesting the HTML parser
 * leaves alone (no block inside a paragraph or an inline element, nothing interactive inside an
 * interactive element, table parts and options only where they belong) and never puts two text
 * nodes side by side, as the IR never does.
 */
export function fuzzCase(seed: number): ParityCase {
  const next = random(seed);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!;
  const chance = (probability: number) => next() < probability;
  const text = () =>
    Array.from({ length: 1 + Math.floor(next() * 4) }, () => pick(TEXT_PIECES)).join("");
  let ids = 0;

  /** Global attributes, a few at a time, or many long ones so the tag outgrows its line. */
  function globals(): Record<string, string | true> {
    const long = chance(0.1);
    const attributes: Record<string, string | true> = {};
    const add = (probability: number, name: string, value: () => string | true) => {
      if (chance(long ? 0.7 : probability)) attributes[name] = value();
    };
    const longText = () => (long ? `${text()} and some words to make it long ${text()}` : text());
    add(0.3, "title", longText);
    add(0.15, "data-x", longText);
    add(0.08, "id", () => `id-${++ids}`);
    add(0.08, "class", () => pick(["a", "a b", "card card--wide"]));
    add(0.05, "lang", () => pick(["en", "fr-CA"]));
    add(0.05, "dir", () => pick(["ltr", "rtl"]));
    add(0.06, "hidden", () => true);
    add(0.06, "aria-label", longText);
    add(0.04, "tabindex", () => pick(["0", "-1"]));
    add(0.03, "translate", () => "no");
    add(0.03, "spellcheck", () => "false");
    return attributes;
  }

  /** The attributes only some elements have, with values that element accepts. */
  function own(tag: string): Record<string, string | true> {
    switch (tag) {
      case "a":
        return chance(0.7)
          ? {
              href: pick(["/a", "/b?x=1&y=2", "#top"]),
              ...(chance(0.3) ? { target: "_blank", rel: "noopener" } : {}),
            }
          : {};
      case "img":
        return {
          src: "data:,",
          alt: text(),
          ...(chance(0.3) ? { width: "16", height: "16" } : {}),
        };
      case "input": {
        const type = pick([...FIXED_VALUE_TYPES, "text", "email", "number"]);
        const fixed = FIXED_VALUE_TYPES.includes(type);
        return {
          type,
          ...(chance(0.4) ? { name: "field" } : {}),
          ...(fixed && chance(0.6) ? { value: text() } : {}),
          ...(!fixed && chance(0.4) ? { placeholder: text() } : {}),
          ...(type === "image" ? { alt: "Send", src: "data:," } : {}),
          ...(chance(0.2) ? { disabled: true } : {}),
          ...(!fixed && chance(0.2) ? { readonly: true, required: true } : {}),
        };
      }
      case "button":
        return {
          type: pick(["button", "submit", "reset"]),
          ...(chance(0.3) ? { name: "action", value: text() } : {}),
          ...(chance(0.2) ? { disabled: true } : {}),
        };
      case "label":
        return chance(0.4) ? { for: `id-${ids + 1}` } : {};
      case "ol":
        return {
          ...(chance(0.4) ? { start: "3" } : {}),
          ...(chance(0.3) ? { reversed: true } : {}),
        };
      case "td":
      case "th":
        return {
          ...(chance(0.3) ? { colspan: "2" } : {}),
          ...(chance(0.2) ? { rowspan: "1" } : {}),
        };
      case "select": {
        const multiple = chance(0.2);
        // `size` only beside `multiple`: Vue's matrix marks a single-selection list box
        // unsupported (its client selects the first option), which would leave the tree out
        // there. The tricky cases cover list boxes on every target, each alone.
        const size = chance(0.2) && multiple;
        return {
          name: "choice",
          ...(multiple ? { multiple: true } : {}),
          ...(size ? { size: "2" } : {}),
          ...(chance(0.2) ? { disabled: true } : {}),
        };
      }
      case "option":
        return {
          ...(chance(0.6) ? { value: text() } : {}),
          ...(chance(0.2) ? { disabled: true } : {}),
        };
      case "optgroup":
        return { label: text() };
      case "textarea":
        return {
          name: "note",
          ...(chance(0.3) ? { rows: "2", cols: "20" } : {}),
          ...(chance(0.3) ? { placeholder: text() } : {}),
          ...(chance(0.2) ? { readonly: true } : {}),
        };
      default:
        return {};
    }
  }

  function element(tag: string, context: Context): ElementNode {
    const attributes = { ...globals(), ...own(tag) };
    return el(tag, attributes, ...content(tag, context));
  }

  /** Text and elements in a random order, never two texts in a row. */
  function mixed(allowed: readonly string[], context: Context, max: number): RenderNode[] {
    const children: RenderNode[] = [];
    const count = Math.floor(next() * (context.depth >= 3 ? 2 : max + 1));
    const candidates = allowed.filter((tag) => !(context.interactive && INTERACTIVE.has(tag)));
    for (let index = 0; index < count; index++) {
      if (children.at(-1)?.kind !== "Text" && chance(0.45)) {
        children.push(createText(text(), at));
        continue;
      }
      const tag = pick(candidates);
      children.push(
        element(tag, {
          depth: context.depth + 1,
          interactive: context.interactive || INTERACTIVE.has(tag),
        }),
      );
    }
    return children;
  }

  /** Between `min` and `max` elements made by `child`. */
  const repeat = (min: number, max: number, child: () => ElementNode) =>
    Array.from({ length: min + Math.floor(next() * (max - min + 1)) }, child);

  function content(tag: string, context: Context): RenderNode[] {
    const deeper = { ...context, depth: context.depth + 1 };
    switch (tag) {
      case "div":
      case "section":
      case "li":
      case "td":
      case "th":
        return mixed(
          context.depth >= 3 ? [...INLINES, ...LEAVES] : [...BLOCKS, ...INLINES, ...LEAVES],
          context,
          4,
        );
      case "p":
      case "span":
      case "b":
      case "i":
      case "em":
      case "a":
      case "label":
      case "caption":
        return mixed([...INLINES, ...LEAVES], context, 4);
      case "button":
        return mixed(["span", "b", "i", "em"], context, 2);
      case "pre":
        // Preformatted text keeps every space and line break, with phrasing among it.
        return withoutLeadingLineFeed(mixed(["b", "i", "span", "a", "br"], context, 4));
      case "ul":
      case "ol":
        return repeat(1, 3, () => element("li", deeper));
      case "table":
        return [
          ...(chance(0.3) ? [element("caption", deeper)] : []),
          el(
            "tbody",
            {},
            ...repeat(1, 2, () =>
              el("tr", {}, ...repeat(1, 3, () => element(pick(["td", "th"]), deeper))),
            ),
          ),
        ];
      case "select":
        return [
          ...repeat(1, 3, () => element("option", deeper)),
          ...(chance(0.3) ? [el("optgroup", own("optgroup"), element("option", deeper))] : []),
        ];
      case "option":
        return chance(0.8) ? [createText(text(), at)] : [];
      case "textarea":
        return withoutLeadingLineFeed(chance(0.8) ? [createText(text(), at)] : []);
      default:
        return [];
    }
  }

  const root = pick(FLOW);
  return { name: `seed ${seed}`, render: element(root, { depth: 0, interactive: false }) };
}

/** The seeded random trees every target renders: the same seeds everywhere, so a failure reproduces. */
export const FUZZ_CASES: readonly ParityCase[] = Array.from({ length: 80 }, (_, index) =>
  fuzzCase(index + 1),
);

/** The case lists every target's render-parity tests run, besides the attribute sweep. */
export const PARITY_SUITES: readonly ParitySuite[] = [
  ["the tricky cases", TRICKY_CASES],
  ["seeded random trees", FUZZ_CASES],
  ["carriage returns", CARRIAGE_RETURN_CASES],
];

/**
 * The DOM an IR element describes under JSX semantics: every text node exactly as the IR holds
 * it, and every attribute with its value (an attribute without one is empty).
 */
export function domOf(node: ElementNode): DomElement {
  const attributes: Record<string, string> = {};
  for (const attribute of node.attributes) {
    const name = attribute.name.toLowerCase();
    attributes[name] = comparableValue(name, attribute.value === true ? "" : attribute.value);
  }
  const children: DomNode[] = [];
  for (const child of node.children) {
    if (child.kind === "Element") children.push(domOf(child));
    else pushText(children, child.value);
  }
  return { tag: node.tag, attributes, children };
}

/**
 * HTML's boolean attributes mean their presence: `disabled`, `disabled=""` and
 * `disabled="disabled"` are the same DOM state, and frameworks write whichever they like.
 */
export function comparableValue(name: string, value: string): string {
  const enumerated = name === "hidden" && value.toLowerCase() === "until-found";
  return isBooleanAttribute(name) && !enumerated ? "" : value;
}

/** Appends text to a node list, merging it into a text node before it. */
export function pushText(nodes: DomNode[], data: string): void {
  if (data === "") return;
  const last = nodes.length - 1;
  if (typeof nodes[last] === "string") nodes[last] += data;
  else nodes.push(data);
}

/** Options for {@link parseHtml}. */
export interface ParseOptions {
  /** Framework bookkeeping to leave out (hydration keys, Qwik's `q:` attributes). */
  ignoreAttribute?(name: string): boolean;
}

/**
 * Parses the HTML a framework's server renderer wrote. The output of a serialiser is regular,
 * so the parser is strict: anything it does not expect (an unknown entity, a stray `<`, an
 * unclosed or mismatched tag) throws rather than guessing. Comments, which frameworks use as
 * anchors, are dropped and the text around them merged. Two HTML parsing rules apply because
 * frameworks rely on them: tag and attribute names are case-insensitive, and a line feed right
 * after `<pre>` or `<textarea>` is not content. A raw carriage return is kept: every serialiser
 * writes the one it holds as it is, so keeping it compares what each framework rendered.
 */
export function parseHtml(html: string, options: ParseOptions = {}): DomNode[] {
  const root: DomElement = { tag: "#root", attributes: {}, children: [] };
  const stack: DomElement[] = [root];
  let index = 0;
  const fail = (message: string): never => {
    throw new Error(`${message} at ${index}: ${JSON.stringify(html.slice(index, index + 40))}`);
  };
  while (index < html.length) {
    const parent = stack.at(-1)!;
    if (html.startsWith("<!--", index)) {
      const end = html.indexOf("-->", index + 4);
      if (end < 0) fail("unterminated comment");
      index = end + 3;
    } else if (html.startsWith("</", index)) {
      const match = /^<\/([a-zA-Z][^\s/>]*)\s*>/.exec(html.slice(index));
      if (!match) fail("malformed end tag");
      const tag = match![1]!.toLowerCase();
      if (tag !== parent.tag) fail(`</${tag}> closes <${parent.tag}>`);
      stack.pop();
      index += match![0].length;
    } else if (html[index] === "<") {
      index = startTag(parent);
    } else {
      const end = html.indexOf("<", index);
      const stop = end < 0 ? html.length : end;
      pushText(parent.children, decode(html.slice(index, stop)));
      index = stop;
    }
  }
  if (stack.length > 1) fail(`<${stack.at(-1)!.tag}> is never closed`);
  return root.children;

  function startTag(parent: DomElement): number {
    const name = /^<([a-zA-Z][^\s/>]*)/.exec(html.slice(index));
    if (!name) fail("a stray <");
    const element: DomElement = { tag: name![1]!.toLowerCase(), attributes: {}, children: [] };
    index += name![0].length;
    for (;;) {
      index += /^\s*/.exec(html.slice(index))![0].length;
      if (html.startsWith("/>", index) || html[index] === ">") break;
      const attribute = /^([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/.exec(
        html.slice(index),
      );
      if (!attribute) fail("malformed attribute");
      const [source, rawName, double, single, unquoted] = attribute!;
      const attributeName = rawName!.toLowerCase();
      if (!options.ignoreAttribute?.(attributeName)) {
        element.attributes[attributeName] = comparableValue(
          attributeName,
          decode(double ?? single ?? unquoted ?? ""),
        );
      }
      index += source.length;
    }
    const selfClosing = html.startsWith("/>", index);
    index += selfClosing ? 2 : 1;
    parent.children.push(element);
    if (isVoidElement(element.tag)) return index;
    if (selfClosing) fail(`<${element.tag}/> is not a void element`);
    stack.push(element);
    if (/^(?:pre|textarea|listing)$/.test(element.tag) && html[index] === "\n") index++;
    return index;
  }

  function decode(text: string): string {
    return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);?/g, (reference, body) => {
      if (body.startsWith("#x")) return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
      if (body.startsWith("#")) return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
      const named = NAMED_REFERENCES[body];
      if (named === undefined || !reference.endsWith(";")) fail(`unexpected entity ${reference}`);
      return named!;
    });
  }
}

/** The named references serialisers and the printers write; any other one fails the parse. */
const NAMED_REFERENCES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
};

/** One comparison of what the IR describes with what the framework rendered. */
export interface ParityResult {
  name: string;
  expected: unknown;
  actual: unknown;
}

/**
 * Pairs each case with what the framework rendered for it, from the parsed root `<div>` of the
 * parity component. The first result compares the root's children as a whole, so a missing or
 * extra node (whitespace a compiler kept between the cases) is named before the pairs it shifts.
 * `expectedOf` is the DOM each case should render: by default {@link domOf}.
 */
export function compareCases(
  rendered: readonly DomNode[],
  cases: readonly ParityCase[],
  expectedOf: (render: ElementNode) => DomNode = domOf,
): ParityResult[] {
  const [root, ...rest] = rendered;
  if (rest.length || typeof root !== "object" || root.tag !== "div") {
    throw new Error(`expected one root <div>, got ${JSON.stringify(rendered).slice(0, 200)}`);
  }
  const outline = (node: DomNode) =>
    typeof node === "string" ? JSON.stringify(node) : `<${node.tag}>`;
  return [
    {
      name: "the root's children, one element per case",
      expected: cases.map(({ render }) => `<${render.tag}>`),
      actual: root.children.map(outline),
    },
    ...cases.map(({ name, render }, index) => ({
      name,
      expected: expectedOf(render),
      actual: root.children[index],
    })),
  ];
}
