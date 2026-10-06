// The whitespace rule checked against Chromium's own layout: two fragments the normaliser calls
// equal must render identically (no element moves, the rendered text is the same), and two it
// calls different must render differently. This is the rule's ground truth.
import { afterEach, describe, expect, it } from "vitest";

import { normalizeHtml } from "../src/normalize/index.ts";

/** Every element's box, relative to the container, and the rendered text (`innerText`). */
function layout(html: string): string {
  const root = document.createElement("div");
  root.style.cssText =
    "position: absolute; top: 0; left: 0; width: 480px; font: 16px/1.5 monospace";
  root.innerHTML = html;
  document.body.append(root);
  const origin = root.getBoundingClientRect();
  const boxes = Array.from(root.querySelectorAll("*"), (element) => {
    const box = element.getBoundingClientRect();
    return `${element.localName} ${box.x - origin.x},${box.y - origin.y} ${box.width}x${box.height}`;
  });
  const text = root.innerText;
  root.remove();
  return JSON.stringify({ boxes, text });
}

afterEach(() => {
  document.body.replaceChildren();
});

const SAME: readonly (readonly [string, string, string])[] = [
  [
    "Svelte's spaces between blocks",
    "<section><h2>Title</h2> <p>x</p> <p>y</p></section>",
    "<section><h2>Title</h2><p>x</p><p>y</p></section>",
  ],
  ["Vue's condensed paragraph", "<p>\n  Line one<br>Line two\n</p>", "<p>Line one<br>Line two</p>"],
  ["spaces around <br>", "<p>a <br> b</p>", "<p>a<br>b</p>"],
  [
    "indented list items",
    "<ul>\n  <li>a</li>\n  <li>b</li>\n</ul>",
    "<ul><li>a</li><li>b</li></ul>",
  ],
  [
    "indented table parts",
    "<table> <tbody> <tr> <td> x </td> <td>y</td> </tr> </tbody> </table>",
    "<table><tbody><tr><td>x</td><td>y</td></tr></tbody></table>",
  ],
  ["spaces inside a button", "<p><button> Save </button></p>", "<p><button>Save</button></p>"],
  [
    "spaces between flex items",
    '<div style="display: flex"> <span>a</span> <span>b</span> </div>',
    '<div style="display: flex"><span>a</span><span>b</span></div>',
  ],
  ["a space collapsed into an inline element", "<p>a <b> b</b></p>", "<p>a <b>b</b></p>"],
  ["a trailing space inside an inline element", "<p><b>a </b></p>", "<p><b>a</b></p>"],
  ["a run of whitespace between words", "<p>a \n\t b</p>", "<p>a b</p>"],
  ["a space around an empty inline", "<p>a <span></span> b</p>", "<p>a <span></span>b</p>"],
  [
    "a space between an inline and a block",
    "<div><span>a</span> <div>b</div></div>",
    "<div><span>a</span><div>b</div></div>",
  ],
  [
    "a line break after a zero-width space, and none",
    "<p>aaa\u200b\nbbb</p>",
    "<p>aaa\u200bbbb</p>",
  ],
  [
    "a line break before a zero-width space, and none",
    "<p>aaa\n\u200bbbb</p>",
    "<p>aaa\u200bbbb</p>",
  ],
  ["a line break after a <wbr>, and none", "<p>aaa<wbr>\nbbb</p>", "<p>aaa<wbr>bbb</p>"],
  ["a line break before a <wbr>, and a space", "<p>aaa\n<wbr>bbb</p>", "<p>aaa <wbr>bbb</p>"],
  [
    "spaces on both sides of a float, and one",
    '<div>a <div style="float: left">x</div> b</div>',
    '<div>a <div style="float: left">x</div>b</div>',
  ],
  [
    "a space after an absolutely positioned box at the start of a line, and none",
    '<div><span style="position: absolute">x</span> b</div>',
    '<div><span style="position: absolute">x</span>b</div>',
  ],
  [
    "a whitespace-only text after text ending in whitespace, which Chromium does not render",
    "<div>a\u200b <b>\n<span>x</span></b></div>",
    "<div>a\u200b <b><span>x</span></b></div>",
  ],
  ["a space collapsed into a ruby", "<p>a <ruby> b</ruby></p>", "<p>a <ruby>b</ruby></p>"],
  [
    "a whitespace-only text after a <br> in a ruby, which Chromium does not render",
    "<div><ruby>a<br> </ruby>b</div>",
    "<div><ruby>a<br></ruby>b</div>",
  ],
  [
    "a line break after a zero-width space and a ruby's edge, and a space",
    "<div>dd\u200b<ruby>\na</ruby></div>",
    "<div>dd\u200b<ruby> a</ruby></div>",
  ],
  [
    "a space after a list item's marker in a ruby, and none",
    "<div><ruby>a<li> b</li></ruby></div>",
    "<div><ruby>a<li>b</li></ruby></div>",
  ],
  [
    "a line break after a zero-width space and an <rt> outside a ruby, and none",
    "<div>dd\u200b<rt>\na</rt></div>",
    "<div>dd\u200b<rt>a</rt></div>",
  ],
  [
    "a line break after a zero-width space and a bidi isolate's edge, and a space",
    "<div>dd\u200b<bdi>\na</bdi></div>",
    "<div>dd\u200b<bdi> a</bdi></div>",
  ],
  [
    "a space in a block whose display Chromium rejects, and none",
    '<div>a<div style="display: run-in"> b</div></div>',
    '<div>a<div style="display: run-in">b</div></div>',
  ],
  [
    "a line break after a zero-width space and an annotation's start, and none",
    "<div><ruby>dd\u200b<rt>\na</rt></ruby></div>",
    "<div><ruby>dd\u200b<rt>a</rt></ruby></div>",
  ],
  [
    "a line break after a zero-width space and the start of an annotation in a ruby container, and none",
    '<div><span style="display: ruby">dd\u200b<span style="display: contents"><span style="display: ruby-text">\na</span></span></span></div>',
    '<div><span style="display: ruby">dd\u200b<span style="display: contents"><span style="display: ruby-text">a</span></span></span></div>',
  ],
  [
    "a line break after a zero-width space and an annotation outside a ruby, in an anonymous one, and a space",
    '<div>dd\u200b<span style="display: ruby-text">\na</span></div>',
    '<div>dd\u200b<span style="display: ruby-text"> a</span></div>',
  ],
  [
    "a line break after a zero-width space and an <rt> in a ruby that is no ruby container, and a space",
    '<div><ruby style="display: inline">dd\u200b<rt>\na</rt></ruby></div>',
    '<div><ruby style="display: inline">dd\u200b<rt> a</rt></ruby></div>',
  ],
  [
    "spaces around a table cell in a block container, an anonymous block-level table",
    '<div>a <span style="display: table-cell">b</span> c</div>',
    '<div>a<span style="display: table-cell">b</span>c</div>',
  ],
  [
    "a space between two table cells in a block container, in one anonymous table",
    '<div><span style="display: table-cell">a</span> <span style="display: table-cell">b</span></div>',
    '<div><span style="display: table-cell">a</span><span style="display: table-cell">b</span></div>',
  ],
];

