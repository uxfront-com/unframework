import { describe, expect, it } from "vitest";

import { normalizeHtml } from "../src/normalize/index.ts";
import { printTree } from "../src/normalize/print.ts";
import { collapseWhitespace } from "../src/normalize/rules/whitespace.ts";
import { parseHtml } from "../src/normalize/tree.ts";

/** Applies only the whitespace rule. */
function collapse(html: string): string {
  const root = parseHtml(html);
  collapseWhitespace(root);
  return printTree(root);
}

/** The canonical text, one line per array entry. */
const lines = (...text: string[]) => `${text.join("\n")}\n`;

describe("rule 6: collapseWhitespace, inside a line", () => {
  it("collapses runs of spaces, tabs and line breaks to one space", () => {
    expect(collapse("<p>a  \t\n  b</p>")).toBe(lines("<p>", '  "a b"', "</p>"));
  });

  it("turns a line break between words into a space, never into nothing", () => {
    expect(collapse("<p>a\nb</p>")).toBe(collapse("<p>a b</p>"));
    expect(collapse("<p>a\nb</p>")).not.toBe(collapse("<p>ab</p>"));
  });

  it("collapses spaces across inline element boundaries, keeping the first", () => {
    expect(collapse("<p>a <b> b</b></p>")).toBe(
      lines("<p>", '  "a "', "  <b>", '    "b"', "  </b>", "</p>"),
    );
    expect(collapse("<p>a <span></span> b</p>")).toBe(
      lines("<p>", '  "a "', "  <span></span>", '  "b"', "</p>"),
    );
  });

  it("keeps a real difference in inline spacing", () => {
    expect(normalizeHtml("a <b>b</b>")).not.toBe(normalizeHtml("a<b>b</b>"));
    expect(normalizeHtml("<p>a <b>b</b></p>")).not.toBe(normalizeHtml("<p>a<b> b</b></p>"));
    expect(normalizeHtml("<span>a</span> <span>b</span>")).not.toBe(
      normalizeHtml("<span>a</span><span>b</span>"),
    );
  });

  it("keeps the space between inline siblings", () => {
    expect(collapse("<p><span>a</span>\n  <span>b</span></p>")).toBe(
      lines(
        "<p>",
        "  <span>",
        '    "a"',
        "  </span>",
        '  " "',
        "  <span>",
        '    "b"',
        "  </span>",
        "</p>",
      ),
    );
  });

  it("does not collapse a no-break space", () => {
    expect(collapse("<p>a&nbsp; b</p>")).toBe(lines("<p>", '  "a\\u00a0 b"', "</p>"));
    expect(normalizeHtml("<p>a&nbsp;b</p>")).not.toBe(normalizeHtml("<p>a b</p>"));
  });

  it("keeps spaces next to an atomic inline, which is content", () => {
    expect(collapse("<p>a <img> b</p>")).toBe(lines("<p>", '  "a "', "  <img>", '  " b"', "</p>"));
    expect(normalizeHtml("<p><img> <input></p>")).not.toBe(normalizeHtml("<p><img><input></p>"));
    expect(normalizeHtml("<p><label>Note</label>\n<input></p>")).not.toBe(
      normalizeHtml("<p><label>Note</label><input></p>"),
    );
  });

  it("keeps a space inside a <q>, next to the quotation mark it generates", () => {
    expect(normalizeHtml("<p><q> hello</q></p>")).not.toBe(normalizeHtml("<p><q>hello</q></p>"));
    expect(normalizeHtml("<p><q>hello </q></p>")).not.toBe(normalizeHtml("<p><q>hello</q></p>"));
    expect(normalizeHtml("<p>a <q> b</q></p>")).not.toBe(normalizeHtml("<p>a <q>b</q></p>"));
  });

  it("removes a line break next to a zero-width space instead of rendering a space", () => {
    const zwsp = "\u200b";
    expect(normalizeHtml(`<p>a${zwsp}\nb</p>`)).toBe(normalizeHtml(`<p>a${zwsp}b</p>`));
    expect(normalizeHtml(`<p>a\n${zwsp}b</p>`)).toBe(normalizeHtml(`<p>a${zwsp}b</p>`));
    expect(normalizeHtml(`<p>a \n <b>${zwsp}b</b></p>`)).toBe(
      normalizeHtml(`<p>a<b>${zwsp}b</b></p>`),
    );
    expect(normalizeHtml(`<p>a${zwsp}\nb</p>`)).not.toBe(normalizeHtml(`<p>a${zwsp} b</p>`));
    // A space without a line break is still a space.
    expect(normalizeHtml(`<p>a${zwsp}  b</p>`)).toBe(normalizeHtml(`<p>a${zwsp} b</p>`));
  });

  it("does not remove a line break next to a zero-width space across a bidi isolate's edge", () => {
    for (const isolate of ["bdi", "bdo", "output", 'span dir="auto"']) {
      const tag = isolate.split(" ")[0];
      expect(normalizeHtml(`<p>a\u200b<${isolate}>\nb</${tag}></p>`)).toBe(
        normalizeHtml(`<p>a\u200b<${isolate}> b</${tag}></p>`),
      );
    }
    expect(normalizeHtml('<p>a\u200b<span dir="up">\nb</span></p>')).toBe(
      normalizeHtml('<p>a\u200b<span dir="up">b</span></p>'),
    );
    expect(normalizeHtml('<p>a\u200b<span style="unicode-bidi: embed">\nb</span></p>')).not.toBe(
      normalizeHtml('<p>a\u200b<span style="unicode-bidi: embed">b</span></p>'),
    );
    expect(normalizeHtml('<p>a\u200b<bdi style="unicode-bidi: normal">\nb</bdi></p>')).toBe(
      normalizeHtml('<p>a\u200b<bdi style="unicode-bidi: normal">b</bdi></p>'),
    );
  });

  it("removes a line break after a <wbr>, but not one before it", () => {
    expect(normalizeHtml("<p>a<wbr>\nb</p>")).toBe(normalizeHtml("<p>a<wbr>b</p>"));
    expect(normalizeHtml("<p>a<wbr> \n b</p>")).toBe(normalizeHtml("<p>a<wbr>b</p>"));
    expect(normalizeHtml("<p>a<wbr>\nb</p>")).not.toBe(normalizeHtml("<p>a<wbr> b</p>"));
    expect(normalizeHtml("<p>a\n<wbr>b</p>")).toBe(normalizeHtml("<p>a <wbr>b</p>"));
  });

  it("keeps a removed line break's earlier space when only a whitespace-only text removed it", () => {
    const zwsp = "\u200b";
    // Chromium puts that space back as soon as more content follows on the line.
    expect(normalizeHtml(`<p>a${zwsp} <b>\n<span>x</span></b></p>`)).toBe(
      normalizeHtml(`<p>a${zwsp} <b><span>x</span></b></p>`),
    );
    // A text with glyphs after the line break removes it for good.
    expect(normalizeHtml(`<p>a${zwsp} <b>\nx</b></p>`)).toBe(
      normalizeHtml(`<p>a${zwsp}<b>x</b></p>`),
    );
  });

  it("renders no whitespace-only text where Chromium makes no box for it", () => {
    const zwsp = "\u200b";
    // After a text that ends in whitespace, even whitespace the zero-width space removed.
    expect(normalizeHtml(`<p>a${zwsp}\n<i></i> b</p>`)).not.toBe(
      normalizeHtml(`<p>a${zwsp}\n<i></i>b</p>`),
    );
    expect(normalizeHtml(`<p><q>a${zwsp}\n<span style="float: left"></span> </q></p>`)).toBe(
      normalizeHtml(`<p><q>a${zwsp}<span style="float: left"></span></q></p>`),
    );
    // In a table or a flex container, anywhere but after text.
    const table = (inside: string) =>
      normalizeHtml(`<p><span style="display: inline-table"><img> ${inside}</span></p>`);
    expect(table("<b>\na</b>")).not.toBe(table("<b>a</b>"));
    // After a <wbr>, which lays out as an empty text, it renders.
    expect(
      normalizeHtml('<p><span style="display: inline-table">a<wbr>\t<img></span></p>'),
    ).not.toBe(normalizeHtml('<p><span style="display: inline-table">a<wbr><img></span></p>'));
  });

  it("collapses whitespace across a float or an absolutely positioned box", () => {
    for (const style of ["float: left", "float: right", "position: absolute", "position: fixed"]) {
      const box = `<div style="${style}">x</div>`;
      expect(normalizeHtml(`<div>a ${box} b</div>`)).toBe(normalizeHtml(`<div>a ${box}b</div>`));
      expect(normalizeHtml(`<div>a ${box}b</div>`)).not.toBe(normalizeHtml(`<div>a${box}b</div>`));
      expect(normalizeHtml(`<div>${box} b</div>`)).toBe(normalizeHtml(`<div>${box}b</div>`));
    }
    // display: none wins over float: the box is not rendered at all.
    expect(collapse('<p>a <span style="display: none; float: left"> x </span> b</p>')).toContain(
      '"x"',
    );
  });

  it("drops a space that follows a display: none element's collapsed neighbour", () => {
    expect(collapse('<p>a <input type="hidden"> b</p>')).toBe(
      lines("<p>", '  "a "', '  <input type="hidden">', '  "b"', "</p>"),
    );
    expect(collapse("<p>a <span hidden> x </span> b</p>")).toBe(
      lines("<p>", '  "a "', '  <span hidden="">', '    "x"', "  </span>", '  "b"', "</p>"),
    );
  });
});

