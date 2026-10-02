import { afterEach, describe, expect, it } from "vitest";

import { normalizeDom, serializeDom } from "../src/dom/serialize.ts";
import { normalizeHtml } from "../src/normalize/index.ts";

/** A fresh mount container in the document, filled with `html`. */
function container(html = ""): HTMLDivElement {
  const root = document.createElement("div");
  root.className = "root";
  root.innerHTML = html;
  document.body.append(root);
  return root;
}

const lines = (...text: string[]) => `${text.join("\n")}\n`;

afterEach(() => {
  document.body.replaceChildren();
});

describe("serializeDom", () => {
  it("serialises the children of the root, not the root", () => {
    const root = container('<p class="a">x</p><span>y</span>');
    expect(serializeDom(root)).toBe('<p class="a">x</p><span>y</span>');
  });

  it("matches innerHTML for markup without form controls or styles", () => {
    const html =
      '<section class="card" data-x="a &amp; b"><h2 id="t">Title &lt;1&gt;</h2><!--c--><p>a<br>b</p><img alt="" src="/a.png"><svg viewBox="0 0 1 1"><foreignObject><p>x</p></foreignObject></svg></section>';
    const root = container(html);
    expect(serializeDom(root)).toBe(root.innerHTML);
  });

  it("escapes text and attribute values so they read back exactly", () => {
    const root = container();
    const p = document.createElement("p");
    p.title = 'say "hi" & <bye>';
    p.textContent = "a < b & c > d";
    root.append(p);
    expect(normalizeDom(root)).toBe(
      lines('<p title="say \\"hi\\" & <bye>">', '  "a < b & c > d"', "</p>"),
    );
  });

  it("writes raw-text content unescaped", () => {
    const root = container();
    const style = document.createElement("style");
    style.textContent = "a > b { content: '&'; }";
    root.append(style);
    expect(serializeDom(root)).toBe("<style>a > b { content: '&'; }</style>");
  });

  it("keeps a leading line break in <pre> and <textarea>, which the parser would drop", () => {
    const root = container();
    const pre = document.createElement("pre");
    pre.textContent = "\nindented";
    const textarea = document.createElement("textarea");
    textarea.textContent = "\nline";
    root.append(pre, textarea);
    expect(normalizeDom(root)).toBe(
      lines(
        "<pre>",
        '  "\\nindented"',
        "</pre>",
        '<textarea uf:value="\\nline">',
        '  "\\nline"',
        "</textarea>",
      ),
    );
  });

  it("keeps the leading line break behind a framework's empty text node", () => {
    const root = container();
    const pre = document.createElement("pre");
    pre.append(document.createTextNode(""), document.createTextNode("\nindented"));
    root.append(pre);
    expect(pre.innerText).toBe("\nindented");
    expect(normalizeDom(root)).toBe(lines("<pre>", '  "\\nindented"', "</pre>"));
    expect(normalizeDom(root)).not.toBe(normalizeDom(container("<pre>indented</pre>")));
  });

  it("serialises a template's content", () => {
    const root = container("<template><li>a</li></template>");
    expect(serializeDom(root)).toBe("<template><li>a</li></template>");
  });

  it("keeps SVG names in their case", () => {
    const root = container('<svg viewBox="0 0 1 1"><linearGradient id="g"></linearGradient></svg>');
    expect(serializeDom(root)).toBe(
      '<svg viewBox="0 0 1 1"><linearGradient id="g"></linearGradient></svg>',
    );
  });
});

