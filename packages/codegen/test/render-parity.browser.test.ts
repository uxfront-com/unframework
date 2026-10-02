// The live-DOM half of the render-parity kit, in Chromium: every target's client parity test
// trusts it, so a reader that missed a difference would pass a renderer that makes one.
import { describe, expect, it } from "vitest";

import { buildDom, expectedDom, readDom } from "./render-parity-client.ts";
import { domOf, el, PARITY_SUITES } from "./render-parity.ts";

/** A read element without the live state of its form controls, as {@link domOf} describes it. */
function withoutState(node: unknown): unknown {
  return JSON.parse(JSON.stringify(node, (key, value) => (key === "state" ? undefined : value)));
}

describe("buildDom", () => {
  it.each(PARITY_SUITES)("builds exactly the DOM domOf describes for %s", (_, cases) => {
    for (const { name, render } of cases) {
      expect(withoutState(expectedDom(render)), name).toEqual(domOf(render));
    }
  });

  it("keeps a leading line feed in <pre>, as JSX does and the HTML parser would not", () => {
    expect(expectedDom(el("pre", {}, "\nx")).children).toEqual(["\nx"]);
  });
});

/** The first element of some HTML, as {@link readDom} reads it. */
function read(html: string) {
  const template = document.createElement("template");
  template.innerHTML = html;
  return readDom(template.content.firstElementChild!);
}

/** An `<input>` of a type, with the value and checkedness a renderer sets as properties. */
function input(type: string, properties: { value?: string; checked?: boolean }): Element {
  const element = document.createElement("input");
  element.type = type;
  Object.assign(element, properties);
  return element;
}

describe("readDom", () => {
  it("reads attributes, text and elements, and merges adjacent text", () => {
    const element = buildDom(el("p", { title: "a" }, "x"));
    element.append("y", "", document.createComment("anchor"), "z");
    expect(readDom(element)).toEqual({ tag: "p", attributes: { title: "a" }, children: ["xyz"] });
  });

  it("tells apart what differs", () => {
    const base = read('<p title="a">x<b>y</b></p>');
    for (const html of [
      '<p title="b">x<b>y</b></p>',
      "<p>x<b>y</b></p>",
      '<p title="a" id="i">x<b>y</b></p>',
      '<p title="a">x <b>y</b></p>',
      '<p title="a">x<i>y</i></p>',
      '<p title="a"><b>y</b>x</p>',
      '<p title="a">x<b>y</b><!---->z</p>',
    ]) {
      expect(read(html), html).not.toEqual(base);
    }
  });

  it("treats HTML's boolean attributes by their presence", () => {
    expect(read('<input disabled="disabled">')).toEqual(read("<input disabled>"));
    expect(read('<div hidden="until-found"></div>')).not.toEqual(read("<div hidden></div>"));
  });

  it("reads the state a renderer sets as a property, not as an attribute", () => {
    // A submit button's value is its attribute: setting the property writes it.
    expect(readDom(input("submit", { value: "Send" }))).toEqual(
      read('<input type="submit" value="Send">'),
    );
    // A text field's or a checkbox's state is not: only the state tells them apart.
    const typed = readDom(input("text", { value: "typed" }));
    expect(typed.attributes).toEqual(read('<input type="text">').attributes);
    expect(typed).not.toEqual(read('<input type="text">'));
    expect(readDom(input("checkbox", { checked: true }))).not.toEqual(
      read('<input type="checkbox">'),
    );
    expect(read("<select><option>a</option><option selected>b</option></select>")).not.toEqual(
      read("<select><option>a</option><option>b</option></select>"),
    );
  });

  it("names an element created in another namespace", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "p");
    expect(readDom(svg).tag).toBe("http://www.w3.org/2000/svg:p");
  });

  it("refuses nodes HTML does not render", () => {
    const element = buildDom(el("p", {}, "a"));
    element.append(document.createProcessingInstruction("x", "y"));
    expect(() => readDom(element)).toThrow("unexpected x node in <p>");
  });
});
