// The normaliser on the exact HTML the M0 spikes recorded from each framework: the SSR spike's
// renderer output (`out/<target>/basics/<case>/ssr.<scenario>.html`, the component's HTML the
// renderer cut out of `ssr.<scenario>.raw.html`), and the client DOM shapes in the Angular+Qwik
// and Astro ADRs. Every target must normalise to the same canonical text.
import { describe, expect, it } from "vitest";

import { normalizeHtml } from "../src/normalize/index.ts";
import type { NormalizeTarget } from "../src/normalize/index.ts";

type Outputs = readonly (readonly [NormalizeTarget, string])[];

const hello = (name: string): Outputs => [
  ["react", `<p class="greeting">Hello, <!-- -->${name}<!-- -->!</p>`],
  ["vue", `<p class="greeting">Hello, ${name}!</p>`],
  ["svelte", `<!--[--><p class="greeting">Hello, ${name}!</p><!--]-->`],
  ["solid", `<p data-hk="00" class="greeting">Hello, <!--$-->${name}<!--/-->!</p>`],
  [
    "angular",
    `<uf-hello style="display: contents;"><p class="greeting">Hello, ${name}!</p></uf-hello>`,
  ],
  ["qwik", `<p :="ii_0" class="greeting">Hello, ${name}!</p>`],
  ["astro", `<p class="greeting">Hello, ${name}!</p>`],
];

const helloText = (name: string) => `<p class="greeting">\n  "Hello, ${name}!"\n</p>\n`;

/** The SSR spike's `Card`: `<section class="card"><h2>Title</h2><p>Line one<br/>Line two</p><img src="/a.png" alt="A"/><input type="text" disabled/></section>`. */
const nestedAndVoid: Outputs = [
  [
    "react",
    '<section class="card"><h2>Title</h2><p>Line one<br/>Line two</p><img src="/a.png" alt="A"/><input type="text" disabled=""/></section>',
  ],
  [
    "vue",
    '<section class="card"><h2>Title</h2><p>Line one<br>Line two</p><img src="/a.png" alt="A"><input type="text" disabled></section>',
  ],
  [
    "solid",
    '<section data-hk="00" class="card"><h2>Title</h2><p>Line one<br>Line two</p><img src="/a.png" alt="A"><input type="text" disabled></section>',
  ],
  [
    "angular",
    '<uf-card style="display: contents;"><section class="card"><h2>Title</h2><p>Line one<br>Line two</p><img src="/a.png" alt="A"><input type="text" disabled=""></section></uf-card>',
  ],
  [
    "qwik",
    '<section :="6X_0" class="card"><h2 :="">Title</h2><p :="">Line one<br :="">Line two</p><img :="" src="/a.png" alt="A"><input :="" type="text" disabled></section>',
  ],
];

const nestedAndVoidText = [
  '<section class="card">',
  "  <h2>",
  '    "Title"',
  "  </h2>",
  "  <p>",
  '    "Line one"',
  "    <br>",
  '    "Line two"',
  "  </p>",
  '  <img alt="A" src="/a.png">',
  '  <input disabled="" type="text">',
  "</section>",
  "",
].join("\n");

