import { describe, expect, it } from "vitest";

import { normalizeHtml } from "../src/normalize/index.ts";
import { quote } from "../src/normalize/print.ts";

describe("normalizeHtml: the canonical text", () => {
  it("prints one node per line, indented, with end tags on their own lines", () => {
    expect(
      normalizeHtml(
        '<section class="card"><h2>Title</h2><p>One<br>Two</p><img src="/a.png" alt="A"></section>',
      ),
    ).toBe(
      [
        '<section class="card">',
        "  <h2>",
        '    "Title"',
        "  </h2>",
        "  <p>",
        '    "One"',
        "    <br>",
        '    "Two"',
        "  </p>",
        '  <img alt="A" src="/a.png">',
        "</section>",
        "",
      ].join("\n"),
    );
  });

  it("prints an element without children on one line, and a void element without an end tag", () => {
    expect(normalizeHtml('<div class="a"></div><input type="text"><span></span>')).toBe(
      '<div class="a"></div>\n<input type="text">\n<span></span>\n',
    );
  });

  it("prints nothing for an empty fragment", () => {
    expect(normalizeHtml("")).toBe("");
    expect(normalizeHtml("  \n\t ")).toBe("");
    expect(normalizeHtml("<!--[--><!--]-->")).toBe("");
  });

  it("quotes text so every space at its edges is visible", () => {
    expect(normalizeHtml("<p>Hello, <b>world</b>!</p>")).toBe(
      '<p>\n  "Hello, "\n  <b>\n    "world"\n  </b>\n  "!"\n</p>\n',
    );
  });

  it("decodes entities, so markup-like text is a quoted text line", () => {
    expect(normalizeHtml("<p>&lt;b&gt; &amp; &quot;q&quot; &#65;</p>")).toBe(
      '<p>\n  "<b> & \\"q\\" A"\n</p>\n',
    );
  });

  it("writes attribute values as quoted strings with escapes", () => {
    expect(normalizeHtml(`<p title='say "hi" \\ bye' data-x="a&amp;b"></p>`)).toBe(
      '<p data-x="a&b" title="say \\"hi\\" \\\\ bye"></p>\n',
    );
  });

  it("prints a template's content as its children", () => {
    expect(normalizeHtml("<template><li>a</li></template>")).toBe(
      '<template>\n  <li>\n    "a"\n  </li>\n</template>\n',
    );
  });

  it("keeps SVG names in their case and namespaced attributes with their prefix", () => {
    expect(
      normalizeHtml(
        '<svg viewBox="0 0 1 1"><linearGradient id="g"></linearGradient><a xlink:href="#g"></a></svg>',
      ),
    ).toBe(
      [
        '<svg viewBox="0 0 1 1">',
        '  <linearGradient id="g"></linearGradient>',
        '  <a xlink:href="#g"></a>',
        "</svg>",
        "",
      ].join("\n"),
    );
  });

  it("is deterministic", () => {
    const html = '<ul class="b a"><li style="color:red" id="x">1</li><li>2</li></ul>';
    expect(normalizeHtml(html)).toBe(normalizeHtml(html));
  });
});

describe("quote", () => {
  it("is a JSON string literal that reads back exactly", () => {
    for (const text of [
      "plain",
      ' "quoted" \\ ',
      "line\nbreak\ttab\r",
      "a\u{a0}b",
      "\u{200b}\u{ad}\u{2028}\u{2029}\u{202f}\u{3000}",
      "\u0001\u007f\u0085",
      "😀 emoji é",
      "\ud800 lone",
      "\u{e0001} tag",
    ]) {
      expect(JSON.parse(quote(text))).toBe(text);
    }
  });

  it("escapes every invisible or ambiguous character", () => {
    expect(quote("a\u{a0}b")).toBe('"a\\u00a0b"');
    expect(quote("zero\u{200b}width")).toBe('"zero\\u200bwidth"');
    expect(quote("soft\u{ad}hyphen")).toBe('"soft\\u00adhyphen"');
    expect(quote("\u{2003}em space")).toBe('"\\u2003em space"');
    expect(quote("\u0001")).toBe('"\\u0001"');
    expect(quote("\ud800")).toBe('"\\ud800"');
    expect(quote("\u{e0001}")).toBe('"\\udb40\\udc01"');
  });

  it("keeps visible characters as they are", () => {
    expect(quote("café 😀 <b> & ' /")).toBe(`"café 😀 <b> & ' /"`);
  });

  it("escapes the combining marks of decomposed text, so it never prints like composed text", () => {
    const composed = "caf\u00e9";
    const decomposed = "cafe\u0301";
    expect(quote(composed)).toBe('"café"');
    expect(quote(decomposed)).toBe('"cafe\\u0301"');
    expect(normalizeHtml(`<p>${decomposed}</p>`)).toContain('"cafe\\u0301"');
    expect(JSON.parse(quote(decomposed))).toBe(decomposed);
  });

  it("keeps the marks of text in NFC, which needs them, and escapes variation selectors", () => {
    expect(quote("\u0915\u094d\u0937")).toBe('"\u0915\u094d\u0937"');
    expect(quote("\u2764\ufe0f")).toBe('"\u2764\\ufe0f"');
    expect(quote("\u2764")).toBe('"\u2764"');
  });
});