const DIFFERENT: readonly (readonly [string, string, string])[] = [
  [
    "a space between two images",
    "<p><img width=10 height=10> <img width=10 height=10></p>",
    "<p><img width=10 height=10><img width=10 height=10></p>",
  ],
  [
    "a space between a label and an input",
    "<p><label>Note</label>\n<input></p>",
    "<p><label>Note</label><input></p>",
  ],
  ["a space before an inline element", "<p>a <b>b</b></p>", "<p>a<b>b</b></p>"],
  ["a space inside rather than before an inline element", "<p>a<b> b</b></p>", "<p>a <b>b</b></p>"],
  [
    "a space between inline siblings",
    "<p><span>a</span> <span>b</span></p>",
    "<p><span>a</span><span>b</span></p>",
  ],
  [
    "spaces around an inline-block",
    "<p>x <button>Save</button> y</p>",
    "<p>x<button>Save</button>y</p>",
  ],
  ["indentation inside <pre>", "<pre>a\n  b</pre>", "<pre>a\nb</pre>"],
  [
    "spaces under white-space: pre-wrap",
    '<p style="white-space: pre-wrap">a  b</p>',
    '<p style="white-space: pre-wrap">a b</p>',
  ],
  ["a space inside a <q>, after its opening quote", "<p><q> hello</q></p>", "<p><q>hello</q></p>"],
  ["a space inside a <q>, before its closing quote", "<p><q>hello </q></p>", "<p><q>hello</q></p>"],
  ["a line break after a <wbr>, and a space", "<p>aaa<wbr>\nbbb</p>", "<p>aaa<wbr> bbb</p>"],
  [
    "a line break after a zero-width space, and a space",
    "<p>aaa\u200b\nbbb</p>",
    "<p>aaa\u200b bbb</p>",
  ],
  [
    "a space before a float, and none",
    '<div>a <div style="float: left">x</div>b</div>',
    '<div>a<div style="float: left">x</div>b</div>',
  ],
  [
    "a line break and spaces after a preserved space",
    '<p><span style="white-space: break-spaces">a\n </span>\nbb</p>',
    '<p><span style="white-space: break-spaces">a\n </span>  bb</p>',
  ],
  [
    "a line break after a zero-width space and a space, ending them, and a space",
    "<div>a\u200b <b>\nx</b></div>",
    "<div>a\u200b <b>x</b></div>",
  ],
  [
    "a space after a removed line break, which Chromium does not render, and one it does",
    '<div><q>a\u200b\n<span style="position: absolute"></span> </q></div>',
    '<div><q>a\u200b<span style="position: absolute"></span> </q></div>',
  ],
  [
    "a line break in a table, after a whitespace-only text it does not render, and none",
    '<div><span style="display: inline-table"><span style="display: inline-flex"></span> <span>\na</span></span></div>',
    '<div><span style="display: inline-table"><span style="display: inline-flex"></span> <span>a</span></span></div>',
  ],
  [
    "a space after a quotation mark in a flex item, and none",
    '<div><span style="display: inline-flex"><q> </q></span></div>',
    '<div><span style="display: inline-flex"><q></q></span></div>',
  ],
  [
    "a space after a ruby holding a <br>, which does not end the line, and none",
    "<p><ruby>漢<rt>kan</rt><br></ruby> and more</p>",
    "<p><ruby>漢<rt>kan</rt><br></ruby>and more</p>",
  ],
  [
    "a space after a block in a ruby, which inlinifies it, and none",
    "<div><ruby><div>x</div> b</ruby></div>",
    "<div><ruby><div>x</div>b</ruby></div>",
  ],
  [
    "a space before a float in a ruby, which inlinifies it, and none",
    '<div><ruby>a <span style="float: left"></span></ruby></div>',
    '<div><ruby>a<span style="float: left"></span></ruby></div>',
  ],
  [
    "a space after a preserved line break in a ruby, which does not end the line, and none",
    '<div><ruby>a<span style="white-space: pre">\n</span> b</ruby></div>',
    '<div><ruby>a<span style="white-space: pre">\n</span>b</ruby></div>',
  ],
  [
    "a line break after a zero-width space and a ruby's edge, and none",
    "<div><ruby>dd\u200b</ruby>\na</div>",
    "<div><ruby>dd\u200b</ruby>a</div>",
  ],
  [
    "a line break after a zero-width space and the edge of an element with dir, and none",
    '<div><span dir="ltr">dd\u200b</span>\na</div>',
    '<div><span dir="ltr">dd\u200b</span>a</div>',
  ],
  [
    "whitespace that collapses away before a ruby, keeping its annotation off the space, and none",
    "<div><b>x </b> <ruby>a<rt>aaa</rt></ruby></div>",
    "<div><b>x </b><ruby>a<rt>aaa</rt></ruby></div>",
  ],
  [
    "a space at the end of a list item in a ruby, and one after it",
    "<div><ruby>a<li>b </li> c</ruby></div>",
    "<div><ruby>a<li>b</li> c</ruby></div>",
  ],
  [
    "a space inside an HTML element with display: math, which is an inline there, and none",
    '<p>a<span style="display: math"> b</span></p>',
    '<p>a<span style="display: math">b</span></p>',
  ],
  [
    "a line break after a zero-width space and an annotation's start, and a space",
    "<div><ruby>dd\u200b<rt>\na</rt></ruby></div>",
    "<div><ruby>dd\u200b<rt> a</rt></ruby></div>",
  ],
  [
    "a space at the start of a block ruby in a ruby, which inlinifies it as an inline ruby, and none",
    '<div><ruby>a<ruby style="display: block ruby"> b</ruby></ruby></div>',
    '<div><ruby>a<ruby style="display: block ruby">b</ruby></ruby></div>',
  ],
  [
    "a space at the end of a block ruby in a ruby, which inlinifies it as an inline ruby, and none",
    '<div><ruby><ruby style="display: block ruby">a </ruby>b</ruby></div>',
    '<div><ruby><ruby style="display: block ruby">a</ruby>b</ruby></div>',
  ],
  [
    "a line break after a zero-width space and an annotation outside a ruby, in an anonymous one, and none",
    '<div>dd\u200b<span style="display: ruby-text">\na</span></div>',
    '<div>dd\u200b<span style="display: ruby-text">a</span></div>',
  ],
  [
    "a line break after a zero-width space and an <rt> in a ruby that is no ruby container, and none",
    '<div><ruby style="display: inline">dd\u200b<rt>\na</rt></ruby></div>',
    '<div><ruby style="display: inline">dd\u200b<rt>a</rt></ruby></div>',
  ],
  [
    "a line break after a zero-width space and an annotation in an inline in a ruby, and none",
    '<div><ruby><span>dd\u200b<span style="display: ruby-text">\na</span></span></ruby></div>',
    '<div><ruby><span>dd\u200b<span style="display: ruby-text">a</span></span></ruby></div>',
  ],
  [
    "a line break and a line break after a zero-width space and an annotation outside a ruby, and a space",
    '<div>dd\u200b\n<span style="display: ruby-text">\nccc</span></div>',
    '<div>dd\u200b <span style="display: ruby-text">\nccc</span></div>',
  ],
  [
    "spaces around a table cell in an inline box, an anonymous inline table, and none",
    '<p><span>a <span style="display: table-cell">b</span> c</span></p>',
    '<p><span>a<span style="display: table-cell">b</span>c</span></p>',
  ],
  [
    "a space between inlines in a table row a flex container blockifies, and none",
    '<div style="display: flex"><span style="display: table-row"><b>a</b> <b>b</b></span></div>',
    '<div style="display: flex"><span style="display: table-row"><b>a</b><b>b</b></span></div>',
  ],
  [
    "a tab after a <wbr> beside a table row in a blockified ruby, and a line break",
    '<div style="display: flex"><ruby><span style="display: table-row">a</span>\n<wbr>\tb</ruby></div>',
    '<div style="display: flex"><ruby><span style="display: table-row">a</span>\n<wbr>\nb</ruby></div>',
  ],
];