describe("rule 6: collapseWhitespace, at the start and end of lines", () => {
  it("trims a block's inline content", () => {
    expect(collapse("<p>  x  </p>")).toBe(lines("<p>", '  "x"', "</p>"));
    expect(collapse("<p> </p>")).toBe(lines("<p></p>"));
  });

  it("trims the fragment, which renders in a block container", () => {
    expect(collapse("  hello  ")).toBe(lines('"hello"'));
  });

  it("trims across inline boundaries at the edges of a block", () => {
    expect(collapse("<p><b> a </b></p>")).toBe(collapse("<p><b>a</b></p>"));
    expect(collapse("<p>a <b>b</b> </p>")).toBe(collapse("<p>a <b>b</b></p>"));
  });

  it("drops Svelte's single-space text between blocks", () => {
    expect(normalizeHtml("<section><h2>Title</h2> <p>x</p> <p>y</p></section>")).toBe(
      normalizeHtml("<section><h2>Title</h2><p>x</p><p>y</p></section>"),
    );
  });

  it("drops a space between an inline and a block sibling", () => {
    expect(collapse("<div><span>a</span> <div>b</div> <span>c</span></div>")).toBe(
      collapse("<div><span>a</span><div>b</div><span>c</span></div>"),
    );
  });

  it("makes Vue's condensed text equal React's", () => {
    expect(normalizeHtml("<p>\n  Line one<br>Line two\n</p>")).toBe(
      normalizeHtml("<p>Line one<br>Line two</p>"),
    );
  });

  it("drops spaces around a <br>, which ends a line", () => {
    expect(collapse("<p>a <br> b</p>")).toBe(collapse("<p>a<br>b</p>"));
    expect(collapse("<p><b>a </b><br> b</p>")).toBe(collapse("<p><b>a</b><br>b</p>"));
  });

  it("drops indentation between list items and table parts", () => {
    expect(normalizeHtml("<ul>\n  <li>a</li>\n  <li>b</li>\n</ul>")).toBe(
      normalizeHtml("<ul><li>a</li><li>b</li></ul>"),
    );
    expect(
      normalizeHtml("<table> <tbody> <tr> <td> x </td> <td>y</td> </tr> </tbody> </table>"),
    ).toBe(normalizeHtml("<table><tbody><tr><td>x</td><td>y</td></tr></tbody></table>"));
  });

  it("trims the content of an inline-block, which lays out on its own", () => {
    expect(normalizeHtml("<button> Save </button>")).toBe(normalizeHtml("<button>Save</button>"));
    expect(normalizeHtml("<p>x <button>Save</button> y</p>")).not.toBe(
      normalizeHtml("<p>x<button>Save</button>y</p>"),
    );
  });

  it("does not trim a space at a soft wrap, which depends on the viewport", () => {
    expect(collapse("<p>a b</p>")).toBe(lines("<p>", '  "a b"', "</p>"));
  });
});