describe("serializeDom: form-control state from properties", () => {
  it("writes the value property of a text input next to its value attribute", () => {
    const root = container('<input type="text" value="initial">');
    root.querySelector("input")!.value = "typed";
    expect(normalizeDom(root)).toBe('<input type="text" uf:value="typed" value="initial">\n');
  });

  it("captures a value set only as a property, as React does", () => {
    const root = container();
    const input = document.createElement("input");
    input.value = "from a property";
    root.append(input);
    expect(input.getAttribute("value")).toBeNull();
    expect(normalizeDom(root)).toBe('<input uf:value="from a property">\n');
  });

  it("writes the same state whether it was set as a property or an attribute", () => {
    const byAttribute = container('<input type="checkbox" checked>');
    const byProperty = container('<input type="checkbox">');
    byProperty.querySelector("input")!.checked = true;
    expect(normalizeDom(byAttribute)).toBe(
      '<input checked="" type="checkbox" uf:checked="true" uf:indeterminate="false">\n',
    );
    expect(normalizeDom(byProperty)).toBe(
      '<input type="checkbox" uf:checked="true" uf:indeterminate="false">\n',
    );
  });

  it("shows a checked attribute whose property was cleared", () => {
    const root = container('<input type="checkbox" checked>');
    root.querySelector("input")!.checked = false;
    expect(normalizeDom(root)).toContain('checked="" type="checkbox" uf:checked="false"');
  });

  it("writes indeterminate, which has no attribute", () => {
    const root = container('<input type="checkbox">');
    root.querySelector("input")!.indeterminate = true;
    expect(normalizeDom(root)).toContain('uf:indeterminate="true"');
  });

  it("writes checked on radios, without indeterminate", () => {
    const root = container(
      '<input type="radio" name="r" value="a"><input type="radio" name="r" value="b">',
    );
    root.querySelectorAll("input")[1]!.checked = true;
    expect(normalizeDom(root)).toBe(
      lines(
        '<input name="r" type="radio" uf:checked="false" value="a">',
        '<input name="r" type="radio" uf:checked="true" value="b">',
      ),
    );
  });

  it("writes a textarea's value next to its default text", () => {
    const root = container("<textarea>default</textarea>");
    root.querySelector("textarea")!.value = "edited";
    expect(normalizeDom(root)).toBe(
      lines('<textarea uf:value="edited">', '  "default"', "</textarea>"),
    );
  });

  it("writes every option's selectedness, which carries a select's value", () => {
    const root = container(
      '<select><option value="a">A</option><option value="b">B</option></select>',
    );
    root.querySelector("select")!.value = "b";
    expect(normalizeDom(root)).toBe(
      lines(
        "<select>",
        '  <option uf:selected="false" value="a">',
        '    "A"',
        "  </option>",
        '  <option uf:selected="true" value="b">',
        '    "B"',
        "  </option>",
        "</select>",
      ),
    );
  });

  it("writes the value of every input type whose value is user state, and no other", () => {
    const root = container(
      '<input type="range"><input type="color"><input type="date"><input type="hidden" value="h"><input type="submit" value="Go"><input type="file"><input type="button" value="b">',
    );
    expect(normalizeDom(root)).toBe(
      lines(
        '<input type="range" uf:value="50">',
        '<input type="color" uf:value="#000000">',
        '<input type="date" uf:value="">',
        '<input type="hidden" value="h">',
        '<input type="submit" value="Go">',
        '<input type="file">',
        '<input type="button" value="b">',
      ),
    );
  });
});

describe("serializeDom: styles from the CSSOM", () => {
  it("serialises a style set through the CSSOM like the same style set as an attribute", () => {
    const byProperty = container("<p>x</p>");
    byProperty.querySelector("p")!.style.margin = "0";
    const byAttribute = container('<p style="margin:0">x</p>');
    expect(normalizeDom(byProperty)).toBe(normalizeDom(byAttribute));
    expect(normalizeDom(byAttribute)).toBe(lines('<p style="margin: 0px;">', '  "x"', "</p>"));
  });

  it("unwraps an Angular host whose display: contents was set as a style, in Angular's output", () => {
    const root = container('<uf-hello><p class="greeting">Hello, world!</p></uf-hello>');
    root.querySelector<HTMLElement>("uf-hello")!.style.display = "contents";
    expect(normalizeDom(root, { target: "angular" })).toBe(
      lines('<p class="greeting">', '  "Hello, world!"', "</p>"),
    );
    expect(normalizeDom(root, { target: "react" })).toContain(
      '<uf-hello style="display: contents;">',
    );
  });
});

describe("normalizeHtml in the browser", () => {
  it("gives the same canonical text as in Node", () => {
    expect(navigator.userAgent).toContain("Chrome");
    const html =
      '<!--[--><uf-x _nghost-ng-c1="" style="display:contents"><section _ngcontent-ng-c1="" class="b a">\n' +
      '  <label for="uf-id-x">Name</label><input id="uf-id-x" disabled="disabled" style="COLOR:red">\n' +
      "  <p>Hello, <!-- -->world<!-- -->!</p> <pre>  kept  </pre>\n</section></uf-x><!--]-->";
    expect(normalizeHtml(html, { target: "angular" })).toBe(
      lines(
        '<section class="a b">',
        '  <label for="uf-id-1">',
        '    "Name"',
        "  </label>",
        '  <input disabled="" id="uf-id-1" style="color: red;">',
        "  <p>",
        '    "Hello, world!"',
        "  </p>",
        "  <pre>",
        '    "  kept  "',
        "  </pre>",
        "</section>",
      ),
    );
  });
});

