// The analyser's element and nesting rules against the tools whose behaviour they stand for:
// the WHATWG HTML parser (parse5), Svelte's compiler (an error), Vue's template compiler (a
// warning, or a component for a tag it does not know) and Angular's DOM schema (NG8001 under
// strict templates). Whatever any of them repairs, reports or misreads, the analyser must
// reject; ordinary HTML that none of them touches, it must accept.
import { createRequire } from "node:module";

import { DomElementSchemaRegistry } from "@angular/compiler";
import {
  HTML_ELEMENTS,
  isVoidElement,
  OBSOLETE_ELEMENTS,
  P_CLOSING_ELEMENTS,
  VOID_ELEMENTS,
} from "@unframework/ir";
import { defaultTreeAdapter, html as spec, parseFragment, serialize } from "parse5";
import type { DefaultTreeAdapterTypes } from "parse5";
import { compile as compileSvelte } from "svelte/compiler";
import { describe, expect, it } from "vitest";

import { run } from "./helpers.ts";

/** The part of `@vue/compiler-dom` the test uses; it is reached through `vue`, as Vue's own tools do. */
interface VueCompilerDom {
  compile: (
    template: string,
    options: { onWarn: (error: Error) => void; onError: (error: Error) => void },
  ) => unknown;
}
const vueRequire = createRequire(createRequire(import.meta.url).resolve("vue/package.json"));
const vue = vueRequire("@vue/compiler-dom") as VueCompilerDom;
/** Vue's list of HTML tags: any other lower-case tag, it resolves as a component. */
const { isHTMLTag } = vueRequire("@vue/shared") as { isHTMLTag: (tag: string) => boolean };

/** The ancestors an element needs to be where HTML allows it. */
const CONTEXT: Readonly<Record<string, readonly string[]>> = {
  caption: ["table"],
  colgroup: ["table"],
  thead: ["table"],
  tbody: ["table"],
  tfoot: ["table"],
  tr: ["table", "tbody"],
  td: ["table", "tbody", "tr"],
  th: ["table", "tbody", "tr"],
  col: ["table", "colgroup"],
  dd: ["dl"],
  dt: ["dl"],
  figcaption: ["figure"],
  summary: ["details"],
  area: ["map"],
  rp: ["ruby"],
  rt: ["ruby"],
  option: ["select"],
  optgroup: ["select"],
};

/** A nesting, outermost first, as a template (Svelte, Vue) or JSX: the two read alike. */
function markup(tags: readonly string[]): string {
  const [tag, ...inner] = tags;
  if (!tag) return "";
  if (isVoidElement(tag) && !inner.length) return `<${tag} />`;
  return `<${tag}>${markup(inner)}</${tag}>`;
}

/** The same nesting as HTML source, where a void element has no end tag. */
function html(tags: readonly string[]): string {
  const [tag, ...inner] = tags;
  if (!tag) return "";
  return isVoidElement(tag) ? `<${tag}>${html(inner)}` : `<${tag}>${html(inner)}</${tag}>`;
}

/**
 * Whether the HTML parser, parsing the nesting in a `<body>`, builds any other tree than the
 * chain of elements it describes: an element moved, dropped, added or closed early.
 */
function parserRepairs(tags: readonly string[]): boolean {
  const body = defaultTreeAdapter.createElement("body", spec.NS.HTML, []);
  return !isChain(parseFragment(body, html(tags), {}), tags);
}

/** Whether a node's subtree is exactly one element per tag, each the only child of the last. */
function isChain(node: DefaultTreeAdapterTypes.ParentNode, tags: readonly string[]): boolean {
  const [tag, ...inner] = tags;
  if (tag === undefined) return node.childNodes.length === 0;
  const [child] = node.childNodes;
  return (
    node.childNodes.length === 1 &&
    child !== undefined &&
    "tagName" in child &&
    child.tagName === tag &&
    isChain(child, inner)
  );
}