describe("rule 6 against Chromium's layout", () => {
  it.each(SAME)("renders %s identically, and normalises them equal", (_, a, b) => {
    expect(layout(a)).toBe(layout(b));
    expect(normalizeHtml(a)).toBe(normalizeHtml(b));
  });

  it.each(DIFFERENT)("renders %s differently, and keeps them different", (_, a, b) => {
    expect(layout(a)).not.toBe(layout(b));
    expect(normalizeHtml(a)).not.toBe(normalizeHtml(b));
  });
});

/** A seeded pseudo-random generator (mulberry32), so a failure reproduces from its seed. */
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

/** Whitespace a framework or a formatter may write between two pieces of markup. */
const SPACES = ["", "", " ", "  ", "\n", "\n  ", " \n", "\t"];

/** Words, some with a zero-width space, next to which a line break is removed. */
const WORDS = ["a", "bb", "ccc", "a\u200Bb", "dd\u200B"];

/**
 * What a fragment is built from: inline, atomic, block, flex, table, `display: contents` and
 * out-of-flow boxes, list items, rubies and their annotations (in a ruby container or not),
 * bidi isolates, quotation marks, preserved whitespace, line breaks and break opportunities,
 * and table-internal boxes, which a bound `display` puts anywhere (M1): inside a table, or in
 * an anonymous one. Stylesheets are out of scope: the rule reads inline styles only
 * (display.ts).
 */
