import { describe, expect, it } from "vitest";

import {
  CHILDLESS_ATTRIBUTES,
  FIXED_VALUE_INPUT_TYPES,
  GLOBAL_ATTRIBUTES,
  HTML_ELEMENTS,
  isDroppedEmptyUrl,
  isHtmlAttribute,
  isStateAttribute,
  isWhitespaceText,
  OBSOLETE_ELEMENTS,
  STATE_ATTRIBUTES,
  TEMPLATE_SYNTAX_ATTRIBUTES,
  UNPORTABLE_ELEMENTS,
  UNRENDERABLE_ELEMENTS,
  UNRENDERED_ATTRIBUTES,
  WHITESPACE_DROPPING_ELEMENTS,
} from "../src/index.ts";

// The facts name HTML's elements and attributes; a typo would silently disable an invariant.
describe("the portability facts", () => {
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

  it.each(["toString", "constructor", "__proto__"])("find nothing for %s", (name) => {
    for (const table of [
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