/** The elements of a parsed fragment, in document order. */
function elementsOf(node: DefaultTreeAdapterTypes.ParentNode): DefaultTreeAdapterTypes.Element[] {
  return node.childNodes.flatMap((child) =>
    "tagName" in child ? [child, ...elementsOf(child)] : [],
  );
}

function parseBody(source: string): DefaultTreeAdapterTypes.DocumentFragment {
  return parseFragment(defaultTreeAdapter.createElement("body", spec.NS.HTML, []), source, {});
}

/** Whether Svelte fails to compile the nesting, or warns that the browser will repair it. */
function svelteRejects(tags: readonly string[]): boolean {
  try {
    const { warnings } = compileSvelte(markup(tags), { generate: "server" });
    return warnings.some((warning) => warning.code === "node_invalid_placement_ssr");
  } catch {
    return true;
  }
}

function vueReports(tags: readonly string[]): boolean {
  let reported = false;
  vue.compile(markup(tags), {
    onWarn: () => (reported = true),
    onError: () => (reported = true),
  });
  return reported;
}

function analyzerRejects(tags: readonly string[]): boolean {
  return run(`export function A() { return ${markup(tags)}; }`).diagnostics.length > 0;
}

/** The HTML elements a component can render, each in its context. */
const elements = [...HTML_ELEMENTS].filter(
  (tag) => !analyzerRejects(["div", ...(CONTEXT[tag] ?? []), tag]),
);

// The facts the rules rest on, exactly: no element missing, and none extra.
describe("the HTML facts", () => {
  const tags = [...HTML_ELEMENTS, ...OBSOLETE_ELEMENTS];

  it("list exactly the start tags that close an open <p>", () => {
    const closing = tags.filter((tag) => {
      const [p, ...rest] = parseBody(`<p><${tag}></${tag}></p>`).childNodes;
      const inside =
        p && "tagName" in p && elementsOf(p).some((element) => element.tagName === tag);
      return !inside && rest.some((node) => "tagName" in node && node.tagName === tag);
    });
    expect(closing.sort()).toEqual([...P_CLOSING_ELEMENTS].sort());
  });

  it("list exactly the void elements", () => {
    // Parsed where each element belongs; the serialiser writes a void element without an end tag.
    const parents: Readonly<Record<string, string>> = {
      col: "colgroup",
      tr: "tbody",
      td: "tr",
      th: "tr",
    };
    const voids = [...HTML_ELEMENTS].filter((tag) => {
      const context = defaultTreeAdapter.createElement(
        parents[tag] ?? (CONTEXT[tag]?.at(-1) === "table" ? "table" : "body"),
        spec.NS.HTML,
        [],
      );
      // Only the start tag: the parser reads `</br>` as a second `<br>`.
      return serialize(parseFragment(context, `<${tag}>`, {})) === `<${tag}>`;
    });
    expect(voids.sort()).toEqual([...VOID_ELEMENTS].sort());
  });
});

describe("the element rules", () => {
  // Vue resolves a tag it does not know as a component, and Angular's strict templates reject it.
  it("accept only elements Vue and Angular know as HTML", () => {
    const angular = new DomElementSchemaRegistry();
    // Each check must see what it exists for, or the lists below would prove nothing.
    expect([isHTMLTag("search"), angular.hasElement("my-widget", [])]).toEqual([false, false]);
    expect(elements.filter((tag) => !isHTMLTag(tag))).toEqual([]);
    expect(elements.filter((tag) => !angular.hasElement(tag, []))).toEqual([]);
  });
});