const ELEMENTS = [
  "<span>",
  "<b>",
  "<q>",
  '<span style="display: contents">',
  '<span style="display: inline-block">',
  "<div>",
  "<p>",
  '<div style="display: flex">',
  '<span style="float: left">',
  '<span style="position: absolute">',
  "<li>",
  "<ruby>",
  '<ruby style="display: inline">',
  '<ruby style="display: block ruby">',
  '<span style="display: ruby">',
  "<rt>",
  '<span style="display: ruby-text">',
  "<rp>",
  "<bdi>",
  '<span dir="rtl">',
  '<span style="white-space: pre">',
  '<span style="white-space: pre-line">',
  '<span style="white-space: break-spaces">',
  '<span style="white-space: pre-wrap">',
  '<span style="display: inline-table">',
  '<span style="display: inline-flex">',
  '<span style="display: table-cell">',
  '<span style="display: table-row">',
  '<span style="display: table-row-group">',
  '<span style="display: table-caption">',
  '<span style="display: table-column">',
  "<br>",
  "<wbr>",
  '<img width="8" height="8">',
] as const;

const VOID = new Set(["br", "wbr", "img"]);

/**
 * Whether the parser keeps an element where it is, inside these ancestors (innermost last),
 * rather than repairing the markup: a `<p>` closes at a block, an `<li>` at another `<li>`,
 * and an `<rt>` or `<rp>` closes everything up to the ruby around it.
 */
