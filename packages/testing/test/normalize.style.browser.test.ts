// What Chromium does to `class` and `style` as a client updates them, which the normaliser's
// rules 4a and 4c follow (ADR-0044, amending ADR-0031): the evidence that an empty class or
// style, an empty value and the order of unrelated declarations are noise, and that the order
// of overlapping declarations is not.
import { afterEach, describe, expect, it } from "vitest";

import { normalizeDom, serializeDom } from "../src/dom/serialize.ts";
import { normalizeHtml } from "../src/normalize/index.ts";

/** A fresh mount container in the document, filled with `html`. */
function container(html: string): HTMLDivElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.append(root);
  return root;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("Chromium's CSSOM", () => {
  it("ignores a declaration with an empty value", () => {
    const root = container("<p>x</p>");
    const p = root.querySelector("p")!;
    p.style.setProperty("color", "red");
    p.style.setProperty("color", "");
    expect(p.style.cssText).toBe("");
    // The attribute stays, empty: as Vue's server writes it for an empty bound style.
    expect(serializeDom(root)).toBe('<p style="">x</p>');
    expect(normalizeDom(root)).toBe(normalizeHtml("<p>x</p>"));
  });

  it("appends a declaration set again after its removal, so unrelated ones change order", () => {
    const root = container('<p style="color: red; margin-top: 4px">x</p>');
    const p = root.querySelector("p")!;
    p.style.removeProperty("color");
    p.style.setProperty("color", "red");
    expect(p.style.cssText).toBe("margin-top: 4px; color: red;");
    expect(normalizeDom(root)).toBe(normalizeHtml('<p style="color: red; margin-top: 4px">x</p>'));
  });

  it("serialises overlapping declarations as what they resolve to, so their order shows", () => {
    const first = container('<p style="margin: 0; margin-top: 4px">x</p>');
    const second = container('<p style="margin-top: 4px; margin: 0">x</p>');
    expect(first.querySelector("p")!.style.cssText).toBe("margin: 4px 0px 0px;");
    expect(second.querySelector("p")!.style.cssText).toBe("margin: 0px;");
    expect(normalizeDom(first)).not.toBe(normalizeDom(second));
  });

  it("keeps an empty class once the last token is toggled off", () => {
    const root = container('<p class="a">x</p>');
    root.querySelector("p")!.classList.remove("a");
    expect(serializeDom(root)).toBe('<p class="">x</p>');
    expect(normalizeDom(root)).toBe(normalizeHtml("<p>x</p>"));
  });
});
