import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  BOOLEAN_PROPS,
  formControlProp,
  READ_ONLY_VALUE_TYPES,
  REACT_PROP_NAMES,
} from "../src/props.ts";
import { el } from "./fixtures.ts";

/** react-dom's client, development build: the tables below are read from it. */
function reactDomClient(): string {
  const require = createRequire(import.meta.url);
  const root = dirname(require.resolve("react-dom/package.json"));
  return readFileSync(join(root, "cjs", "react-dom-client.development.js"), "utf8");
}

/**
 * react-dom's own table of attribute spellings (`possibleStandardNames`, lower-case name →
 * React prop), read from its development build: React warns about any prop whose lower-case
 * name is in it and whose spelling differs.
 */
function reactStandardNames(): Map<string, string> {
  const source = reactDomClient();
  const start = source.indexOf("possibleStandardNames = {");
  expect(start, "possibleStandardNames is not in react-dom any more").toBeGreaterThan(-1);
  const block = source.slice(start, source.indexOf("}", start));
  const entries = [...block.matchAll(/^\s*(?:"([^"]+)"|([\w$]+)): "([^"]+)",?$/gm)];
  const table = new Map(entries.map((match) => [match[1] ?? match[2] ?? "", match[3] ?? ""]));
  expect(table.size, "too few entries: the table's layout changed").toBeGreaterThan(400);
  return table;
}

/** React's own props, which no HTML or SVG attribute is spelled as. */
const REACT_ONLY = new Set([
  "dangerouslySetInnerHTML",
  "defaultChecked",
  "defaultValue",
  "innerHTML",
  "suppressContentEditableWarning",
  "suppressHydrationWarning",
]);

/** SVG attributes that SVG itself spells in camel case, as React does: they need no entry. */
const SVG_CAMEL_CASE = new Set(
  [
    "allowReorder attributeName attributeType autoReverse baseFrequency baseProfile calcMode",
    "clipPathUnits contentScriptType contentStyleType diffuseConstant edgeMode",
    "externalResourcesRequired filterRes filterUnits glyphRef gradientTransform gradientUnits",
    "kernelMatrix kernelUnitLength keyPoints keySplines keyTimes lengthAdjust limitingConeAngle",
    "markerHeight markerUnits markerWidth maskContentUnits maskType maskUnits numOctaves",
    "pathLength patternContentUnits patternTransform patternUnits pointsAtX pointsAtY pointsAtZ",
    "preserveAlpha preserveAspectRatio primitiveUnits refX refY repeatCount repeatDur",
    "requiredExtensions requiredFeatures specularConstant specularExponent spreadMethod",
    "startOffset stdDeviation stitchTiles surfaceScale systemLanguage tableValues targetX",
    "targetY textLength viewBox viewTarget xChannelSelector yChannelSelector zoomAndPan",
  ]
    .join(" ")
    .split(" "),
);

describe("React prop names", () => {
  const table = reactStandardNames();

  it("spells every attribute as React's own table does", () => {
    const wrong = Object.entries(REACT_PROP_NAMES).filter(
      ([attribute, prop]) => table.get(attribute.toLowerCase()) !== prop,
    );
    expect(wrong).toEqual([]);
  });

  it("covers every attribute React renames", () => {
    // Besides attributes, React's table lists each prop in lower case (`classname`,
    // `strokewidth`) to catch typos: a prop the map already reaches needs no second entry.
    const reached = new Set(Object.values(REACT_PROP_NAMES));
    const missing = [...table].filter(
      ([name, prop]) =>
        name !== prop &&
        !(name in REACT_PROP_NAMES) &&
        !reached.has(prop) &&
        !REACT_ONLY.has(prop) &&
        !SVG_CAMEL_CASE.has(prop),
    );
    expect(missing).toEqual([]);
  });

  it("leaves names React takes as they are", () => {
    for (const name of ["id", "title", "href", "role", "aria-label", "data-state", "viewBox"]) {
      expect(REACT_PROP_NAMES[name], name).toBeUndefined();
    }
  });
});

/** Renders `<tag prop={value}>` to lower-case markup, with React's warnings silenced. */
function markup(tag: string, prop: string, value: true | string): string {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    return renderToStaticMarkup(createElement(tag, { [prop]: value })).toLowerCase();
  } finally {
    spy.mockRestore();
  }
}

/** Renders an HTML boolean attribute the way the React target emits it. */
function rendered(name: string, value: true | string): string {
  const tag = name === "checked" ? "input" : name === "multiple" ? "select" : "video";
  return markup(tag, formControlProp(name, el(tag)) ?? REACT_PROP_NAMES[name] ?? name, value);
}

describe("boolean props", () => {
  it("are booleans to React: present for true, removed for the empty string", () => {
    for (const name of BOOLEAN_PROPS) {
      expect(rendered(name, true), name).toContain(` ${name}=""`);
      expect(rendered(name, ""), name).not.toContain(name);
    }
  });

  it("are every prop in React's table that React renders as a boolean", () => {
    // `style` needs an object (the target reports a static one), so it cannot be probed.
    const booleans = new Set(
      [...new Set(reactStandardNames().values())]
        .filter((prop) => !REACT_ONLY.has(prop) && prop !== "style")
        .filter(
          (prop) =>
            markup("video", prop, true).includes(` ${prop.toLowerCase()}=""`) &&
            markup("video", prop, "") === "<video></video>",
        )
        .map((prop) => prop.toLowerCase()),
    );
    // React handles `checked` only on inputs, where the target passes it as `defaultChecked`.
    booleans.add("checked");
    expect([...BOOLEAN_PROPS].toSorted()).toEqual([...booleans].toSorted());
  });

  it("leave out attributes whose empty value React keeps", () => {
    for (const name of ["aria-hidden", "download", "title", "data-open", "translate"]) {
      expect(BOOLEAN_PROPS.has(name), name).toBe(false);
      expect(rendered(name, ""), name).toContain(` ${name}=""`);
    }
  });
});

describe("form control props", () => {
  it("names the initial state of inputs, selects and text areas", () => {
    expect(formControlProp("value", el("input"))).toBe("defaultValue");
    expect(formControlProp("value", el("input", { type: "email" }))).toBe("defaultValue");
    expect(formControlProp("value", el("select"))).toBe("defaultValue");
    expect(formControlProp("value", el("textarea"))).toBe("defaultValue");
    expect(formControlProp("checked", el("input", { type: "checkbox" }))).toBe("defaultChecked");
  });

  it("leaves `value` alone where React does not control it", () => {
    for (const tag of ["button", "option", "li", "meter", "progress", "data"]) {
      expect(formControlProp("value", el(tag)), tag).toBeUndefined();
    }
    for (const type of READ_ONLY_VALUE_TYPES) {
      expect(formControlProp("value", el("input", { type })), type).toBeUndefined();
    }
    // React matches the type exactly: it controls, and warns about, a `value` on "Submit".
    expect(formControlProp("value", el("input", { type: "Submit" }))).toBe("defaultValue");
  });

  it("knows the input types React leaves alone from react-dom's own table", () => {
    const source = reactDomClient();
    const table = /hasReadOnlyValue = \{([^}]*)\}/.exec(source);
    expect(table, "hasReadOnlyValue is not in react-dom any more").not.toBeNull();
    const types = [...table![1]!.matchAll(/(\w+): !0/g)].map((match) => match[1]!);
    expect(new Set(types)).toEqual(READ_ONLY_VALUE_TYPES);
  });
});