describe("normalizeDom", () => {
  it("is normalizeHtml of serializeDom, with the options passed on", () => {
    const root = container(
      '<label for="uf-id-a">A</label><input id="uf-id-a" q:key="k"><span id="email"></span>',
    );
    for (const options of [undefined, { target: "qwik" as const }]) {
      expect(normalizeDom(root, options)).toBe(normalizeHtml(serializeDom(root), options));
    }
    expect(normalizeDom(root, { target: "qwik" })).toContain('<input id="uf-id-1" uf:value="">');
    expect(normalizeDom(root)).toContain('<input id="uf-id-1" q:key="k" uf:value="">');
    expect(normalizeDom(root, { target: "qwik" })).toContain('<span id="email">');
  });

  it("joins the separate text nodes a framework creates", () => {
    const root = container();
    const p = document.createElement("p");
    p.append("Hello, ", "world", "!");
    root.append(p);
    expect(p.childNodes).toHaveLength(3);
    expect(normalizeDom(root)).toBe(lines("<p>", '  "Hello, world!"', "</p>"));
  });

  it("drops framework anchors in the live DOM", () => {
    const root = container();
    root.append(
      document.createComment("["),
      document.createElement("p"),
      document.createComment("]"),
    );
    expect(normalizeDom(root)).toBe("<p></p>\n");
  });

  it("rejects a live structure HTML cannot express, which the parser would rebuild", () => {
    const root = container("<p>a</p>");
    root.querySelector("p")!.append(document.createElement("div"));
    expect(() => normalizeDom(root)).toThrow(/dropped "<\/p>"/);
  });
});

