// The render-parity kit: components that are hard to print, seeded fuzzes, the DOM a component
// renders for its props, and a strict parser for server-rendered HTML. Every target package's
// render-parity tests import it by relative path (it is test code, not codegen's API): the
// target's output, formatted or not, goes through the framework's own compiler and renderer, on
// the server and in the browser, and the DOM that comes out must be exactly the DOM the reference
// semantics give (design §1, §4.5). String tests of the printers cannot show that; only the
// frameworks can.
//
// Two kinds of case. M0's are static IR trees (`el()`), which are also the DOM they describe.
// M1's are source: a component's props and JSX (./render-parity-sources.ts), lowered by the
// analyser as an author's component is, and rendered with prop values; the reference evaluator
// (./render-parity-reference.ts) says what they render.
//
// This module runs anywhere (Node and the browser). Lowering the sources, emitting the cases,
// the attribute sweeps and the Vite plugin that serves them to the browser are in
// ./render-parity-node.ts; reading a live DOM is in ./render-parity-client.ts.
import {
  createElement,
  createStaticAttribute,
  createText,
  cssPropertiesOverlap,
  elementNamespace,
  FIXED_VALUE_INPUT_TYPES,
  isBooleanAttribute,
  isVoidElement,
} from "@unframework/ir";
import type {
  ElementNode,
  FragmentNode,
  Namespace,
  RenderNode,
  Span,
  UfComponent,
  UfModule,
} from "@unframework/ir";

import { instantiate } from "./render-parity-reference.ts";

/** A DOM node as a comparable value: a text node is its data. */
export type DomNode = string | DomElement;

/**
 * An element: its tag, its attributes by name, and its children. Names are as the DOM holds
 * them: lower case in HTML, SVG's own case in SVG (`viewBox`).
 */
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
 * One case, named for the failure message. A target renders it exactly unless its capability
 * matrix marks a capability the case uses unsupported (`unsupportedCapabilities`).
 */
export interface ParityCase {
  name: string;
  /**
   * The tree the target emits the case from. An M0 case is a static tree, which is also the DOM
   * it describes. A source case's is its component's render, lowered alone; what it renders for
   * its props is the reference evaluator's (`expectedTree`).
   */
  render: ElementNode | FragmentNode;
  /** A source case: what the analyser made of it, and the props it renders with. */
  lowered?: LoweredCase;
}

/** An M0 case: a static tree with one root element. */
export interface StaticCase extends ParityCase {
  render: ElementNode;
  lowered?: undefined;
}

/**
 * A case written as a component's source, as an author writes one (M1): its props parameter,
 * the type declarations the props use, the JSX it returns, and the values it renders with.
 * `sourceCase` (./render-parity-node.ts) lowers it; the analyser must accept it.
 */
export interface SourceCase {
  name: string;
  /** The props parameter as written (`{ label, count = 1 }: { label: string; count?: number }`). */
  params?: string;
  /** Top-level type declarations the props use, as written: each name once in a suite. */
  types?: string;
  /** What the component returns: one element, or (in a root case) anything a root can be. */
  jsx: string;
  /**
   * The props it renders with, by name. A key left out is an absent prop; a key set to
   * `undefined` is an explicit `undefined`, which must render the same (design §1.1).
   */
  props?: Readonly<Record<string, unknown>>;
}

/** What `sourceCase` made of a {@link SourceCase}. */
export interface LoweredCase {
  /** The module's source: the case's types, and its component, `Case`. */
  text: string;
  /** Where the returned JSX is in `text`. */
  jsx: Span;
  module: UfModule;
  component: UfComponent;
  /** The props it renders with, by the case's own names. */
  props: Readonly<Record<string, unknown>>;
}

/**
 * A titled list of cases, rendered as one component, as every target's render-parity tests run
 * them. `root` says where the cases sit: each one element in a root `<div>` (`"div"`, the
 * default), or, for a suite of exactly one case, the component's own root (`"self"`: a root
 * fragment, or text and control flow at the root's edges). `form` says how a source suite's
 * component reads its props: destructured (the default) or through one object (`props.x`).
 */
export interface ParitySuite {
  title: string;
  cases: readonly ParityCase[];
  root?: SuiteRoot;
  form?: "destructured" | "object";
}

