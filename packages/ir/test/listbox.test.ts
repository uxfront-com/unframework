import { describe, expect, it } from "vitest";

import {
  createBoundAttribute,
  createBranch,
  createElement,
  createFor,
  createIf,
  createSpreadAttribute,
  createSpreadKey,
  createStaticAttribute,
  createText,
  listBoxSize,
} from "../src/index.ts";
import type { Attribute, ElementNode, RenderNode } from "../src/index.ts";
import { expression, ids } from "./fixtures.ts";

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

const label = () => expression("label", 0, [["label", ids.label]]);
const bound = (name: string) => createBoundAttribute(name, label(), at);
const select = (attributes: Attribute[], ...children: RenderNode[]) =>
  createElement("select", attributes, children, at);
const conditional = (...children: RenderNode[]) =>
  createIf([createBranch(label(), children, at)], at);
const list = (body: ElementNode) =>
  createFor(label(), ids.item, expression("item", 0, [["item", ids.item]]), body, at);

// What is known only at run time counts as a list box (ADR-0033): Vue, the reference target,
// cannot render one, so the `listbox` capability must never miss one.
describe("listBoxSize with bindings and control flow", () => {
  it("finds the attribute that may make a select a list box", () => {
    const size = bound("size");
    expect(listBoxSize(select([size], option()))).toBe(size);
    const spread = createSpreadAttribute(label(), [createSpreadKey("size", at)], false, at);
    expect(listBoxSize(select([spread], option()))).toBe(spread);
    const multiple = bound("multiple");
    const staticSize = createStaticAttribute("size", "2", at);
    expect(listBoxSize(select([staticSize, multiple], option()))).toBe(staticSize);
    const spreadMultiple = createSpreadAttribute(
      label(),
      [createSpreadKey("multiple", at)],
      false,
      at,
    );
    expect(listBoxSize(select([staticSize, spreadMultiple], option()))).toBe(staticSize);
  });

  it("counts an option in a conditional or a list, and one a binding may enable", () => {
    const size = createStaticAttribute("size", "2", at);
    expect(listBoxSize(select([size], conditional(option())))).toBe(size);
    expect(listBoxSize(select([size], list(option())))).toBe(size);
    expect(
      listBoxSize(
        select(
          [size],
          createIf([createBranch(label(), [], at), createBranch(undefined, [option()], at)], at),
        ),
      ),
    ).toBe(size);
    const group = createElement(
      "optgroup",
      [createStaticAttribute("label", "g", at)],
      [conditional(option())],
      at,
    );
    expect(listBoxSize(select([size], group))).toBe(size);
    const maybeDisabled = createElement("option", [bound("disabled")], [createText("x", at)], at);
    expect(listBoxSize(select([size], maybeDisabled))).toBe(size);
  });

  it("finds nothing where no option a drop-down would select can be there", () => {
    const quiet = [
      select([bound("size"), createStaticAttribute("multiple", true, at)], option()),
      select([bound("size")], conditional(option({ disabled: true }))),
      select([bound("size")], list(option({ disabled: true }))),
      select([bound("size")], conditional(createText("x", at))),
      select([bound("name")], option()),
      createElement("input", [bound("size")], [], at),
    ];
    for (const element of quiet) expect(listBoxSize(element)).toBeUndefined();
  });
});