describe("normalizeHtml: markup the parser has to repair", () => {
  it("rejects a duplicate attribute, which the parser silently drops", () => {
    expect(() => normalizeHtml('<p class="a" class="b">x</p>')).toThrow(/1:19 duplicate-attribute/);
  });

  it("rejects a self-closing non-void element, which the parser leaves open", () => {
    expect(() => normalizeHtml("<div/>x")).toThrow(
      /non-void-html-element-start-tag-with-trailing-solidus/,
    );
  });

  it("rejects a stray end tag, which the parser turns into an empty element", () => {
    expect(() => normalizeHtml("<p>a<div>b</div></p>")).toThrow(/1:17 dropped "<\/p>"/);
  });

  it("rejects table parts outside a table, which the parser drops with their attributes", () => {
    expect(() => normalizeHtml('<tr class="row"><td>x</td></tr>')).toThrow(
      /dropped "<tr class=\\"row\\"><td>"/,
    );
  });

  it("rejects a document shell: the renderer must return only the component's HTML", () => {
    expect(() =>
      normalizeHtml("<!DOCTYPE html><html><head></head><body><p>x</p></body></html>"),
    ).toThrow(/dropped "<!DOCTYPE html><html><head><\/head><body>"/);
  });

  it("rejects text the parser moves out of a table", () => {
    expect(() => normalizeHtml("<table>x<tr><td>a</td></tr></table>")).toThrow(
      /1:8 moved "x" before "<table>"/,
    );
  });

  it("rejects misnested tags, after which the parser reopens an element", () => {
    expect(() => normalizeHtml("<b>1<p>2</b>3</p>")).toThrow(/inserted <b>/);
    expect(() => normalizeHtml("<table><td>x</td></table>")).toThrow(/1:8 inserted <tr>/);
  });

  it("accepts the elements HTML implies around rows and columns", () => {
    expect(normalizeHtml("<table><col><tr><td>x</td></tr></table>")).toBe(
      [
        "<table>",
        "  <colgroup>",
        "    <col>",
        "  </colgroup>",
        "  <tbody>",
        "    <tr>",
        "      <td>",
        '        "x"',
        "      </td>",
        "    </tr>",
        "  </tbody>",
        "</table>",
        "",
      ].join("\n"),
    );
  });

  it("rejects an unterminated character reference, which decodes differently from escaped text", () => {
    expect(() => normalizeHtml("<p>AT&copy x</p>")).toThrow(
      /missing-semicolon-after-character-reference/,
    );
  });

  it("reports every problem with its line and column", () => {
    expect(() => normalizeHtml('<p>\n  <b class="a" class="b">x</b>\n</p></p>')).toThrow(
      /2:21 duplicate-attribute\n {2}3:5 inserted <p>\n {2}3:5 dropped "<\/p>"/,
    );
  });

  it("accepts a control character, which the parser keeps, and shows it escaped", () => {
    expect(normalizeHtml("<p>a\u0001b</p>")).toBe('<p>\n  "a\\u0001b"\n</p>\n');
  });

  it("accepts the markup every target emits: void slashes, bare and empty attributes", () => {
    expect(normalizeHtml('<input type="text" disabled=""/><input type="text" disabled>')).toBe(
      '<input disabled="" type="text">\n<input disabled="" type="text">\n',
    );
  });
});

describe("normalizeHtml: options", () => {
  it("rejects an unknown target from an untyped caller", () => {
    expect(() =>
      normalizeHtml("<p></p>", {
        // @ts-expect-error -- a caller without types can pass any string.
        target: "preact",
      }),
    ).toThrow('normalizeHtml: unknown target "preact"');
  });
});

/** The fastest of five normalisations of a document, in milliseconds, after one to warm up. */
function fastest(html: string): number {
  normalizeHtml(html);
  const timings = Array.from({ length: 5 }, () => {
    const start = performance.now();
    normalizeHtml(html, { target: "react" });
    return performance.now() - start;
  });
  return Math.min(...timings);
}

describe("normalizeHtml: performance", () => {
  // A shared CI runner, busy with every package's tests at once, takes several times as long
  // as a laptop: the time grows linearly with the document, which a fixed budget alone cannot
  // tell from a slow machine. A tenfold document takes about ten times as long; quadratic work
  // would take a hundred.
  it("normalises a 1,000-element document in linear time, well under 250 ms", () => {
    const item =
      '<li class="item b a" data-hk="00" :="ii_0"><a href="#x" style="color:red;margin: 0">' +
      '\n  Item <b>bold</b> <!-- -->text\n</a><!--[--><input type="checkbox" checked="checked"' +
      ' aria-describedby="_r_1_"><span id="_r_1_">hint</span><!--]--></li>';
    const small = `<ul>${item.repeat(20)}</ul>`;
    const html = `<ul>${item.repeat(200)}</ul>`;
    expect(html.match(/<[a-z]/g)!.length).toBe(1001);
    const [smallTime, time] = [fastest(small), fastest(html)];
    expect(time).toBeLessThan(250);
    expect(time / smallTime).toBeLessThan(30);
  });
});
