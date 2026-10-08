// The reference evaluator is the oracle every target is held to, so each rule of ADR-0034 to
// ADR-0040 it encodes is tested here against a DOM written by hand: a component's source, lowered
// by the analyser as an author's is, with props, against the HTML it must render. Then the markup
// cases another agent wrote by hand (./markup-cases.ts) are evaluated too, as a second, independent
// reading of the same rules.
import type { ElementNode, InterpolationNode } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import { MARKUP_CASES, passedProps, ROOT_CASES, suite as markupSuite } from "./markup-cases.ts";
import { sourceCases } from "./render-parity-node.ts";
import { instantiate } from "./render-parity-reference.ts";
import { domNodesOf, expectedNodes, parseHtml } from "./render-parity.ts";
import type { DomElement, DomNode } from "./render-parity.ts";

/** What a component renders for its props, by the reference. */
function rendered(params: string, jsx: string, props: Record<string, unknown> = {}): DomNode[] {
  const [parityCase] = sourceCases([{ name: "a case", params, jsx, props }]);
  return expectedNodes(parityCase!);
}

/** The DOM some HTML describes, compared as the kit compares (ADR-0044). */
const html = (source: string) => parseHtml(source);

/** A list with a hole. */
function sparse(): string[] {
  const list: string[] = [];
  list[1] = "a";
  return list;
}