describe("normalizeDom: what HTML text cannot carry", () => {
  const SVG = "http://www.w3.org/2000/svg";
  const XLINK = "http://www.w3.org/1999/xlink";
  const cannotExpress = /the live DOM has a structure HTML cannot express/;

  /** A container with `<svg>` holding one child that `build` makes, rendered as the browser does. */
  function svgWith(build: (svg: SVGSVGElement) => Element): { root: HTMLElement; width: number } {
    const root = container();
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("width", "100");
    svg.setAttribute("height", "100");
    const child = build(svg);
    svg.append(child);
    root.append(svg);
    return { root, width: child.getBoundingClientRect().width };
  }

  it("accepts SVG built in its namespace, with its attributes' names and namespaces", () => {
    const { root, width } = svgWith((svg) => {
      svg.setAttribute("viewBox", "0 0 10 10");
      const rect = svg.appendChild(document.createElementNS(SVG, "rect"));
      rect.setAttribute("id", "r");
      rect.setAttribute("width", "10");
      rect.setAttribute("height", "10");
      const use = document.createElementNS(SVG, "use");
      use.setAttributeNS(XLINK, "xlink:href", "#r");
      return use;
    });
    expect(width).toBeGreaterThan(0);
    expect(() => normalizeDom(root)).not.toThrow();
    expect(normalizeDom(root)).toBe(normalizeDom(container(root.innerHTML)));
  });

  it("rejects an SVG child created in the HTML namespace, which renders nothing", () => {
    const { root, width } = svgWith(() => {
      const circle = document.createElement("circle");
      circle.setAttribute("r", "5");
      return circle;
    });
    expect(width).toBe(0);
    expect(() => normalizeDom(root)).toThrow(
      /the live <circle> at svg > circle parses as SVG <circle>/,
    );
  });

  it("rejects an HTML element created in the SVG namespace", () => {
    const root = container();
    root.append(document.createElementNS(SVG, "p"));
    expect(() => normalizeDom(root)).toThrow(/the live SVG <p> at p parses as <p>/);
  });

  it("rejects an SVG name in the wrong case, which the parser would correct", () => {
    const { root } = svgWith(() => document.createElementNS(SVG, "lineargradient"));
    expect(() => normalizeDom(root)).toThrow(
      /the live SVG <lineargradient> at svg > lineargradient parses as SVG <linearGradient>/,
    );
    const viewbox = svgWith(() => document.createElementNS(SVG, "rect")).root;
    viewbox.querySelector("svg")!.setAttribute("viewbox", "0 0 10 10");
    expect(() => normalizeDom(viewbox)).toThrow(
      /the attributes of svg are \[height, viewbox, width\]/,
    );
  });

  it("rejects xlink:href set without its namespace, which never resolves", () => {
    const { root, width } = svgWith(() => {
      const use = document.createElementNS(SVG, "use");
      use.setAttribute("xlink:href", "#r");
      return use;
    });
    expect(width).toBe(0);
    expect(() => normalizeDom(root)).toThrow(cannotExpress);
  });

  it("accepts namespace declarations set without their namespace, as Vue and React set them", () => {
    // Vue's runtime-dom and React set every SVG attribute but `xlink:*` with setAttribute, so a
    // copied `xmlns` is in no namespace live and in the XMLNS namespace once parsed: inert
    // either way in an HTML document.
    const { root } = svgWith((svg) => {
      svg.setAttribute("xmlns", SVG);
      svg.setAttribute("xmlns:xlink", XLINK);
      svg.setAttribute("viewBox", "0 0 10 10");
      return document.createElementNS(SVG, "rect");
    });
    expect(normalizeDom(root)).toBe(normalizeDom(container(root.innerHTML)));
    expect(normalizeDom(root)).toContain(`xmlns="${SVG}"`);
  });

  it("rejects a carriage return in text, which the parser reads back as a line feed", () => {
    const pre = (text: string) => {
      const root = container();
      root.appendChild(document.createElement("pre")).append(text);
      return root;
    };
    const height = (root: HTMLElement) => root.querySelector("pre")!.getBoundingClientRect().height;
    // One line with a carriage return, two with a line feed.
    expect(height(pre("a\rb"))).toBeLessThan(height(pre("a\nb")));
    expect(() => normalizeDom(pre("a\rb"))).toThrow(
      /the text "a\\rb" at pre reads back as "a\\nb"/,
    );
  });

  it("rejects a carriage return in an attribute value", () => {
    const root = container();
    root.appendChild(document.createElement("p")).title = "a\r\nb";
    expect(() => normalizeDom(root)).toThrow(
      /the title of p is "a\\r\\nb" live and reads back as "a\\nb"/,
    );
  });

  it("rejects a table row without the <tbody> the parser inserts", () => {
    const root = container();
    const table = document.createElement("table");
    const row = table.appendChild(document.createElement("tr"));
    row.appendChild(document.createElement("td")).textContent = "x";
    root.append(table);
    expect(root.querySelector("table > tr")).not.toBeNull();
    expect(() => normalizeDom(root)).toThrow(/the live <tr> at table > tr parses as <tbody>/);
    // As server HTML, the same markup is the table the browser builds.
    expect(normalizeHtml("<table><tr><td>x</td></tr></table>")).toBe(
      normalizeDom(container("<table><tr><td>x</td></tr></table>")),
    );
  });
});

describe("normalizeDom: ids", () => {
  it("keeps authored ids as they are on every target", () => {
    const html = '<label for="email">E</label><input id="email"><h2 id="s1">T</h2>';
    for (const target of ["react", "vue", "svelte", "solid", "angular", "qwik", "astro"] as const) {
      expect(normalizeDom(container(html), { target })).toBe(normalizeDom(container(html)));
    }
    expect(normalizeDom(container(html))).toContain('<input id="email" uf:value="">');
  });

  it("renames the compiler's ids consistently, references by URL included", () => {
    const a = container('<a href="#uf-id-r1">Skip</a><main id="uf-id-r1">x</main>');
    const b = container('<a href="#uf-id-x9">Skip</a><main id="uf-id-x9">x</main>');
    expect(normalizeDom(a)).toBe(normalizeDom(b));
    expect(normalizeDom(a)).toContain('<a href="#uf-id-1">');
    const broken = container('<a href="#uf-id-x9">Skip</a><main id="uf-id-r1">x</main>');
    expect(normalizeDom(broken)).not.toBe(normalizeDom(a));
  });
});
