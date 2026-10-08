// The live-DOM half of the render-parity kit, in Chromium: every target's client parity test
// trusts it, so a reader that missed a difference would pass a renderer that makes one.
import { createFragment, createText } from "@unframework/ir";
import type { ElementNode, FragmentNode } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import { buildDom, expectedDom, readDom } from "./render-parity-client.ts";
import { suites } from "./render-parity-manifest.ts";
import { domNodesOf, domOf, el, PARITY_SUITES, styleDeclarations } from "./render-parity.ts";
import type { DomNode } from "./render-parity.ts";

const SVG = "http://www.w3.org/2000/svg";

/** A read element without the live state of its form controls, as {@link domOf} describes it. */
function withoutState(node: unknown): unknown {
  return JSON.parse(JSON.stringify(node, (key, value) => (key === "state" ? undefined : value)));
}

describe("buildDom", () => {
  it.each(PARITY_SUITES.map(({ title, cases }) => [title, cases] as const))(
    "builds exactly the DOM domOf describes for %s",
    (_, cases) => {
      for (const { name, render } of cases) {
        expect(withoutState(expectedDom(render)), name).toEqual([domOf(render as ElementNode)]);
      }
    },
  );

  it("keeps a leading line feed in <pre>, as JSX does and the HTML parser would not", () => {
    expect((expectedDom(el("pre", {}, "\nx"))[0] as { children: unknown }).children).toEqual([
      "\nx",
    ]);
  });

  it("creates SVG in SVG's namespace, with its names' case, and HTML around it in HTML's", () => {
    const element = buildDom(
      el(
        "div",
        {},
        el("svg", { viewBox: "0 0 2 2" }, el("linearGradient", { gradientUnits: "a" })),
      ),
    );
    const svg = element.firstElementChild!;
    expect(element.namespaceURI).toBe("http://www.w3.org/1999/xhtml");
    expect(svg.namespaceURI).toBe(SVG);
    expect(svg.getAttribute("viewBox")).toBe("0 0 2 2");
    expect(svg.firstElementChild!.namespaceURI).toBe(SVG);
    expect(svg.firstElementChild!.localName).toBe("linearGradient");
    expect(readDom(element)).toEqual({
      tag: "div",
      attributes: {},
      children: [
        {
          tag: `${SVG}:svg`,
          attributes: { viewBox: "0 0 2 2" },
          children: [
            { tag: `${SVG}:linearGradient`, attributes: { gradientUnits: "a" }, children: [] },
          ],
        },
      ],
    });
  });

  it("reads a root fragment's nodes as a component's mounted roots", () => {
    const fragment: FragmentNode = createFragment(
      [
        createText("a", { start: 0, end: 0 }),
        el("b", {}, "x"),
        createText(" ", { start: 0, end: 0 }),
      ],
      { start: 0, end: 0 },
    );
    expect(expectedDom(fragment)).toEqual([
      "a",
      { tag: "b", attributes: {}, children: ["x"] },
      " ",
    ]);
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

  // ADR-0044: the same DOM state written differently is the same; anything else differs.
  it("compares a class by its tokens and drops an empty one, but keeps a doubled token", () => {
    expect(read('<p class=" b  a">x</p>')).toEqual(read('<p class="a b">x</p>'));
    expect(read('<p class="">x</p>')).toEqual(read("<p>x</p>"));
    const toggled = buildDom(el("p", { class: "a" }, "x"));
    toggled.classList.remove("a");
    expect(readDom(toggled)).toEqual(read("<p>x</p>"));
    expect(read('<p class="a a">x</p>')).not.toEqual(read('<p class="a">x</p>'));
  });

  it("reads a style through the CSSOM, in any order, set as an attribute or declaration by declaration", () => {
    const set = document.createElement("p");
    set.style.setProperty("margin-top", "4px");
    set.style.setProperty("color", "red");
    expect(readDom(set)).toEqual(read('<p style="color:red;margin-top:4px"></p>'));
    expect(read('<p style="">x</p>')).toEqual(read("<p>x</p>"));
    const emptied = document.createElement("p");
    emptied.style.setProperty("color", "red");
    emptied.style.removeProperty("color");
    expect(readDom(emptied)).toEqual(read("<p></p>"));
    expect(read('<p style="color: red">x</p>')).not.toEqual(read('<p style="color: blue">x</p>'));
    expect(read('<p style="margin-top: 1px; margin: 0">x</p>')).not.toEqual(
      read('<p style="margin: 0; margin-top: 1px">x</p>'),
    );
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
    const svg = document.createElementNS(SVG, "p");
    expect(readDom(svg).tag).toBe(`${SVG}:p`);
    // An SVG element the parser made from markup is in SVG's namespace too.
    expect(read('<div><svg viewBox="0 0 1 1"></svg></div>').children).toEqual([
      { tag: `${SVG}:svg`, attributes: { viewBox: "0 0 1 1" }, children: [] },
    ]);
  });

  it("refuses nodes HTML does not render", () => {
    const element = buildDom(el("p", {}, "a"));
    element.append(document.createProcessingInstruction("x", "y"));
    expect(() => readDom(element)).toThrow("unexpected x node in <p>");
  });
});

/** The properties some read nodes' `style` attributes declare, element by element. */
function declaredProperties(nodes: readonly DomNode[]): string[] {
  return [...elementsOf(nodes)].flatMap((element) =>
    element.attributes.style === undefined
      ? []
      : styleDeclarations(element.attributes.style).map(({ property }) => property),
  );
}

/** Every element of some read nodes, outermost first. */
function* elementsOf(nodes: readonly DomNode[]): Generator<Exclude<DomNode, string>> {
  for (const node of nodes) {
    if (typeof node === "string") continue;
    yield node;
    yield* elementsOf(node.children);
  }
}

// The cases' expected trees, as the plugin lists them for a target's client tests: built here
// as they are there, they must hold what the reference said, and only CSS Chromium keeps (a
// value the CSSOM drops would compare equal however a target wrote it).
describe("the cases' expected trees", () => {
  it("are listed for every client suite", () => {
    expect(suites.length).toBeGreaterThan(20);
    expect(suites.every(({ cases }) => cases.length)).toBe(true);
  });

  it("hold only style declarations Chromium keeps", () => {
    let declarations = 0;
    for (const { title, cases } of suites) {
      for (const { name, expected } of cases) {
        // A shorthand with all its longhands set serialises as itself: the names stay.
        const written = declaredProperties(domNodesOf(expected));
        declarations += written.length;
        expect(declaredProperties(expectedDom(expected)), `${title}, ${name}`).toEqual(written);
      }
    }
    expect(declarations).toBeGreaterThan(100);
  });
});
