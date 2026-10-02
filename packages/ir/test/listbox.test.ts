import { describe, expect, it } from "vitest";

import { createElement, createStaticAttribute, createText, listBoxSize } from "../src/index.ts";
import type { ElementNode, RenderNode } from "../src/index.ts";

const at = { start: 0, end: 0 };

let offset = 0;
/** An element whose attributes each have a span of their own, to tell them apart. */
function el(tag: string, attributes: Record<string, string | true>, ...children: RenderNode[]) {
  return createElement(
    tag,
    Object.entries(attributes).map(([name, value]) =>
      createStaticAttribute(name, value, { start: ++offset, end: offset }),
    ),
    children,
    at,
  );
}

function option(attributes: Record<string, string | true> = {}): ElementNode {
  return el("option", attributes, createText("x", at));
}

/** Whether a select with this `size` and an option is a single-selection list box. */
function isListBox(size: string): boolean {
  return listBoxSize(el("select", { size }, option())) !== undefined;
}

describe("listBoxSize", () => {
  it("finds the `size` of a single-selection list box with an option a drop-down would select", () => {
    const listbox = el("select", { name: "s", size: "2" }, option({ disabled: true }), option());
    expect(listBoxSize(listbox)).toBe(listbox.attributes[1]);
    const grouped = el("select", { size: "3" }, el("optgroup", { label: "g" }, option()));
    expect(listBoxSize(grouped)).toBe(grouped.attributes[0]);
  });

  it("reads the display size with HTML's rules for parsing non-negative integers", () => {
    for (const size of ["2", " 2", "\t+3", "2px", "007"]) expect(isListBox(size), size).toBe(true);
    for (const size of ["1", "0", "-0", "-2", "", "x", "\u00a02", "01"]) {
      expect(isListBox(size), size).toBe(false);
    }
  });

  it("finds nothing where a list box selects what a drop-down would", () => {
    const quiet = [
      el("select", { name: "s" }, option()),
      el("select", { size: "2", multiple: true }, option()),
      el("select", { size: "2" }),
      el("select", { size: "2" }, option({ disabled: true })),
      el("select", { size: "2" }, el("optgroup", { label: "g", disabled: true }, option())),
      el("input", { size: "2" }),
    ];
    for (const element of quiet) expect(listBoxSize(element)).toBeUndefined();
  });
});