describe("the nesting rules", () => {
  it("accept every element HTML defines, except the document's and the frameworks' own", () => {
    expect([...HTML_ELEMENTS].filter((tag) => !elements.includes(tag)).sort()).toEqual([
      "base",
      "body",
      "head",
      "html",
      "link",
      "meta",
      "noscript",
      "script",
      "search",
      "selectedcontent",
      "slot",
      "style",
      "template",
      "title",
    ]);
  });

  // Each tool must see what it exists for here, or the sweep below would prove nothing.
  it.each([
    [parserRepairs, ["div", "p", "div"]],
    [parserRepairs, ["div", "table", "tr"]],
    [parserRepairs, ["div", "br", "span"]],
    [svelteRejects, ["div", "p", "div"]],
    [svelteRejects, ["div", "a", "span", "a"]],
    [vueReports, ["div", "p", "div"]],
    [vueReports, ["div", "dl", "span", "dd"]],
  ] as const)("has %o detect %j", (detects, tags) => {
    expect(detects(tags)).toBe(true);
  });

  it("reject every parent and child the parser, Svelte or Vue repairs or reports", () => {
    const missed: string[] = [];
    const flagged = { parser: 0, svelte: 0, vue: 0 };
    for (const parent of elements) {
      for (const child of elements) {
        const tags = ["div", ...(CONTEXT[parent] ?? []), parent, child];
        const tools = [
          parserRepairs(tags) && "the parser",
          svelteRejects(tags) && "Svelte",
          vueReports(tags) && "Vue",
        ].filter((tool) => tool !== false);
        if (tools.includes("the parser")) flagged.parser++;
        if (tools.includes("Svelte")) flagged.svelte++;
        if (tools.includes("Vue")) flagged.vue++;
        if (tools.length && !analyzerRejects(tags)) {
          missed.push(`${html(tags)} (${tools.join(", ")})`);
        }
      }
    }
    expect(missed).toEqual([]);
    // Thousands of pairs are repaired (void parents, tables, text-only elements, <p>).
    expect(flagged.parser).toBeGreaterThan(1000);
    expect(flagged.svelte).toBeGreaterThan(1000);
    expect(flagged.vue).toBeGreaterThan(1000);
  }, 120_000);

  // Descendants, through an element that is neither of them.
  it.each([
    ["div", "p", "span", "div"],
    ["div", "p", "button", "div"],
    ["div", "p", "a", "ul"],
    ["div", "a", "span", "a"],
    ["div", "a", "table", "tbody", "tr", "td", "a"],
    ["div", "button", "span", "button"],
    ["div", "form", "div", "form"],
    ["div", "h1", "span", "h2"],
    ["div", "ul", "li", "div", "li"],
    ["div", "ul", "li", "span", "li"],
    ["div", "dl", "dd", "div", "dt"],
    ["div", "dl", "dt", "section", "dd"],
    ["div", "ruby", "rt", "span", "rt"],
    ["div", "table", "tbody", "tr", "td", "tr"],
  ])("reject %s > … the tools reject", (...tags) => {
    expect(parserRepairs(tags) || svelteRejects(tags) || vueReports(tags)).toBe(true);
    expect(analyzerRejects(tags)).toBe(true);
  });

  // Ordinary HTML that no tool touches must stay accepted.
  it.each([
    ["div", "p", "span", "a", "em"],
    ["div", "p", "button", "span"],
    ["div", "ul", "li", "ul", "li"],
    ["div", "ol", "li", "p"],
    ["div", "dl", "div", "dt"],
    ["div", "dl", "dd", "dl", "dd"],
    ["div", "table", "caption"],
    ["div", "table", "thead", "tr", "th"],
    ["div", "table", "tbody", "tr", "td", "table", "tbody", "tr", "td"],
    ["div", "table", "colgroup", "col"],
    ["div", "select", "optgroup", "option"],
    ["div", "select", "hr"],
    ["div", "details", "summary"],
    ["div", "figure", "figcaption"],
    ["div", "map", "area"],
    ["div", "ruby", "rt"],
    ["div", "a", "div", "p"],
    ["div", "button", "img"],
    ["div", "label", "input"],
    ["div", "fieldset", "legend"],
    ["div", "picture", "img"],
    ["div", "video", "track"],
    ["article", "header", "h2"],
    ["div", "section", "h1"],
    ["div", "blockquote", "p"],
    ["div", "nav", "ul", "li", "a"],
  ])("accept %s > …", (...tags) => {
    expect(parserRepairs(tags) || svelteRejects(tags) || vueReports(tags)).toBe(false);
    expect(analyzerRejects(tags)).toBe(false);
  });
});