/** Where a suite's cases sit in its component (see {@link ParitySuite}). */
export type SuiteRoot = "div" | "self";

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
export const TRICKY_CASES: readonly StaticCase[] = [
  { name: "runs of spaces", render: el("p", {}, "a  b   c") },
  // A form feed, which HTML keeps; not a vertical tab, which it does not (the IR holds none).
  { name: "tabs and line breaks", render: el("p", {}, "a\tb\nc\n\nd\fe\t\tf") },
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
      // The IR writes a boolean attribute as `true`, and an attribute JSX writes bare as "true".
      el("input", { disabled: true, readonly: true, required: true }),
      el("details", { open: true }, el("summary", {}, "More")),
      el("p", { hidden: true, "data-on": "true", "aria-hidden": "true" }, "x"),
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
export const CARRIAGE_RETURN_CASES: readonly StaticCase[] = [
  { name: "carriage returns in text", render: el("p", {}, "a\rb\r\nc") },
  { name: "carriage returns in preformatted text", render: el("pre", {}, "a\rb\r\nc") },
  {
    name: "carriage returns in attribute values",
    render: el("p", { title: "a\rb", "data-x": "c\r\nd" }, "x"),
  },
];

/** A small deterministic PRNG (mulberry32), so a seed always gives the same trees (P8). */
export function random(seed: number): () => number {
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
export const TEXT_PIECES: readonly string[] = [
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
export function fuzzCase(seed: number): StaticCase {
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
export const FUZZ_CASES: readonly StaticCase[] = Array.from({ length: 80 }, (_, index) =>
  fuzzCase(index + 1),
);

/** The M0 suites every target's render-parity tests run, besides the attribute sweeps and M1's. */
export const PARITY_SUITES: readonly ParitySuite[] = [
  { title: "the tricky cases", cases: TRICKY_CASES },
  { title: "seeded random trees", cases: FUZZ_CASES },
  { title: "carriage returns", cases: CARRIAGE_RETURN_CASES },
];

/**
 * The tree a case renders, as static IR: an M0 case's own tree, or what the reference evaluator
 * makes of a source case for its props. Cached: the evaluator runs once per case.
 */
export function expectedTree(parityCase: ParityCase): ElementNode | FragmentNode {
  const { lowered } = parityCase;
  if (!lowered) return parityCase.render;
  let tree = expectedTrees.get(parityCase);
  if (!tree) {
    tree = instantiate(lowered.component, lowered.props);
    expectedTrees.set(parityCase, tree);
  }
  return tree;
}

const expectedTrees = new WeakMap<ParityCase, ElementNode | FragmentNode>();

/** The DOM nodes a case renders: one element, or a root fragment's nodes. */
export function expectedNodes(parityCase: ParityCase): DomNode[] {
  return domNodesOf(expectedTree(parityCase));
}

/** The DOM nodes a static tree describes: an element, or a fragment's nodes. */
export function domNodesOf(tree: ElementNode | FragmentNode): DomNode[] {
  if (tree.kind === "Element") return [domOf(tree)];
  const nodes: DomNode[] = [];
  for (const child of tree.children) {
    if (child.kind === "Element") nodes.push(domOf(child));
    else if (child.kind === "Text") pushText(nodes, child.value);
    else throw new Error(`a ${child.kind} node is not static`);
  }
  return nodes;
}

/**
 * The DOM a static IR element describes under JSX semantics: every text node exactly as the IR
 * holds it, and every attribute with its value (an attribute without one is empty), compared as
 * {@link comparableValue} says. The namespace follows from the tree, as in the IR: `<svg>`
 * starts SVG.
 */
export function domOf(node: ElementNode, parent: Namespace = "html"): DomElement {
  const namespace = elementNamespace(node.tag, parent);
  const attributes: Record<string, string> = {};
  for (const attribute of node.attributes) {
    if (attribute.kind !== "Static") throw new Error(`a ${attribute.kind} attribute is not static`);
    const name = namespace === "html" ? attribute.name.toLowerCase() : attribute.name;
    const value = comparableValue(name, attribute.value === true ? "" : attribute.value, namespace);
    if (value !== undefined) attributes[name] = value;
  }
  const children: DomNode[] = [];
  for (const child of node.children) {
    if (child.kind === "Element") children.push(domOf(child, namespace));
    else if (child.kind === "Text") pushText(children, child.value);
    else throw new Error(`a ${child.kind} node is not static`);
  }
  return { tag: node.tag, attributes, children };
}

/**
 * An attribute's value as the comparison sees it, or `undefined` when it counts as no attribute.
 * What frameworks write differently for the same DOM state, and only that, is made the same
 * (ADR-0031, ADR-0044, design §6.4):
 * - HTML's boolean attributes mean their presence: `disabled`, `disabled=""` and
 *   `disabled="disabled"` are the same state, and frameworks write whichever they like;
 * - a `class` is its tokens, sorted and joined by one space (order and spacing carry no
 *   meaning; a doubled token is kept, as a broken merge makes one), and a `class` with no token
 *   is none (Vue's server writes `class=""` where its client writes nothing);
 * - a `style` is its declarations (`styleDeclarations`): one with an empty value goes, as the
 *   CSSOM ignores it, they are sorted by property unless two of them overlap, and a `style` with
 *   none is no `style`.
 */
export function comparableValue(
  name: string,
  value: string,
  namespace: Namespace = "html",
): string | undefined {
  if (name === "class") {
    const tokens = value.split(ASCII_WHITESPACE).filter((token) => token !== "");
    return tokens.length ? tokens.toSorted(byCodeUnits).join(" ") : undefined;
  }
  if (name === "style") {
    const declarations = sortDeclarations(
      styleDeclarations(value).filter((declaration) => declaration.value !== ""),
    );
    return declarations.length
      ? declarations
          .map(({ property, value: text }) =>
            text === undefined ? `${property};` : `${property}: ${text};`,
          )
          .join(" ")
      : undefined;
  }
  if (namespace !== "html") return value;
  const enumerated = name === "hidden" && value.toLowerCase() === "until-found";
  return isBooleanAttribute(name) && !enumerated ? "" : value;
}

/** ASCII whitespace, which separates the tokens of a `class` attribute. */
const ASCII_WHITESPACE = /[\t\n\f\r ]+/;

/** Compares by UTF-16 code units, so an order never depends on a locale. */
const byCodeUnits = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** A declaration of a `style` attribute. */
interface Declaration {
  /** Lower case, except a custom property (`--x`), whose name is case-sensitive. */
  property: string;
  /** Whitespace collapsed; absent for a chunk without a colon, which is kept so it differs. */
  value?: string;
}

/**
 * The declarations of a `style` attribute's value. Deliberately small, as the testing package's
 * normaliser's parser is: it splits at `;` and `:` outside strings, parentheses and comments, and
 * collapses whitespace; values are not interpreted (`0` and `0px` stay different), since every
 * target renders the source's values and only their spacing differs. A chunk without a colon is
 * kept whole as a property with no value, so a broken declaration still differs.
 */
export function styleDeclarations(text: string): Declaration[] {
  const declarations: Declaration[] = [];
  for (const chunk of splitTopLevel(text, ";")) {
    const colon = splitTopLevel(chunk, ":", 2);
    const property = collapseSpaces(colon[0]!);
    if (colon.length < 2) {
      if (property !== "") declarations.push({ property });
      continue;
    }
    declarations.push({
      property: property.startsWith("--") ? property : property.toLowerCase(),
      value: collapseSpaces(colon[1]!),
    });
  }
  return declarations;
}

/** Splits text at top-level separators (outside strings, parentheses and comments). */
function splitTopLevel(text: string, separator: string, limit = Infinity): string[] {
  const parts: string[] = [];
  let current = "";
  let quote = "";
  let depth = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!;
    if (char === "\\" && index + 1 < text.length) {
      current += char + text[++index];
    } else if (quote) {
      current += char;
      if (char === quote) quote = "";
    } else if (char === "/" && text[index + 1] === "*") {
      const end = text.indexOf("*/", index + 2);
      index = end < 0 ? text.length : end + 1;
      current += " ";
    } else if (char === separator && depth === 0 && parts.length < limit - 1) {
      parts.push(current);
      current = "";
    } else {
      if (char === '"' || char === "'") quote = char;
      else if (char === "(") depth++;
      else if (char === ")" && depth > 0) depth--;
      current += char;
    }
  }
  parts.push(current);
  return parts;
}

/** Collapses CSS whitespace (not U+00A0, which belongs to a value) to one space, and trims. */
function collapseSpaces(text: string): string {
  return text.replace(/[ \t\n\r\f]+/g, " ").trim();
}

/**
 * Declarations sorted by property, unless the order of two of them decides what renders (the
 * same property twice, a shorthand and its longhand: `cssPropertiesOverlap`), when they keep
 * theirs. The analyser lets no `style` set overlapping properties, so for the cases the order
 * never matters, and each target writes its own (an object's key order, the CSSOM's, Angular's
 * static declarations first).
 */
function sortDeclarations(declarations: readonly Declaration[]): Declaration[] {
  const ordered = declarations.some((declaration, index) =>
    declarations
      .slice(index + 1)
      .some((other) => cssPropertiesOverlap(declaration.property, other.property)),
  );
  return ordered
    ? [...declarations]
    : declarations.toSorted((a, b) => byCodeUnits(a.property, b.property));
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
 * The SVG tag names the HTML parser restores from lower case (the HTML standard's "adjust SVG
 * tag name" table, which parse5 and browsers implement): every other name in SVG stays as the
 * parser lower-cased it.
 */
const SVG_TAG_NAMES: ReadonlyMap<string, string> = caseTable(`
  altGlyph altGlyphDef altGlyphItem animateColor animateMotion animateTransform clipPath feBlend
  feColorMatrix feComponentTransfer feComposite feConvolveMatrix feDiffuseLighting
  feDisplacementMap feDistantLight feDropShadow feFlood feFuncA feFuncB feFuncG feFuncR
  feGaussianBlur feImage feMerge feMergeNode feMorphology feOffset fePointLight
  feSpecularLighting feSpotLight feTile feTurbulence foreignObject glyphRef linearGradient
  radialGradient textPath
`);

/** The SVG attribute names the HTML parser restores from lower case ("adjust SVG attributes"). */
const SVG_ATTRIBUTE_NAMES: ReadonlyMap<string, string> = caseTable(`
  attributeName attributeType baseFrequency baseProfile calcMode clipPathUnits diffuseConstant
  edgeMode filterUnits glyphRef gradientTransform gradientUnits kernelMatrix kernelUnitLength
  keyPoints keySplines keyTimes lengthAdjust limitingConeAngle markerHeight markerUnits
  markerWidth maskContentUnits maskUnits numOctaves pathLength patternContentUnits
  patternTransform patternUnits pointsAtX pointsAtY pointsAtZ preserveAlpha preserveAspectRatio
  primitiveUnits refX refY repeatCount repeatDur requiredExtensions requiredFeatures
  specularConstant specularExponent spreadMethod startOffset stdDeviation stitchTiles
  surfaceScale systemLanguage tableValues targetX targetY textLength viewBox viewTarget
  xChannelSelector yChannelSelector zoomAndPan
`);

/**
 * The HTML start tags that end foreign content (the HTML standard's "in foreign content" rule):
 * the parser closes the `<svg>` and puts one of them back in HTML.
 */
const FOREIGN_CONTENT_BREAKERS: ReadonlySet<string> = new Set(
  `b big blockquote body br center code dd div dl dt em embed h1 h2 h3 h4 h5 h6 head hr i img li
  listing menu meta nobr ol p pre ruby s small span strong strike sub sup table tt u ul var`
    .trim()
    .split(/\s+/),
);

/** Each camel-case name of a list by its lower case. */
function caseTable(names: string): ReadonlyMap<string, string> {
  return new Map(
    names
      .trim()
      .split(/\s+/)
      .map((name) => [name.toLowerCase(), name]),
  );
}

/** A name as the HTML parser reads it in a namespace: lower case, then SVG's case restored. */
export function parsedName(name: string, namespace: Namespace, table: "tag" | "attribute"): string {
  const lower = name.toLowerCase();
  if (namespace !== "svg") return lower;
  return (table === "tag" ? SVG_TAG_NAMES : SVG_ATTRIBUTE_NAMES).get(lower) ?? lower;
}

/**
 * Parses the HTML a framework's server renderer wrote. The output of a serialiser is regular,
 * so the parser is strict: anything it does not expect (an unknown entity, a stray `<`, an
 * unclosed or mismatched tag) throws rather than guessing. Comments, which frameworks use as
 * anchors, are dropped and the text around them merged. The HTML parsing rules frameworks rely
 * on apply: tag and attribute names are case-insensitive, and inside an `<svg>` SVG's camel-case
 * names are restored as the HTML parser restores them (`viewBox`, `linearGradient`); an element
 * there may close itself (`<circle/>`), as a foreign element can; and a line feed right after
 * `<pre>` or `<textarea>` is not content. A raw carriage return is kept: every serialiser writes
 * the one it holds as it is, so keeping it compares what each framework rendered.
 */
export function parseHtml(html: string, options: ParseOptions = {}): DomNode[] {
  const root: DomElement = { tag: "#root", attributes: {}, children: [] };
  const stack: { element: DomElement; namespace: Namespace }[] = [
    { element: root, namespace: "html" },
  ];
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
      const tag = parsedName(match![1]!, parent.namespace, "tag");
      if (tag !== parent.element.tag) fail(`</${tag}> closes <${parent.element.tag}>`);
      stack.pop();
      index += match![0].length;
    } else if (html[index] === "<") {
      index = startTag(parent);
    } else {
      const end = html.indexOf("<", index);
      const stop = end < 0 ? html.length : end;
      pushText(parent.element.children, decode(html.slice(index, stop)));
      index = stop;
    }
  }
  if (stack.length > 1) fail(`<${stack.at(-1)!.element.tag}> is never closed`);
  return root.children;

  function startTag(parent: { element: DomElement; namespace: Namespace }): number {
    const name = /^<([a-zA-Z][^\s/>]*)/.exec(html.slice(index));
    if (!name) fail("a stray <");
    // In SVG, these tags make the HTML parser leave foreign content: no IR holds one there.
    if (parent.namespace === "svg" && FOREIGN_CONTENT_BREAKERS.has(name![1]!.toLowerCase())) {
      fail(`<${name![1]}> inside <svg>`);
    }
    const namespace = elementNamespace(name![1]!.toLowerCase(), parent.namespace);
    const element: DomElement = {
      tag: parsedName(name![1]!, namespace, "tag"),
      attributes: {},
      children: [],
    };
    index += name![0].length;
    for (;;) {
      index += /^\s*/.exec(html.slice(index))![0].length;
      if (html.startsWith("/>", index) || html[index] === ">") break;
      const attribute = /^([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/.exec(
        html.slice(index),
      );
      if (!attribute) fail("malformed attribute");
      const [source, rawName, double, single, unquoted] = attribute!;
      const attributeName = parsedName(rawName!, namespace, "attribute");
      if (!options.ignoreAttribute?.(attributeName)) {
        const value = comparableValue(
          attributeName,
          decode(double ?? single ?? unquoted ?? ""),
          namespace,
        );
        if (value !== undefined) element.attributes[attributeName] = value;
      }
      index += source.length;
    }
    const selfClosing = html.startsWith("/>", index);
    index += selfClosing ? 2 : 1;
    parent.element.children.push(element);
    if (namespace === "html" && isVoidElement(element.tag)) return index;
    // A foreign element may close itself; an HTML element that is not void may not.
    if (selfClosing) {
      if (namespace === "html") fail(`<${element.tag}/> is not a void element`);
      return index;
    }
    stack.push({ element, namespace });
    if (namespace === "html" && /^(?:pre|textarea|listing)$/.test(element.tag)) {
      if (html[index] === "\n") index++;
    }
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

/** One comparison of what the reference describes with what the framework rendered. */
export interface ParityResult {
  name: string;
  expected: unknown;
  actual: unknown;
}

/** What one case must render, as DOM nodes: one element, or a root case's nodes. */
export interface ExpectedCase {
  name: string;
  nodes: DomNode[];
}

/**
 * Pairs each case of a suite with what the framework rendered for it, from the parsed output of
 * the suite's component (`compareRendered`), against what the case renders (`expectedNodes`).
 */
export function compareCases(rendered: readonly DomNode[], suite: ParitySuite): ParityResult[] {
  return compareRendered(
    rendered,
    suite.root ?? "div",
    suite.cases.map((parityCase) => ({ name: parityCase.name, nodes: expectedNodes(parityCase) })),
  );
}

/**
 * Pairs each case with what the framework rendered for it. The first result compares an outline
 * of the rendered nodes (`<tag>` per element, the text of a text node), so a missing or extra
 * node (whitespace a compiler kept between the cases) is named before the pairs it shifts. In a
 * `"div"` suite the output is one root `<div>`, and each case is its child at the case's index;
 * in a `"self"` suite, the one case is the whole output.
 */
export function compareRendered(
  rendered: readonly DomNode[],
  root: SuiteRoot,
  cases: readonly ExpectedCase[],
): ParityResult[] {
  const outline = (node: DomNode) =>
    typeof node === "string" ? JSON.stringify(node) : `<${node.tag}>`;
  if (root === "self") {
    if (cases.length !== 1) throw new Error(`a "self" suite has one case, not ${cases.length}`);
    const [only] = cases;
    return [
      {
        name: "the component's root nodes",
        expected: only!.nodes.map(outline),
        actual: rendered.map(outline),
      },
      { name: only!.name, expected: only!.nodes, actual: [...rendered] },
    ];
  }
  const [container, ...rest] = rendered;
  if (rest.length || typeof container !== "object" || container.tag !== "div") {
    throw new Error(`expected one root <div>, got ${JSON.stringify(rendered).slice(0, 200)}`);
  }
  return [
    {
      name: "the root's children, one element per case",
      expected: cases.flatMap(({ nodes }) => nodes.map(outline)),
      actual: container.children.map(outline),
    },
    ...cases.map(({ name, nodes }, index) => {
      if (nodes.length !== 1) throw new Error(`${name}: a "div" suite's case is one element`);
      return { name, expected: nodes[0], actual: container.children[index] };
    }),
  ];
}
