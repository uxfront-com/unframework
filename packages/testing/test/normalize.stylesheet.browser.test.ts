// The whitespace rule under a stylesheet (ADR-0061, amending ADR-0031). The live DOM path reads
// `display`, `position`, `float`, `unicode-bidi` and `white-space` from Chromium's computed
// styles, so a class that changes how an element takes part in a line counts, as it does in
// Chromium's layout. The static path reads only inline styles: it judges each pair below as if
// no stylesheet applied, and gets it wrong, which is why the live path reads computed styles.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { normalizeDom } from "../src/dom/serialize.ts";
import { normalizeHtml } from "../src/normalize/index.ts";

const STYLESHEET = `
.block { display: block; }
.inline { display: inline; }
.float { float: left; }
.absolute { position: absolute; }
.isolate { unicode-bidi: isolate; }
.pre { white-space: pre; }
.normal { white-space: normal; }
`;

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

/** The live DOM path's normalisation of a fragment, mounted under the stylesheet. */
function live(html: string): string {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.append(root);
  const normalized = normalizeDom(root);
  root.remove();
  return normalized;
}

beforeEach(() => {
  const style = document.createElement("style");
  style.textContent = STYLESHEET;
  document.head.append(style);
  return () => style.remove();
});

afterEach(() => {
  document.body.replaceChildren();
});

const SAME: readonly (readonly [string, string, string])[] = [
  [
    "spaces around an inline made a block",
    '<p>a <span class="block"> b</span></p>',
    '<p>a<span class="block">b</span></p>',
  ],
  [
    "spaces on both sides of a float",
    '<p>a <span class="float">x</span> b</p>',
    '<p>a <span class="float">x</span>b</p>',
  ],
  [
    "spaces on both sides of an absolutely positioned box",
    '<p>a <span class="absolute">x</span> b</p>',
    '<p>a <span class="absolute">x</span>b</p>',
  ],
  [
    "a run of spaces in a <pre> made to collapse",
    '<pre class="normal">a  b</pre>',
    '<pre class="normal">a b</pre>',
  ],
];

const DIFFERENT: readonly (readonly [string, string, string])[] = [
  [
    "a space before a block made inline",
    '<div>a <div class="inline">b</div></div>',
    '<div>a<div class="inline">b</div></div>',
  ],
  [
    "a line break after a zero-width space, at the start of an isolate",
    '<p>a​<span class="isolate">\nb</span></p>',
    '<p>a​<span class="isolate">b</span></p>',
  ],
  [
    "a run of spaces in a paragraph made to preserve them",
    '<p class="pre">a  b</p>',
    '<p class="pre">a b</p>',
  ],
];

/**
 * Pairs the static path tells apart only by reading the span as inline. Chromium blockifies a
 * float and an absolutely positioned box, so their computed `display` is `block`: the live path
 * keeps them apart only because it reads the computed `float` and `position`, which take the
 * box out of flow, where whitespace collapses across it instead of ending at it.
 */
const DIFFERENT_OUT_OF_FLOW: readonly (readonly [string, string, string])[] = [
  [
    "spaces around a float",
    '<p>a <span class="float">x</span> b</p>',
    '<p>a<span class="float">x</span>b</p>',
  ],
  [
    "spaces around an absolutely positioned box",
    '<p>a <span class="absolute">x</span> b</p>',
    '<p>a<span class="absolute">x</span>b</p>',
  ],
];

describe("rule 6 under a stylesheet, against Chromium's layout", () => {
  it.each(SAME)("renders %s identically, and the live path normalises them equal", (_, a, b) => {
    expect(layout(a)).toBe(layout(b));
    expect(live(a)).toBe(live(b));
    expect(normalizeHtml(a)).not.toBe(normalizeHtml(b));
  });

  it.each(DIFFERENT)(
    "renders %s differently, and the live path keeps them different",
    (_, a, b) => {
      expect(layout(a)).not.toBe(layout(b));
      expect(live(a)).not.toBe(live(b));
      expect(normalizeHtml(a)).toBe(normalizeHtml(b));
    },
  );

  it.each(DIFFERENT_OUT_OF_FLOW)(
    "renders %s differently, and the live path keeps them different",
    (_, a, b) => {
      expect(layout(a)).not.toBe(layout(b));
      expect(live(a)).not.toBe(live(b));
    },
  );
});