describe("instantiate", () => {
  it("renders interpolations: strings as they are, numbers as String() does, nothing for nullish", () => {
    expect(
      rendered(
        "{ s, n, z, big, nothing, absent }: { s: string; n: number; z: number; big: number; nothing: string | null; absent?: string }",
        "<p>{s}|{n}|{z}|{big}|{nothing}|{absent}|{n / 4}</p>",
        { s: "<b>&amp;", n: 3, z: -0, big: 1e21, nothing: null },
      ),
    ).toEqual(html("<p>&lt;b&gt;&amp;amp;|3|0|1e+21|||0.75</p>"));
  });

  it("renders a conditional by truthiness, as v-if decides, not JavaScript's value", () => {
    const jsx = '<p>{v && <b>x</b>}{v ? "y" : <i>n</i>}</p>';
    expect(rendered("{ v }: { v: number }", jsx, { v: 0 })).toEqual(html("<p><i>n</i></p>"));
    expect(rendered("{ v }: { v: number }", jsx, { v: 2 })).toEqual(html("<p><b>x</b>y</p>"));
    expect(rendered("{ v }: { v: string }", jsx, { v: "" })).toEqual(html("<p><i>n</i></p>"));
  });

  it("renders the first branch of a chain whose condition holds, or the else", () => {
    const jsx = '<p>{k === 1 ? "one" : k === 2 ? <b>two</b> : <>else <i>!</i></>}</p>';
    const of = (k: number) => rendered("{ k }: { k: number }", jsx, { k });
    expect(of(1)).toEqual(html("<p>one</p>"));
    expect(of(2)).toEqual(html("<p><b>two</b></p>"));
    expect(of(3)).toEqual(html("<p>else <i>!</i></p>"));
  });

  it("renders a list's body for each item, in order, with the item and the index", () => {
    expect(
      rendered(
        "{ xs }: { xs: { id: string; t: string }[] }",
        "<ul>{xs.map((x, i) => <li key={x.id}>{i}:{x.t}</li>)}</ul>",
        {
          xs: [
            { id: "b", t: "B" },
            { id: "a", t: "A" },
          ],
        },
      ),
    ).toEqual(html("<ul><li>0:B</li><li>1:A</li></ul>"));
    expect(
      rendered("{ xs }: { xs: string[] }", "<ul>{xs.map((x) => <li key={x}>{x}</li>)}</ul>", {
        xs: [],
      }),
    ).toEqual(html("<ul></ul>"));
  });

  it("renders nested lists with each level's variables in scope", () => {
    expect(
      rendered(
        "{ rows }: { rows: { id: number; cells: string[] }[] }",
        "<table><tbody>{rows.map((row) => <tr key={row.id}>{row.cells.map((cell, c) => <td key={c}>{row.id}{cell}</td>)}</tr>)}</tbody></table>",
        {
          rows: [
            { id: 1, cells: ["a", "b"] },
            { id: 2, cells: [] },
          ],
        },
      ),
    ).toEqual(html("<table><tbody><tr><td>1a</td><td>1b</td></tr><tr></tr></tbody></table>"));
  });

  it("renders a root fragment's nodes, its texts merged", () => {
    const [root] = sourceCases([
      {
        name: "root",
        params: "{ s }: { s: string }",
        jsx: "<>a{s}<b>c</b>{s}</>",
        props: { s: "S" },
      },
    ]);
    expect(expectedNodes(root!)).toEqual(html("aS<b>c</b>S"));
  });

  it("renders bound attributes by their rules: absent for nullish, booleans by kind", () => {
    expect(
      rendered(
        "{ s, n, t, f, nothing }: { s: string; n: number; t: boolean; f: boolean; nothing: string | null }",
        "<p title={s} data-n={n} data-u={nothing} aria-hidden={t} aria-expanded={f} draggable={f}><input disabled={t} required={f} tabindex={n} /></p>",
        { s: "", n: 0, t: true, f: false, nothing: null },
      ),
    ).toEqual(
      html(
        '<p title="" data-n="0" aria-hidden="true" aria-expanded="false" draggable="false"><input disabled tabindex="0"></p>',
      ),
    );
  });

  it("renders a class as the union of its parts, and none when that is empty", () => {
    const params = "{ on, off, d, e }: { on: boolean; off: boolean; d: string; e: string | null }";
    expect(
      rendered(params, '<p class={["a", on && "b", { c: off, "d-e": on }, d, e]}>x</p>', {
        on: true,
        off: false,
        d: " p  q ",
        e: null,
      }),
    ).toEqual(html('<p class="a b d-e p q">x</p>'));
    // Order and spacing are no difference; an empty class is no class.
    expect(
      rendered(params, '<p class={[off && "b", { c: off }, e]}>x</p>', {
        on: true,
        off: false,
        d: "",
        e: null,
      }),
    ).toEqual(html('<p class="">x</p>'));
    expect(html('<p class="">x</p>')).toEqual(html("<p>x</p>"));
    // A negative: a token that is missing is a difference.
    expect(
      rendered(params, "<p class={d}>x</p>", { on: true, off: false, d: "a b", e: null }),
    ).not.toEqual(html('<p class="a">x</p>'));
  });

  it("renders a style's present declarations in any order, and none when none is", () => {
    const params =
      "{ c, gap, h, absent, e }: { c: string; gap: string; h: number; absent?: string; e: string }";
    expect(
      rendered(
        params,
        '<p style={{ color: c, "--gap": gap, lineHeight: h, marginTop: absent, paddingLeft: e, zIndex: 2 }}>x</p>',
        { c: "red", gap: "1px", h: 1.5, e: "" },
      ),
    ).toEqual(html('<p style="z-index:2;line-height:1.5;--gap:1px;color:red">x</p>'));
    expect(
      rendered(params, "<p style={{ marginTop: absent, color: e }}>x</p>", {
        c: "",
        gap: "",
        h: 0,
        e: "",
      }),
    ).toEqual(html("<p>x</p>"));
    // A negative: a declaration's value is no formatting.
    expect(
      rendered(params, "<p style={{ color: c }}>x</p>", { c: "red", gap: "", h: 0, e: "" }),
    ).not.toEqual(html('<p style="color: blue">x</p>'));
  });

  it("renders a spread's declared keys only, its class merged with the element's", () => {
    expect(
      rendered(
        '{ attrs, absent }: { attrs: { title?: string; "data-x"?: string; class?: string }; absent?: { title?: string } }',
        '<div><p {...attrs} class="a">x</p><p {...absent}>y</p></div>',
        { attrs: { title: "t", class: "b", "data-y": "never" } },
      ),
    ).toEqual(html('<div><p title="t" class="a b">x</p><p>y</p></div>'));
  });

  it("renders SVG with SVG's names", () => {
    expect(
      rendered(
        "{ r }: { r: number }",
        '<svg viewBox="0 0 2 2"><linearGradient id="g" gradientUnits="userSpaceOnUse"><stop offset="0" /></linearGradient><circle r={r} /></svg>',
        { r: 1 },
      ),
    ).toEqual(
      html(
        '<svg viewBox="0 0 2 2"><linearGradient id="g" gradientUnits="userSpaceOnUse"><stop offset="0"/></linearGradient><circle r="1"/></svg>',
      ),
    );
  });

  it("gives an absent or undefined prop its default, and keeps null", () => {
    const params = '{ a = "d", b = "d", c = null }: { a?: string; b?: string; c?: string | null }';
    const jsx = '<p>{a}|{b}|{c ?? "null"}</p>';
    expect(rendered(params, jsx, { b: undefined })).toEqual(html("<p>d|d|null</p>"));
    expect(rendered(params, jsx, { a: "x", c: "y" })).toEqual(html("<p>x|d|y</p>"));
  });

  it("reads props through the object, in the object form", () => {
    expect(
      rendered("props: { s: string; o?: string }", "<p title={props.s}>{props.o ?? props.s}</p>", {
        s: "x",
      }),
    ).toEqual(html('<p title="x">x</p>'));
  });

  it("evaluates the names the source declares, not the references the analyser resolved", () => {
    const [parityCase] = sourceCases([
      { name: "a case", params: "{ s }: { s: string }", jsx: "<p>{s}</p>", props: { s: "x" } },
    ]);
    const component = structuredClone(parityCase!.lowered!.component);
    // References the analyser lost would mislead every target, but not the evaluator.
    const [interpolation] = (component.render as ElementNode).children as [InterpolationNode];
    interpolation.value.refs = [];
    expect(domNodesOf(instantiate(component, { s: "x" }))).toEqual(html("<p>x</p>"));
  });

  // Values outside the contract (ADR-0035): a case holding one would test nothing.
  it.each([
    ["a boolean as text", "{ v }: { v: string }", "<p>{JSON.parse(v)}</p>", { v: "true" }],
    ["NaN alone", "{ v }: { v: number }", "<p>{v}</p>", { v: Number.NaN }],
    ["NaN beside text", "{ v }: { v: number }", "<p>a {v} b</p>", { v: Number.NaN }],
    ["Infinity as text", "{ v }: { v: number }", "<p>{v}x</p>", { v: Number.POSITIVE_INFINITY }],
    [
      "a repeated key",
      "{ xs }: { xs: string[] }",
      "<ul>{xs.map((x) => <li key={x}>{x}</li>)}</ul>",
      { xs: ["a", "a"] },
    ],
    [
      "a sparse list",
      "{ xs }: { xs: string[] }",
      "<ul>{xs.map((x, i) => <li key={i}>{x}</li>)}</ul>",
      { xs: sparse() },
    ],
    ["a repeated class token", "{ c }: { c: string }", '<p class={["a", c]}>x</p>', { c: "a" }],
    [
      "a javascript: URL",
      "{ u }: { u: string }",
      "<a href={u}>x</a>",
      { u: "javascript:alert(1)" },
    ],
    ["an empty URL", "{ u }: { u: string }", "<a href={u}>x</a>", { u: "" }],
    [
      "a number out of its range",
      "{ n }: { n: number }",
      "<textarea rows={n}>x</textarea>",
      { n: 0 },
    ],
    [
      "a non-finite attribute",
      "{ n }: { n: number }",
      "<p data-x={n}>x</p>",
      { n: Number.POSITIVE_INFINITY },
    ],
    [
      "a semicolon in a style value",
      "{ c }: { c: string }",
      "<p style={{ color: c }}>x</p>",
      { c: "red; x: y" },
    ],
  ])("refuses %s", (_, params, jsx, props) => {
    expect(() => rendered(params, jsx, props as Record<string, unknown>)).toThrow(
      /outside the contract|repeats a class/,
    );
  });
});

// The markup cases (./markup-cases.ts) are trees with props and the HTML each must render, written
// by hand from the rules of ADR-0034 to ADR-0040, apart from the reference: it must read the
// rules as they do.
describe("instantiate, on the markup cases", () => {
  it.each(MARKUP_CASES.map((each) => [each.name, each] as const))("renders %s", (_, each) => {
    const built = markupSuite([each]);
    const tree = instantiate(built.component, passedProps(built.props));
    expect(tree.kind === "Element" && tree.tag).toBe("div");
    const [root] = domNodesOf(tree) as DomElement[];
    expect(root!.children).toEqual(parseHtml(each.expected));
  });

  it.each(ROOT_CASES.map((each) => [each.name, each] as const))("renders %s", (_, each) => {
    const built = markupSuite([each], "self");
    expect(domNodesOf(instantiate(built.component, passedProps(built.props)))).toEqual(
      parseHtml(each.expected),
    );
  });
});