describe("rule 6: collapseWhitespace, by display", () => {
  it("treats an inline display: block as a block", () => {
    expect(collapse('<p>a <span style="display: block"> b </span> c</p>')).toBe(
      lines(
        "<p>",
        '  "a"',
        '  <span style="display: block">',
        '    "b"',
        "  </span>",
        '  "c"',
        "</p>",
      ),
    );
  });

  it("treats an inline display: inline-block as atomic", () => {
    expect(collapse('<p>a <span style="display:inline-block"> b </span> c</p>')).toBe(
      lines(
        "<p>",
        '  "a "',
        '  <span style="display:inline-block">',
        '    "b"',
        "  </span>",
        '  " c"',
        "</p>",
      ),
    );
  });

  it("treats display: contents as transparent", () => {
    expect(collapse('<div><span style="display: contents"> a </span></div>')).toBe(
      collapse('<div><span style="display: contents">a</span></div>'),
    );
  });

  it("blockifies the children of a flex or grid container", () => {
    expect(normalizeHtml('<div style="display: flex"> <span>a</span> <span>b</span> </div>')).toBe(
      normalizeHtml('<div style="display: flex"><span>a</span><span>b</span></div>'),
    );
    expect(normalizeHtml('<div style="display: grid"> text <b>x</b></div>')).toBe(
      normalizeHtml('<div style="display: grid">text<b>x</b></div>'),
    );
    expect(normalizeHtml("<div> <span>a</span> <span>b</span> </div>")).not.toBe(
      normalizeHtml("<div><span>a</span><span>b</span></div>"),
    );
  });

  it("blockifies through a display: contents child of a flex container", () => {
    expect(
      normalizeHtml(
        '<div style="display:flex"><span style="display: contents"><i>a</i> <i>b</i></span></div>',
      ),
    ).toBe(
      normalizeHtml(
        '<div style="display:flex"><span style="display: contents"><i>a</i><i>b</i></span></div>',
      ),
    );
  });

  it("reads multi-keyword displays", () => {
    expect(collapse('<p>a <span style="display: inline flow-root"> b </span></p>')).toBe(
      lines(
        "<p>",
        '  "a "',
        '  <span style="display: inline flow-root">',
        '    "b"',
        "  </span>",
        "</p>",
      ),
    );
    expect(collapse('<p>a <span style="display: block flow"> b </span></p>')).toBe(
      lines("<p>", '  "a"', '  <span style="display: block flow">', '    "b"', "  </span>", "</p>"),
    );
  });

  it("falls back to the default display for a value it does not know", () => {
    expect(collapse('<p>a <span style="display: bogus"> b</span></p>')).toBe(
      lines("<p>", '  "a "', '  <span style="display: bogus">', '    "b"', "  </span>", "</p>"),
    );
  });

  it("falls back to the default display for a value Chromium rejects", () => {
    // `run-in` and `ruby-base` are not supported: the `<div>` stays a block.
    for (const value of ["run-in", "inline run-in", "ruby-base"]) {
      expect(normalizeHtml(`<div>a<div style="display: ${value}"> b</div></div>`)).toBe(
        normalizeHtml(`<div>a<div style="display: ${value}">b</div></div>`),
      );
    }
  });

  it("lays display: math out as an inline outside MathML", () => {
    expect(normalizeHtml('<p>a<span style="display: math"> b</span></p>')).not.toBe(
      normalizeHtml('<p>a<span style="display: math">b</span></p>'),
    );
  });

  it("normalises a template's content on its own", () => {
    expect(normalizeHtml("<template> <p> a </p> </template>")).toBe(
      normalizeHtml("<template><p>a</p></template>"),
    );
  });

  it("ignores whitespace between SVG shapes and keeps it inside text", () => {
    expect(
      collapse('<svg>\n  <path d="M0"></path>\n  <text> Hi  <tspan>there</tspan> </text>\n</svg>'),
    ).toBe(
      lines(
        "<svg>",
        '  <path d="M0"></path>',
        "  <text>",
        '    "Hi "',
        "    <tspan>",
        '      "there"',
        "    </tspan>",
        "  </text>",
        "</svg>",
      ),
    );
  });
});