describe("the SSR spike's outputs", () => {
  it.each([
    ["default", "world"],
    ["named", "Unframework"],
  ])("normalise basics/hello (%s) to the same text on every target", (_, name) => {
    const outputs = hello(name);
    expect(outputs.map(([target]) => target)).toHaveLength(7);
    for (const [target, html] of outputs) {
      expect(normalizeHtml(html, { target }), target).toBe(helloText(name));
    }
  });

  it("normalise basics/nested-and-void to the same text on every target", () => {
    for (const [target, html] of nestedAndVoid) {
      expect(normalizeHtml(html, { target }), target).toBe(nestedAndVoidText);
    }
  });

  it("keep the rendered space the spike's hand-written Svelte output has between <img> and <input>", () => {
    // Svelte turns the template's line breaks into " " text. Between blocks it does not render
    // and goes; between the two inline siblings it renders, and the spike's blanket whitespace
    // removal hid it. The compiler's Svelte layout keeps inline siblings adjacent.
    const svelte =
      '<!--[--><section class="card"><h2>Title</h2> <p>Line one<br/>Line two</p> <img src="/a.png" alt="A"/> <input type="text" disabled=""/></section><!--]-->';
    expect(normalizeHtml(svelte, { target: "svelte" })).toBe(
      nestedAndVoidText.replace(
        '  <img alt="A" src="/a.png">\n',
        '  <img alt="A" src="/a.png">\n  " "\n',
      ),
    );
    const adjacent = svelte.replace('alt="A"/> <input', 'alt="A"/><input');
    expect(normalizeHtml(adjacent, { target: "svelte" })).toBe(nestedAndVoidText);
  });

  it("reject a renderer's whole document: only the component's HTML may be normalised", () => {
    expect(() =>
      normalizeHtml(
        '<!DOCTYPE html><html><head><link rel="preload" as="image" href="/a.png"/></head><body><section class="card"></section></body></html>',
        { target: "react" },
      ),
    ).toThrow(/dropped "<!DOCTYPE html><html><head>"/);
  });

  it("normalise Angular's bootstrapApplication markers away", () => {
    const html =
      '<!--nghm--><uf-hello ng-version="22.2.1" style="display: contents;" ngh="0" ng-server-context="other"><p class="greeting">Hello, world!</p></uf-hello>';
    expect(normalizeHtml(html, { target: "angular" })).toBe(helloText("world"));
  });

  it("normalise Qwik's interactive attributes away", () => {
    expect(
      normalizeHtml(
        '<button q:p="0" :="el_0" type="button" q-e:click="mock-chunk#_run#1">2</button>',
        {
          target: "qwik",
        },
      ),
    ).toBe(normalizeHtml('<button type="button">2</button>', { target: "vue" }));
  });
});

describe("the client DOM shapes the spikes recorded", () => {
  it.each([
    [
      "angular",
      '<uf-hello style="display: contents;"><p class="greeting">Hello, world!</p></uf-hello>',
    ],
    [
      "angular",
      '<uf-hello _nghost-ng-c3792917614="" style="display: contents;"><!--container--><p _ngcontent-ng-c3792917614="" class="greeting">Hello, world!</p></uf-hello>',
    ],
    ["qwik", '<p class="greeting">Hello, world!</p>'],
    ["qwik", '<p class="greeting" q-d:q-hmr="">Hello, world!</p>'],
    ["react", '<p class="greeting">Hello, world!</p>'],
    ["solid", '<p class="greeting">Hello, world!</p>'],
    ["astro", '<p class="greeting">Hello, world!</p>'],
  ] as const)("normalise %s's basics/hello like every other target", (target, html) => {
    expect(normalizeHtml(html, { target })).toBe(helloText("world"));
  });

  it("normalise Astro's server HTML and its browser DOM the same way", () => {
    const ssr =
      '<section class="card" data-astro-cid-c7yaimas><!-- a comment authored in the template --><h2 data-astro-cid-c7yaimas>Title</h2><p data-astro-cid-c7yaimas>Line one<br data-astro-cid-c7yaimas>Line two</p><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="" data-astro-cid-c7yaimas><input type="checkbox" checked disabled aria-label="Agree" data-astro-cid-c7yaimas></section>';
    const dom =
      '<section class="card" data-astro-cid-c7yaimas=""><!-- a comment authored in the template --><h2 data-astro-cid-c7yaimas="">Title</h2><p data-astro-cid-c7yaimas="">Line one<br data-astro-cid-c7yaimas="">Line two</p><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="" data-astro-cid-c7yaimas=""><input type="checkbox" checked="" disabled="" aria-label="Agree" data-astro-cid-c7yaimas=""></section>';
    const text = [
      '<section class="card">',
      "  <h2>",
      '    "Title"',
      "  </h2>",
      "  <p>",
      '    "Line one"',
      "    <br>",
      '    "Line two"',
      "  </p>",
      '  <img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">',
      '  <input aria-label="Agree" checked="" disabled="" type="checkbox">',
      "</section>",
      "",
    ].join("\n");
    expect(normalizeHtml(ssr, { target: "astro" })).toBe(text);
    expect(normalizeHtml(dom, { target: "astro" })).toBe(text);
  });
});
