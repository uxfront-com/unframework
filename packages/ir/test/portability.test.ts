import { describe, expect, it } from "vitest";

import {
  angularRespellsRegex,
  ARIA_ATTRIBUTES,
  CHILDLESS_ATTRIBUTES,
  CONTEXTUAL_ROOT_ELEMENTS,
  DRAFT_ARIA_ATTRIBUTES,
  FIXED_VALUE_INPUT_TYPES,
  GLOBAL_ATTRIBUTES,
  HTML_ELEMENTS,
  isDroppedEmptyUrl,
  isHtmlAttribute,
  isStateAttribute,
  isWhitespaceText,
  LEADING_LINE_FEED_ELEMENTS,
  NESTED_DOCUMENT_ATTRIBUTES,
  NULLISH_VALUE_ELEMENTS,
  OBSOLETE_ELEMENTS,
  RAW_TEXT_ELEMENTS,
  STATE_ATTRIBUTES,
  TEMPLATE_SYNTAX_ATTRIBUTES,
  TEXT_ONLY_ELEMENTS,
  TEXTLESS_ELEMENTS,
  UNBINDABLE_ATTRIBUTES,
  unbindableAttribute,
  UNDECLARED_ATTRIBUTES,
  undeclaredAttribute,
  undeclaredBy,
  UNINTERPOLATED_ELEMENTS,
  UNPORTABLE_ELEMENTS,
  UNRENDERABLE_ELEMENTS,
  UNRENDERED_ATTRIBUTES,
  WHITESPACE_DROPPING_ELEMENTS,
  WHITESPACE_PRESERVING_ELEMENTS,
} from "../src/index.ts";

// The facts name HTML's elements and attributes; a typo would silently disable an invariant.
describe("the portability facts", () => {
  it("name only attributes of their elements as undeclared, and say whose types lack them", () => {
    for (const [tag, attributes] of UNDECLARED_ATTRIBUTES) {
      for (const [name, frameworks] of attributes) {
        expect(tag === "*" || isHtmlAttribute(tag, name), `${tag} ${name}`).toBe(true);
        expect(frameworks.length, name).toBeGreaterThan(0);
      }
    }
    expect([...DRAFT_ARIA_ATTRIBUTES].filter((name) => !ARIA_ATTRIBUTES.has(name))).toEqual([]);
    expect(undeclaredBy("button", "html", "commandfor")).toEqual(["React", "Vue"]);
    expect(undeclaredBy("textarea", "html", "dirname")).toEqual(["React"]);
    expect(undeclaredBy("dialog", "html", "popover")).toEqual(["Vue"]);
    expect(undeclaredBy("g", "svg", "aria-description")).toEqual(["Vue", "Svelte"]);
    expect(undeclaredBy("g", "svg", "popover")).toBeUndefined();
    expect(undeclaredBy("div", "html", "commandfor")).toBeUndefined();
    expect(undeclaredAttribute("img", "html", "ismap")).toBe(
      "React's and Vue's element types do not declare `ismap` (Vue's are the authoring types), so their outputs would not type-check",
    );
    expect(undeclaredAttribute("textarea", "html", "dirname")).toBe(
      "React's element types do not declare `dirname`, so React's output would not type-check",
    );
  });

  // Every element with a `value` content attribute that is not form state: Svelte, and Solid
  // for some, set the property, which writes a nullish value as "0", "", "null" or "undefined".
  it("name the elements whose nullish `value` some targets write", () => {
    expect([...NULLISH_VALUE_ELEMENTS.keys()].toSorted()).toEqual([
      "button",
      "data",
      "input",
      "li",
      "meter",
      "option",
      "progress",
    ]);
    for (const tag of NULLISH_VALUE_ELEMENTS.keys()) {
      expect(isHtmlAttribute(tag, "value"), tag).toBe(true);
    }
  });

  it("keep a <select>'s first selection from bindings", () => {
    for (const [tag, name] of [
      ["select", "size"],
      ["select", "multiple"],
      ["option", "disabled"],
      ["optgroup", "disabled"],
    ] as const) {
      expect(unbindableAttribute(tag, name), `${tag} ${name}`).toContain(
        "decides which option starts selected",
      );
    }
    expect(unbindableAttribute("button", "disabled")).toBeUndefined();
  });

  it("name only HTML elements a component could otherwise render", () => {
    expect(
      [...UNPORTABLE_ELEMENTS.keys()].filter(
        (tag) => !HTML_ELEMENTS.has(tag) || UNRENDERABLE_ELEMENTS.has(tag),
      ),
    ).toEqual([]);
    expect(
      [...WHITESPACE_DROPPING_ELEMENTS].filter(
        (tag) => !HTML_ELEMENTS.has(tag) && !OBSOLETE_ELEMENTS.has(tag),
      ),
    ).toEqual([]);
  });

  it("name only global attributes where any element is meant, and each element's own", () => {
    const names = [
      ...TEMPLATE_SYNTAX_ATTRIBUTES.keys(),
      ...UNRENDERED_ATTRIBUTES.keys(),
      ...CHILDLESS_ATTRIBUTES.keys(),
    ];
    expect(names.filter((name) => !GLOBAL_ATTRIBUTES.has(name))).toEqual([]);
    for (const [tag, attributes] of STATE_ATTRIBUTES) {
      expect([...attributes].filter((name) => !isHtmlAttribute(tag, name))).toEqual([]);
    }
  });

  it("name only attributes of their elements a target cannot bind, every nested document's", () => {
    for (const [tag, attributes] of UNBINDABLE_ATTRIBUTES) {
      expect(
        [...attributes.keys()].filter((name) => !isHtmlAttribute(tag, name)),
        tag,
      ).toEqual([]);
    }
    for (const [tag, name] of NESTED_DOCUMENT_ATTRIBUTES) {
      expect(unbindableAttribute(tag, name), `${tag} ${name}`).toBeDefined();
    }
  });

  it("keep interpolations out of every element whose text the parser moves or drops", () => {
    for (const tag of [...TEXTLESS_ELEMENTS, "select", "datalist", "textarea"]) {
      expect(UNINTERPOLATED_ELEMENTS.has(tag), tag).toBe(true);
    }
    expect(
      [...UNINTERPOLATED_ELEMENTS.keys()].filter(
        (tag) => !HTML_ELEMENTS.has(tag) && !OBSOLETE_ELEMENTS.has(tag),
      ),
    ).toEqual([]);
    // The raw-text elements a component can render: the parser reads markup in them as text,
    // and no interpolation renders there alike.
    for (const tag of RAW_TEXT_ELEMENTS) {
      expect(TEXT_ONLY_ELEMENTS.has(tag), tag).toBe(true);
      expect(UNINTERPOLATED_ELEMENTS.has(tag), tag).toBe(true);
      expect(UNRENDERABLE_ELEMENTS.has(tag), tag).toBe(false);
    }
    // The parser drops a leading line feed only where it keeps whitespace.
    expect(
      [...LEADING_LINE_FEED_ELEMENTS].filter((tag) => !WHITESPACE_PRESERVING_ELEMENTS.has(tag)),
    ).toEqual([]);
  });

  it.each(["toString", "constructor", "__proto__"])("find nothing for %s", (name) => {
    expect(unbindableAttribute(name, "src")).toBeUndefined();
    expect(unbindableAttribute("iframe", name)).toBeUndefined();
    expect(LEADING_LINE_FEED_ELEMENTS.has(name)).toBe(false);
    for (const table of [
      UNBINDABLE_ATTRIBUTES,
      UNINTERPOLATED_ELEMENTS,
      UNPORTABLE_ELEMENTS,
      TEMPLATE_SYNTAX_ATTRIBUTES,
      UNRENDERED_ATTRIBUTES,
      CHILDLESS_ATTRIBUTES,
      STATE_ATTRIBUTES,
    ]) {
      expect(table.get(name)).toBeUndefined();
    }
    expect(isStateAttribute(name, "value", undefined)).toBe(false);
  });
});