describe("rule 6: collapseWhitespace, where whitespace is preserved", () => {
  it("keeps <pre>, <textarea> and <listing> text exactly", () => {
    for (const html of [
      "<pre>  a\n    b  </pre>",
      "<textarea>  a\n  b </textarea>",
      "<listing> x  y </listing>",
    ]) {
      expect(collapse(html)).toBe(printTree(parseHtml(html)));
    }
    expect(normalizeHtml("<pre>a\n  b</pre>")).not.toBe(normalizeHtml("<pre>a\nb</pre>"));
  });

  it("keeps raw-text content (scripts and styles) exactly, SVG's included", () => {
    expect(collapse("<style>\n  a  >  b { }\n</style>")).toBe(
      lines("<style>", '  "\\n  a  >  b { }\\n"', "</style>"),
    );
    expect(normalizeHtml('<svg><style>.a::after { content: "x  y" }</style></svg>')).not.toBe(
      normalizeHtml('<svg><style>.a::after { content: "x y" }</style></svg>'),
    );
  });

  it("keeps the text under an inline white-space that preserves spaces, by inheritance", () => {
    for (const value of ["pre", "pre-wrap", "pre-line", "break-spaces", "preserve nowrap"]) {
      const html = `<div style="white-space: ${value}"><span>  a  </span></div>`;
      expect(collapse(html)).toContain('"  a  "');
    }
    expect(collapse('<div style="white-space-collapse: preserve"> a </div>')).toContain('" a "');
  });

  it("collapses again under white-space: normal", () => {
    expect(collapse('<pre><span style="white-space: normal">  a  </span></pre>')).toBe(
      lines("<pre>", '  <span style="white-space: normal">', '    "a"', "  </span>", "</pre>"),
    );
    expect(collapse('<p style="white-space: nowrap">  a  </p>')).toContain('"a"');
  });

  it("lets the last of white-space and white-space-collapse win", () => {
    expect(
      collapse('<p style="white-space: pre; white-space-collapse: collapse"> a </p>'),
    ).toContain('"a"');
    expect(
      collapse('<p style="white-space-collapse: collapse; white-space: pre"> a </p>'),
    ).toContain('" a "');
  });

  it("does not collapse a space against preserved text", () => {
    expect(collapse('<p>a<span style="white-space: pre"> </span> b</p>')).toBe(
      lines(
        "<p>",
        '  "a"',
        '  <span style="white-space: pre">',
        '    " "',
        "  </span>",
        '  " b"',
        "</p>",
      ),
    );
  });

  it("never equates a line break after a preserved space with a space or with nothing", () => {
    // Chromium removes it after break-spaces and renders a space after pre: keep it as it is.
    const after = (rest: string) =>
      normalizeHtml(`<p><span style="white-space: break-spaces">a\n </span>${rest}</p>`);
    expect(after("\nbb")).not.toBe(after("  bb"));
    expect(after("\nbb")).not.toBe(after("bb"));
    expect(after("  bb")).toBe(after(" bb"));
  });

  it("keeps a space before a <br> in preserved whitespace, where it is not a line end", () => {
    const before = (space: string) =>
      normalizeHtml(`<p>a${space}<span style="white-space: break-spaces"><br></span></p>`);
    expect(before(" ")).not.toBe(before(""));
    // Under white-space: normal a space before <br> ends the line, and goes.
    expect(normalizeHtml("<p>a <br></p>")).toBe(normalizeHtml("<p>a<br></p>"));
  });

  it("starts a new line after a preserved line break", () => {
    expect(collapse('<pre>x\n<span style="white-space: normal">  y</span></pre>')).toBe(
      lines(
        "<pre>",
        '  "x\\n"',
        '  <span style="white-space: normal">',
        '    "y"',
        "  </span>",
        "</pre>",
      ),
    );
  });
});