function fits(tag: string, ancestors: readonly string[]): boolean {
  if (ancestors.includes("p") && ["div", "p", "li"].includes(tag)) return false;
  if (ancestors.includes("li") && tag === "li") return false;
  if ((tag === "rt" || tag === "rp") && ancestors.includes("ruby")) {
    return ancestors.at(-1) === "ruby";
  }
  return true;
}

/** A fragment: whitespace slots, words and elements, so two renders differ in whitespace only. */
type Item =
  | { kind: "slot"; id: number }
  | { kind: "word"; word: string }
  | { kind: "element"; open: string; tag: string; children: Item[] };

function fragment(next: () => number): { items: Item[]; slots: number } {
  let slots = 0;
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!;
  const level = (depth: number, ancestors: readonly string[]): Item[] => {
    const items: Item[] = [];
    for (let count = 1 + Math.floor(next() * 4); count > 0; count -= 1) {
      items.push({ kind: "slot", id: slots++ });
      const open = depth > 2 || next() < 0.3 ? undefined : pick(ELEMENTS);
      const tag = open === undefined ? undefined : /^<([a-z]+)/.exec(open)?.[1];
      if (open === undefined || tag === undefined || !fits(tag, ancestors)) {
        items.push({ kind: "word", word: pick(WORDS) });
        continue;
      }
      const children = VOID.has(tag) ? [] : level(depth + 1, [...ancestors, tag]);
      if (!VOID.has(tag)) children.push({ kind: "slot", id: slots++ });
      items.push({ kind: "element", open, tag, children });
    }
    items.push({ kind: "slot", id: slots++ });
    return items;
  };
  return { items: level(0, []), slots };
}

function render(items: readonly Item[], spaces: readonly string[]): string {
  return items
    .map((item) => {
      if (item.kind === "slot") return spaces[item.id]!;
      if (item.kind === "word") return item.word;
      if (VOID.has(item.tag)) return item.open;
      return `${item.open}${render(item.children, spaces)}</${item.tag}>`;
    })
    .join("");
}

describe("rule 6 against Chromium's layout, fuzzed", () => {
  it("never calls two fragments equal that Chromium lays out differently", () => {
    const falseEquals: string[] = [];
    let equal = 0;
    for (let seed = 1; seed <= 20_000; seed += 1) {
      const next = random(seed);
      const { items, slots } = fragment(next);
      const spaces = Array.from(
        { length: slots },
        () => SPACES[Math.floor(next() * SPACES.length)]!,
      );
      const changed = [...spaces];
      for (let edits = 1 + Math.floor(next() * 2); edits > 0; edits -= 1) {
        changed[Math.floor(next() * slots)] = SPACES[Math.floor(next() * SPACES.length)]!;
      }
      const a = `<div>${render(items, spaces)}</div>`;
      const b = `<div>${render(items, changed)}</div>`;
      if (a === b || normalizeHtml(a) !== normalizeHtml(b)) continue;
      equal += 1;
      if (layout(a) !== layout(b)) {
        falseEquals.push(`seed ${seed}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
      }
    }
    // The fuzz has to exercise the rule: thousands of pairs it equates, each laid out twice.
    expect(equal).toBeGreaterThan(5_000);
    expect(falseEquals).toEqual([]);
  }, 120_000);
});
