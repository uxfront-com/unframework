import { describe, expect, it } from "vitest";

import {
  elementNamespace,
  HTML_ELEMENTS,
  isSvgAttribute,
  isSvgElement,
  SVG_ELEMENT_ATTRIBUTES,
  SVG_ELEMENTS,
  SVG_GLOBAL_ATTRIBUTES,
  SVG_HTML_INTEGRATION_POINTS,
  SVG_PRESENTATION_ATTRIBUTES,
  SVG_TEXT_ELEMENTS,
  SVG_UNRENDERABLE_ELEMENTS,
  SVG_WHITESPACE_KEEPING_ELEMENT,
} from "../src/index.ts";

// The tables name one another; a typo would silently reject valid SVG or accept a name the
// targets render differently. The analyser's conformance tests check them against parse5, Vue's
// `isSVGTag` and the vendored JSX types.
describe("the SVG vocabulary", () => {
  it("names elements that fit the IR's tag pattern, and only renderable ones", () => {
    const tag = /^[A-Za-z][A-Za-z0-9]*$/;
    expect([...SVG_ELEMENTS].filter((name) => !tag.test(name))).toEqual([]);
    expect([...SVG_UNRENDERABLE_ELEMENTS.keys()].filter((name) => SVG_ELEMENTS.has(name))).toEqual(
      [],
    );
    // SVG's `<title>` is the one name HTML shares, which the invariants read by namespace.
    expect([...SVG_ELEMENTS].filter((name) => HTML_ELEMENTS.has(name))).toEqual(["title"]);
  });

  it("names only its own elements in every element fact", () => {
    const facts = [
      ...SVG_TEXT_ELEMENTS,
      SVG_WHITESPACE_KEEPING_ELEMENT,
      ...SVG_ELEMENT_ATTRIBUTES.keys(),
      ...[...SVG_HTML_INTEGRATION_POINTS].filter((name) => !SVG_UNRENDERABLE_ELEMENTS.has(name)),
    ];
    expect(facts.filter((name) => !SVG_ELEMENTS.has(name))).toEqual([]);
    expect(SVG_TEXT_ELEMENTS.has(SVG_WHITESPACE_KEEPING_ELEMENT)).toBe(true);
  });

  it("keeps global and element attributes apart, in the IR's attribute-name pattern", () => {
    const name = /^[^\s"'<>/=]+$/;
    for (const [tag, attributes] of SVG_ELEMENT_ATTRIBUTES) {
      expect(
        [...attributes].filter((attribute) => SVG_GLOBAL_ATTRIBUTES.has(attribute)),
        tag,
      ).toEqual([]);
      expect(
        [...attributes].filter((attribute) => !name.test(attribute)),
        tag,
      ).toEqual([]);
    }
    // Presentation attributes are CSS names: lower case, which the parser keeps.
    expect(
      [...SVG_PRESENTATION_ATTRIBUTES].filter((attribute) => !/^[a-z]+(-[a-z]+)*$/.test(attribute)),
    ).toEqual([]);
  });

  it("accepts an element's own, global, ARIA and data attributes, case-exact, and nothing else", () => {
    expect(isSvgAttribute("svg", "viewBox")).toBe(true);
    expect(isSvgAttribute("circle", "stroke-width")).toBe(true);
    expect(isSvgAttribute("circle", "aria-hidden")).toBe(true);
    expect(isSvgAttribute("circle", "data-x")).toBe(true);
    expect(isSvgAttribute("circle", "role")).toBe(true);
    expect(isSvgAttribute("svg", "viewbox")).toBe(false);
    expect(isSvgAttribute("circle", "viewBox")).toBe(false);
    expect(isSvgAttribute("circle", "strokeWidth")).toBe(false);
    expect(isSvgAttribute("use", "xlink:href")).toBe(false);
    expect(isSvgAttribute("svg", "xmlns")).toBe(false);
    expect(isSvgAttribute("circle", "title")).toBe(false);
    expect(isSvgAttribute("text", "systemLanguage")).toBe(false);
  });

  it("reads SVG's case exactly", () => {
    expect(isSvgElement("linearGradient")).toBe(true);
    expect(isSvgElement("lineargradient")).toBe(false);
    expect(isSvgElement("foreignObject")).toBe(false);
    expect(isSvgElement("a")).toBe(false);
  });

  it("starts SVG at an <svg> and stays in it", () => {
    expect(elementNamespace("svg", "html")).toBe("svg");
    expect(elementNamespace("div", "html")).toBe("html");
    expect(elementNamespace("g", "html")).toBe("html");
    expect(elementNamespace("div", "svg")).toBe("svg");
    expect(elementNamespace("svg", "svg")).toBe("svg");
  });

  it.each(["toString", "valueOf", "constructor", "__proto__", "hasOwnProperty"])(
    "finds nothing for %s",
    (name) => {
      expect(isSvgElement(name)).toBe(false);
      expect(isSvgAttribute("svg", name)).toBe(false);
      expect(isSvgAttribute(name, "x")).toBe(false);
      expect(SVG_UNRENDERABLE_ELEMENTS.get(name)).toBeUndefined();
      expect(SVG_ELEMENT_ATTRIBUTES.get(name)).toBeUndefined();
      expect(SVG_TEXT_ELEMENTS.has(name)).toBe(false);
    },
  );
});