describe("rule 6: collapseWhitespace, in a ruby", () => {
  it("collapses whitespace across a ruby's edges, as across an inline's", () => {
    expect(normalizeHtml("<p>a <ruby> b</ruby></p>")).toBe(
      normalizeHtml("<p>a <ruby>b</ruby></p>"),
    );
    expect(normalizeHtml("<p>a<ruby> b</ruby></p>")).not.toBe(
      normalizeHtml("<p>a<ruby>b</ruby></p>"),
    );
  });

  it("does not end the line at a <br>, a block or a float inside a ruby", () => {
    // Chromium lays the ruby out on one line: the space after it renders.
    expect(normalizeHtml("<p><ruby>漢<rt>kan</rt><br></ruby> and more</p>")).not.toBe(
      normalizeHtml("<p><ruby>漢<rt>kan</rt><br></ruby>and more</p>"),
    );
    expect(normalizeHtml("<div><ruby><div>x</div> b</ruby></div>")).not.toBe(
      normalizeHtml("<div><ruby><div>x</div>b</ruby></div>"),
    );
    expect(normalizeHtml('<div><ruby>a <span style="float: left"></span></ruby></div>')).not.toBe(
      normalizeHtml('<div><ruby>a<span style="float: left"></span></ruby></div>'),
    );
    expect(
      normalizeHtml('<div><ruby>a<span style="white-space: pre">\n</span> b</ruby></div>'),
    ).not.toBe(normalizeHtml('<div><ruby>a<span style="white-space: pre">\n</span>b</ruby></div>'));
  });

  it("renders no whitespace-only text after a <br> in a ruby, as after any <br>", () => {
    expect(normalizeHtml("<div><ruby>a<br> </ruby>b</div>")).toBe(
      normalizeHtml("<div><ruby>a<br></ruby>b</div>"),
    );
  });

  it("does not remove a line break next to a zero-width space across a ruby's edge", () => {
    expect(normalizeHtml("<div>dd\u200b<ruby>\na</ruby></div>")).toBe(
      normalizeHtml("<div>dd\u200b<ruby> a</ruby></div>"),
    );
    expect(normalizeHtml("<div><ruby>dd\u200b</ruby>\na</div>")).not.toBe(
      normalizeHtml("<div><ruby>dd\u200b</ruby>a</div>"),
    );
  });

  it("keeps a line break after preserved text in a ruby as written", () => {
    expect(
      normalizeHtml('<div><ruby><span style="white-space: pre-line">a\n</span>\nb</ruby></div>'),
    ).not.toBe(
      normalizeHtml('<div><ruby><span style="white-space: pre-line">a\n</span> b</ruby></div>'),
    );
  });

  it("keeps whitespace that collapses away beside a ruby as an empty text", () => {
    // Chromium still lays the empty text out, and the annotation then does not overhang "x ".
    expect(collapse("<p><b>x </b> <ruby>a<rt>aaa</rt></ruby></p>")).toBe(
      lines(
        "<p>",
        "  <b>",
        '    "x "',
        "  </b>",
        '  ""',
        "  <ruby>",
        '    "a"',
        "    <rt>",
        '      "aaa"',
        "    </rt>",
        "  </ruby>",
        "</p>",
      ),
    );
    expect(normalizeHtml("<p><b>x </b> <i>y</i></p>")).toBe(
      normalizeHtml("<p><b>x </b><i>y</i></p>"),
    );
  });

  it("treats an <rt> outside a ruby as an ordinary inline", () => {
    expect(normalizeHtml("<div>dd\u200b<rt>\na</rt></div>")).toBe(
      normalizeHtml("<div>dd\u200b<rt>a</rt></div>"),
    );
  });

  it("lays a list item in a ruby out as an inline that starts with its marker", () => {
    expect(normalizeHtml("<div><ruby>a<li> b</li></ruby></div>")).toBe(
      normalizeHtml("<div><ruby>a<li>b</li></ruby></div>"),
    );
    expect(normalizeHtml("<div><ruby>a<li>b </li> c</ruby></div>")).not.toBe(
      normalizeHtml("<div><ruby>a<li>b</li> c</ruby></div>"),
    );
  });
});
