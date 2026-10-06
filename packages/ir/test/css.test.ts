import { describe, expect, it } from "vitest";

import {
  angularLowercases,
  angularMisreads,
  CSS_PROPERTIES,
  CSS_SHORTHANDS,
  cssPropertiesOverlap,
  cssValueProblem,
  isCssPropertyName,
  isCustomProperty,
  isKnownCssProperty,
  UNITLESS_PROPERTIES,
} from "../src/index.ts";

describe("the CSS facts", () => {
  it("name standard properties only", () => {
    expect([...UNITLESS_PROPERTIES].filter((name) => !isCssPropertyName(name))).toEqual([]);
    expect([...UNITLESS_PROPERTIES].filter(isCustomProperty)).toEqual([]);
    expect([...CSS_SHORTHANDS.keys()].filter((name) => !isCssPropertyName(name))).toEqual([]);
  });

  // Chromium expands a shorthand (and a legacy alias) into longhands only: one that listed a
  // shorthand, or itself, would make the overlap check miss what that shorthand sets.
  it("expand each shorthand into longhands other than itself", () => {
    for (const [shorthand, longhands] of CSS_SHORTHANDS) {
      expect(longhands.size, shorthand).toBeGreaterThan(0);
      expect(longhands.has(shorthand), shorthand).toBe(false);
      expect(
        [...longhands].filter((longhand) => CSS_SHORTHANDS.has(longhand)),
        shorthand,
      ).toEqual([]);
    }
  });

  it.each([
    ["color", "color", true],
    ["margin", "margin-top", true],
    ["margin-top", "margin", true],
    ["border", "border-top-color", true],
    ["border-top", "border-color", true],
    ["border-color", "border-top", true],
    ["font", "line-height", true],
    ["grid-gap", "row-gap", true],
    ["word-wrap", "overflow-wrap", true],
    ["all", "color", true],
    ["margin", "padding", false],
    ["margin-top", "margin-bottom", false],
    ["border-top", "border-bottom", false],
    ["all", "direction", false],
    ["all", "--gap", false],
    ["--gap", "--gap", true],
    ["--gap", "--Gap", false],
    // A flow-relative longhand and a physical one the writing mode can make the same.
    ["margin-inline-start", "margin-left", true],
    ["margin-inline", "margin-right", true],
    ["margin-block", "margin", true],
    ["padding-block-end", "padding-bottom", true],
    ["inset-inline-start", "left", true],
    ["inline-size", "width", true],
    ["max-block-size", "max-height", true],
    ["border-inline-start-color", "border-left-color", true],
    ["border-start-end-radius", "border-top-right-radius", true],
    ["overflow-inline", "overflow-x", true],
    ["overflow-inline", "overflow", true],
    // Different groups, or both flow-relative, or both physical.
    ["margin-inline-start", "padding-left", false],
    ["margin-inline-start", "margin-block-start", false],
    ["inline-size", "max-width", false],
    ["border-inline-start-color", "border-left-width", false],
    ["width", "height", false],
  ])("reads %s and %s as overlapping: %s", (a, b, overlap) => {
    expect(cssPropertiesOverlap(a, b)).toBe(overlap);
    expect(cssPropertiesOverlap(b, a)).toBe(overlap);
  });

  it("know every property the other facts name, and standard names only", () => {
    expect(CSS_PROPERTIES.size).toBeGreaterThan(500);
    expect([...CSS_PROPERTIES].filter((name) => !isCssPropertyName(name))).toEqual([]);
    const named = [
      ...UNITLESS_PROPERTIES,
      ...CSS_SHORTHANDS.keys(),
      ...[...CSS_SHORTHANDS.values()].flatMap((longhands) => [...longhands]),
    ];
    // Chromium expands `border-spacing` and `mask-position` into longhands of its own prefix.
    expect(
      named.filter((name) => !name.startsWith("-webkit-") && !CSS_PROPERTIES.has(name)),
    ).toEqual([]);
    expect(isKnownCssProperty("margin-top")).toBe(true);
    expect(isKnownCssProperty("--anything")).toBe(true);
    expect(isKnownCssProperty("colour")).toBe(false);
    expect(isKnownCssProperty("line-clamp")).toBe(false);
  });

  it.each(["margin-top", "z-index", "--gap", "--Gap_2", "all"])(
    "accepts the property %s",
    (name) => {
      expect(isCssPropertyName(name)).toBe(true);
    },
  );

  it.each(["marginTop", "-webkit-line-clamp", "Margin", "--", "--a b", "margin-", "z_index", ""])(
    "rejects the property %j",
    (name) => {
      expect(isCssPropertyName(name)).toBe(false);
    },
  );

  it.each([
    "red",
    "4px 8px",
    'url("a;b.png")',
    "url(data:image/png;base64,AA==)",
    '"a!" serif',
    "calc(1px + (2px * 3))",
    "rgb(0 0 0 / 50%)",
    "/* a; */ red",
    "'it\\'s'",
  ])("accepts the value %j", (value) => {
    expect(cssValueProblem(value)).toBeUndefined();
  });

  it.each([
    ["", "must not be empty"],
    [" red", "whitespace"],
    ["red ", "whitespace"],
    ["red; color: blue", "a `;` ends the declaration"],
    ["red !important", "`!important`"],
    ["red!important", "`!important`"],
    ['"red', "must close its strings"],
    ["url(a", "must balance its brackets"],
    ["a)", "must balance its brackets"],
    ["(a]", "must balance its brackets"],
    ["red /* a", "must close its comments"],
  ])("rejects the value %j", (value, problem) => {
    expect(cssValueProblem(value)).toContain(problem);
  });

  it.each(["toString", "constructor", "__proto__"])("finds nothing for %s", (name) => {
    expect(UNITLESS_PROPERTIES.has(name)).toBe(false);
    expect(CSS_SHORTHANDS.get(name)).toBeUndefined();
    expect(cssPropertiesOverlap(name, "color")).toBe(false);
  });

  // Angular's style parser (`parse`), which its compiler and its server DOM read styles with.
  it.each([
    ['"a\\";b"', true],
    ['"("', true],
    ["red /* it's */", true],
    ["red /* a; b */", true],
    ['"a(b)"', false],
    ["'A\"B', serif", false],
    ["url(data:image/png;base64,AA==)", false],
    ["1px", false],
  ])("reads %j as Angular misreads it: %s", (value, misread) => {
    expect(angularMisreads(value)).toBe(misread);
  });

  it("lowercases a custom property with an upper-case letter, as Angular does", () => {
    expect(angularLowercases("--Gap")).toBe(true);
    expect(angularLowercases("--gap")).toBe(false);
    expect(angularLowercases("margin-top")).toBe(false);
  });
});