describe("isStateAttribute", () => {
  it.each([
    ["input", "value", undefined],
    ["input", "value", "text"],
    ["input", "value", "Email"],
    ["input", "value", "submitt"],
    ["input", "checked", "checkbox"],
    ["option", "selected", undefined],
    ["audio", "muted", undefined],
    ["video", "muted", undefined],
  ])("reads <%s %s> (type %j) as state", (tag, name, type) => {
    expect(isStateAttribute(tag, name, type)).toBe(true);
  });

  // An input's value is state unless the type makes it a label or a submitted value.
  it.each([...FIXED_VALUE_INPUT_TYPES, "SUBMIT", "Checkbox"])(
    "reads the value of an input of type %s as markup",
    (type) => {
      expect(isStateAttribute("input", "value", type)).toBe(false);
    },
  );

  it.each([
    ["button", "value"],
    ["option", "value"],
    ["li", "value"],
    ["div", "muted"],
    ["input", "type"],
  ])("reads <%s %s> as markup", (tag, name) => {
    expect(isStateAttribute(tag, name, undefined)).toBe(false);
  });
});

describe("isDroppedEmptyUrl", () => {
  it.each([
    ["img", "src", ""],
    ["iframe", "src", ""],
    ["object", "data", ""],
    ["area", "href", ""],
  ])("reads an empty <%s %s> as dropped by React", (tag, name, value) => {
    expect(isDroppedEmptyUrl(tag, name, value)).toBe(true);
  });

  it.each([
    ["a", "href", ""],
    ["img", "src", " "],
    ["form", "action", ""],
    ["img", "alt", ""],
  ])("reads <%s %s=%j> as rendered", (tag, name, value) => {
    expect(isDroppedEmptyUrl(tag, name, value)).toBe(false);
  });
});

describe("isWhitespaceText", () => {
  it.each([" ", "\t\n\f\r "])("reads %j as whitespace", (value) => {
    expect(isWhitespaceText(value)).toBe(true);
  });

  // Svelte drops HTML's whitespace only; the others are text.
  it.each(["", "\u00A0", " x ", "\v"])("reads %j as text", (value) => {
    expect(isWhitespaceText(value)).toBe(false);
  });
});

// The Angular dialect's `angularRegex` escapes these; the predicate may only over-approximate.
describe("angularRespellsRegex", () => {
  it.each([
    "/a;b/",
    '/"x"/',
    "/'/",
    "/a  b/",
    "/a\\ b/",
    "/[(]/",
    "/x{{/",
    "/<b>/",
    "/^\\//",
    "/a\tb/",
  ])("reads %s as respelled", (raw) => {
    expect(angularRespellsRegex(raw)).toBe(true);
  });

  it.each(["/ab/", "/a b/g", "/(a)|[b]/", "/\\d{2}/", "/(?<x>a)/"])(
    "reads %s as written",
    (raw) => {
      expect(angularRespellsRegex(raw)).toBe(false);
    },
  );
});

describe("CONTEXTUAL_ROOT_ELEMENTS", () => {
  it("names HTML elements, each tied to its parent by HTML or ARIA (ADR-0056)", () => {
    for (const tag of CONTEXTUAL_ROOT_ELEMENTS) expect(HTML_ELEMENTS.has(tag), tag).toBe(true);
    expect(CONTEXTUAL_ROOT_ELEMENTS.size).toBe(16);
  });
});
