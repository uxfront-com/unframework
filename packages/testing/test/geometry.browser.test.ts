// What L10's geometry capture keys: every element, every laid-out text node, and every `::before`
// and `::after` that generates content (ADR-0061). A `<textarea>`'s text is its default value,
// which the control shows as its value: a target that writes it as markup (Astro, React's
// `defaultValue`) and one that sets the property (Vue's `v-model`) render the same box.
import { afterEach, expect, it } from "vitest";

import { captureGeometry, GEOMETRY_STYLE_PROPERTIES } from "../src/browser/geometry.ts";

afterEach(() => {
  document.body.replaceChildren();
});

it("captures a textarea's box, not its default value's text", () => {
  const written = document.createElement("div");
  written.innerHTML = "<textarea>Buy milk</textarea><p>after</p>";
  const property = document.createElement("div");
  property.innerHTML = "<textarea></textarea><p>after</p>";
  document.body.append(written, property);
  property.querySelector("textarea")!.value = "Buy milk";
  const keys = Object.keys(captureGeometry(written).nodes);
  expect(keys).toEqual(["textarea[0]", "p[0]", "p[0]/#text[0]"]);
  expect(keys).toEqual(Object.keys(captureGeometry(property).nodes));
});

it.each([
  ["outline-offset", "outline: 1px solid; outline-offset: 3px", "3px"],
  ["text-shadow", "text-shadow: 1px 2px 3px red", "rgb(255, 0, 0) 1px 2px 3px"],
  ["top", "position: relative; top: 4px", "4px"],
  ["right", "position: relative; right: 5px", "5px"],
  ["bottom", "position: relative; bottom: 6px", "6px"],
  ["left", "position: relative; left: 7px", "7px"],
])("captures %s", (property, css, value) => {
  const root = document.createElement("div");
  root.innerHTML = `<p style="${css}">x</p>`;
  document.body.append(root);
  expect(captureGeometry(root).nodes["p[0]"]!.style![property]).toBe(value);
});

it("leaves filter out, so a canary that inverts the root shows in the pixels alone", () => {
  expect(GEOMETRY_STYLE_PROPERTIES).not.toContain("filter");
});

it("captures the computed styles of a ::before and an ::after that generate content", () => {
  const style = document.createElement("style");
  style.textContent =
    '.marked::before { content: "→"; color: rgb(255, 0, 0); } .marked::after { content: ""; padding-left: 2px; }';
  document.head.append(style);
  try {
    const root = document.createElement("div");
    root.innerHTML = '<p class="marked">x</p><p>y</p>';
    document.body.append(root);
    const { nodes } = captureGeometry(root);
    expect(Object.keys(nodes)).toEqual([
      "p[0]",
      "p[0]::before",
      "p[0]::after",
      "p[0]/#text[0]",
      "p[1]",
      "p[1]/#text[0]",
    ]);
    const before = nodes["p[0]::before"]!;
    expect(before.box).toBeUndefined();
    expect(before.style).toMatchObject({ content: '"→"', color: "rgb(255, 0, 0)" });
    expect(Object.keys(before.style!)).toEqual([...GEOMETRY_STYLE_PROPERTIES, "content"]);
    expect(nodes["p[0]::after"]!.style).toMatchObject({ content: '""', "padding-left": "2px" });
  } finally {
    style.remove();
  }
});

it("measures the content of a closed <details> as the committed geometry does", () => {
  const root = document.createElement("div");
  root.innerHTML =
    "<section><h2>Notice</h2><p>Shown</p><details><summary>More</summary><p>Hidden</p></details></section>";
  document.body.append(root);
  const { box } = captureGeometry(root).nodes["section[0]/details[0]/p[0]"]!;
  expect(box?.[3]).toBeGreaterThan(0);
});
