import { describe, expect, it } from "vitest";

import {
  ARIA_ATTRIBUTES,
  BOOLEAN_ATTRIBUTES,
  canonicalNumber,
  DOCUMENT_ATTRIBUTES,
  ELEMENT_ATTRIBUTES,
  GLOBAL_ATTRIBUTES,
  HTML_ELEMENTS,
  ID_REFERENCE_ATTRIBUTES,
  idReferencesIn,
  isBooleanAttribute,
  isDataAttribute,
  isHtmlAttribute,
  isHtmlElement,
  isJavaScriptUrl,
  NESTED_DOCUMENT_ATTRIBUTES,
  NUMERIC_ATTRIBUTES,
  OBSOLETE_ELEMENTS,
  P_CLOSING_ELEMENTS,
  PERMITTED_CHILDREN,
  REPAIRED_DESCENDANTS,
  replaceIdReferences,
  REQUIRED_PARENTS,
  TEXT_ONLY_ELEMENTS,
  TEXTLESS_ELEMENTS,
  TRUE_VALUED_ATTRIBUTES,
  unanalysableUrl,
  unkeptCharacter,
  URL_ATTRIBUTES,
  VOID_ELEMENTS,
} from "../src/index.ts";

const known = (tag: string) => HTML_ELEMENTS.has(tag) || OBSOLETE_ELEMENTS.has(tag);
const anyAttribute = (name: string) =>
  GLOBAL_ATTRIBUTES.has(name) ||
  [...ELEMENT_ATTRIBUTES.values()].some((attributes) => attributes.has(name));

// The facts refer to one another; a typo in one would silently disable a check.
describe("the HTML vocabulary", () => {
  it("keeps current and obsolete elements apart", () => {
    expect([...HTML_ELEMENTS].filter((tag) => OBSOLETE_ELEMENTS.has(tag))).toEqual([]);
  });

  it("names only known elements in every element fact", () => {
    const tags = [
      ...VOID_ELEMENTS,
      ...P_CLOSING_ELEMENTS,
      ...TEXT_ONLY_ELEMENTS,
      ...TEXTLESS_ELEMENTS,
      ...ELEMENT_ATTRIBUTES.keys(),
      ...NUMERIC_ATTRIBUTES.keys(),
      ...[...PERMITTED_CHILDREN].flatMap(([parent, children]) => [parent, ...children]),
      ...[...REQUIRED_PARENTS].flatMap(([child, parents]) => [child, ...parents]),
      ...[...REPAIRED_DESCENDANTS].flatMap(([ancestor, rule]) => [
        ancestor,
        ...rule.descendants,
        ...(rule.resetBy ?? []),
      ]),
    ];
    expect(tags.filter((tag) => !known(tag))).toEqual([]);
  });

  it("names only attributes of some element in every attribute fact", () => {
    const names = [...BOOLEAN_ATTRIBUTES, ...URL_ATTRIBUTES, ...DOCUMENT_ATTRIBUTES];
    expect(names.filter((name) => !anyAttribute(name))).toEqual([]);
    for (const [tag, name] of NESTED_DOCUMENT_ATTRIBUTES) {
      expect([isHtmlAttribute(tag, name), URL_ATTRIBUTES.has(name)]).toEqual([true, true]);
    }
    expect([...TRUE_VALUED_ATTRIBUTES].filter((name) => !isHtmlAttribute("div", name))).toEqual([]);
    for (const [tag, attributes] of NUMERIC_ATTRIBUTES) {
      for (const name of attributes.keys()) expect(isHtmlAttribute(tag, name)).toBe(true);
    }
  });

  it("knows ARIA attributes by their prefix", () => {
    expect([...ARIA_ATTRIBUTES].filter((name) => !name.startsWith("aria-"))).toEqual([]);
  });

  it("accepts an element's own, global, ARIA and data attributes, and nothing else", () => {
    expect(isHtmlAttribute("a", "href")).toBe(true);
    expect(isHtmlAttribute("div", "id")).toBe(true);
    expect(isHtmlAttribute("div", "aria-label")).toBe(true);
    expect(isHtmlAttribute("div", "data-x")).toBe(true);
    expect(isHtmlAttribute("div", "href")).toBe(false);
    expect(isHtmlAttribute("div", "aria-x")).toBe(false);
    expect(isHtmlAttribute("div", "classname")).toBe(false);
  });

  it.each(["data-a", "data-1", "data-a.b", "data-é", "data-a-b_c"])(
    "reads %s as a data attribute",
    (name) => {
      expect(isDataAttribute(name)).toBe(true);
    },
  );

  it.each(["data-", "data", "data-A", "data-a$b", "data-a:b", "dataset"])(
    "does not read %s as a data attribute",
    (name) => {
      expect(isDataAttribute(name)).toBe(false);
    },
  );
});

// Every table is read with names from the source, which may be any identifier.
describe("lookups by a source name", () => {
  const names = ["toString", "valueOf", "constructor", "__proto__", "hasOwnProperty"];

  it.each(names)("find nothing for %s", (name) => {
    expect(isHtmlElement(name)).toBe(false);
    expect(isHtmlAttribute("div", name)).toBe(false);
    expect(isHtmlAttribute(name, "href")).toBe(false);
    expect(isBooleanAttribute(name)).toBe(false);
    for (const table of [
      ELEMENT_ATTRIBUTES,
      NUMERIC_ATTRIBUTES,
      PERMITTED_CHILDREN,
      REQUIRED_PARENTS,
      REPAIRED_DESCENDANTS,
    ]) {
      expect(table.get(name)).toBeUndefined();
    }
    expect(NUMERIC_ATTRIBUTES.get("ol")!.get(name)).toBeUndefined();
  });
});

const upper = (id: string) => id.toUpperCase();

describe("id references", () => {
  it.each([
    ["id", "a", ["a"]],
    ["aria-labelledby", " a\tb\nc ", ["a", "b", "c"]],
    ["for", "a", ["a"]],
    ["commandfor", "dialog", ["dialog"]],
    ["itemref", "a b", ["a", "b"]],
    ["href", "#top", ["top"]],
    ["href", "#", []],
    ["href", "/page#top", []],
    ["usemap", "#map", ["map"]],
    ["xlink:href", "#icon", ["icon"]],
    ["title", "#top", []],
    ["title", "a url(#a) b URL( '#b' ) url(\"#c\")", ["a", "b", "c"]],
    ["data-mask", "url(#mask)", ["mask"]],
    ["class", "url(#a)", ["a"]],
    ["title", "url(a) url(#)", []],
  ])("reads the ids in %s=%j", (name, value, ids) => {
    expect(idReferencesIn(name, value)).toEqual(ids);
  });

  it("replaces each reference where it is written, and nothing else", () => {
    expect(replaceIdReferences("aria-owns", " a\tb ", upper)).toBe(" A\tB ");
    expect(replaceIdReferences("href", "#top", upper)).toBe("#TOP");
    expect(replaceIdReferences("fill", "url('#a') url(b)", upper)).toBe("url('#A') url(b)");
  });

  it("lists only attributes some element has, and the ids ARIA and HTML refer by", () => {
    const unknown = [...ID_REFERENCE_ATTRIBUTES].filter(
      (name) => !anyAttribute(name) && !ARIA_ATTRIBUTES.has(name),
    );
    // Referencing attributes the analyser does not accept yet: still renamed, still reserved.
    expect(unknown.toSorted()).toEqual(["aria-actions", "interestfor"]);
  });
});

// A seeded generator, so a failure names a sample that reproduces.
function random(seed: number): () => number {
  let state = seed;
  return () => (state = (state * 48_271) % 2_147_483_647) / 2_147_483_647;
}

/** `scheme:x` with case changes and the characters URL parsers strip or keep put around it. */
function spellings(scheme: string, count: number): string[] {
  const next = random(scheme.length);
  const noise = ["\t", "\n", "\r", " ", "\u0000", "\u0001", "\u001F", "\u00A0", "x", "-", ":", "/"];
  const pick = () => noise[Math.floor(next() * noise.length)]!;
  const samples: string[] = [];
  for (let index = 0; index < count; index++) {
    let url = next() < 0.5 ? pick() + pick() : "";
    for (const character of `${scheme}:`) {
      url += next() < 0.5 ? character.toUpperCase() : character;
      if (next() < 0.15) url += pick();
    }
    samples.push(`${url}alert(1)`);
  }
  return samples;
}

describe("URLs", () => {
  const urls = [...spellings("javascript", 5_000), ...spellings("data", 5_000)];
  // What the browser reads, with Node's WHATWG URL parser, which follows the same standard. A
  // URL it cannot parse (`//javascript:x` has a port that is not a number) loads nothing.
  const base = "https://base.invalid/";
  const schemeOf = (url: string) =>
    URL.canParse(url, base) ? new URL(url, base).protocol.slice(0, -1) : undefined;

  it("reads a `javascript:` URL as the URL parser and React do", () => {
    // React DOM's own test (sanitizeURL), which turns such a URL into one that throws.
    const react =
      // oxlint-disable-next-line no-control-regex -- React's pattern, verbatim.
      /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
    const disagreements = urls.filter(
      (url) =>
        isJavaScriptUrl(url) !== (schemeOf(url) === "javascript") ||
        isJavaScriptUrl(url) !== react.test(url),
    );
    expect(disagreements).toEqual([]);
    // Each side of the question must be asked, or the samples prove nothing.
    expect(urls.filter(isJavaScriptUrl).length).toBeGreaterThan(500);
    expect(urls.filter((url) => !isJavaScriptUrl(url)).length).toBeGreaterThan(500);
  });

  it("reads a `data:` URL as the URL parser does where a frame loads it", () => {
    const loaded = (url: string) => unanalysableUrl("iframe", "src", url) === "data";
    expect(urls.filter((url) => loaded(url) !== (schemeOf(url) === "data"))).toEqual([]);
    expect(urls.filter(loaded).length).toBeGreaterThan(500);
  });

  it.each([
    ["iframe", "src", "data:text/html,<script>x</script>", "data"],
    ["object", "data", "Data:text/html,x", "data"],
    ["embed", "src", " data:image/svg+xml,x", "data"],
    ["a", "href", "javascript:x", "javascript"],
    ["iframe", "src", "javascript:x", "javascript"],
    ["form", "action", "\tjavascript:x", "javascript"],
  ])("finds code the compiler cannot analyse in <%s %s=%j>", (tag, name, value, scheme) => {
    expect(unanalysableUrl(tag, name, value)).toBe(scheme);
  });

  // Images, media and destinations a user follows run no code in the page; a blob: URL names
  // content the page creates at run time, which the source cannot hold.
  it.each([
    ["img", "src", "data:image/svg+xml,<svg></svg>"],
    ["video", "poster", "data:image/png;base64,AAAA"],
    ["source", "src", "data:video/mp4;base64,AAAA"],
    ["a", "href", "data:text/html,x"],
    ["form", "action", "data:text/html,x"],
    ["iframe", "src", "blob:https://example.com/0c4f"],
    ["object", "data", "filesystem:https://example.com/temporary/a.pdf"],
    ["iframe", "src", "/data:x"],
    ["iframe", "title", "javascript:x"],
    ["iframe", "name", "data:x"],
  ])("accepts <%s %s=%j>", (tag, name, value) => {
    expect(unanalysableUrl(tag, name, value)).toBeUndefined();
  });
});

describe("canonicalNumber", () => {
  it.each([
    ["3", "positive-integer", "3"],
    ["03", "positive-integer", "3"],
    ["0.50", "number", "0.5"],
    [".5", "number", "0.5"],
    ["1e2", "number", "100"],
    ["-0", "integer", "0"],
    ["1e+21", "number", "1e+21"],
    ["65534", "non-negative-integer", "65534"],
  ] as const)("writes %j as a %s the way the DOM does", (value, kind, canonical) => {
    expect(canonicalNumber(value, { kind })).toBe(canonical);
  });

  it.each([
    ["0", "positive-integer", undefined],
    ["1001", "positive-integer", 1000],
    ["x", "number", undefined],
    ["+3", "integer", undefined],
    ["1e1", "integer", undefined],
    ["3000000000", "integer", undefined],
    ["-1", "non-negative-integer", undefined],
    ["50%", "non-negative-integer", undefined],
  ] as const)("rejects %j as a %s", (value, kind, max) => {
    expect(canonicalNumber(value, max === undefined ? { kind } : { kind, max })).toBeUndefined();
  });
});

describe("unkeptCharacter", () => {
  it.each([
    ["000D", "carriage-return"],
    ["0000", "nul"],
    ["D800", "surrogate"],
    ["DFFF", "surrogate"],
    ["0001", "control"],
    ["000B", "control"],
    ["007F", "control"],
    ["009F", "control"],
    ["FDD0", "noncharacter"],
    ["FFFE", "noncharacter"],
    ["10FFFF", "noncharacter"],
  ])("does not keep U+%s (%s)", (hex, kind) => {
    expect(unkeptCharacter(Number.parseInt(hex, 16))).toBe(kind);
  });

  it.each(["0009", "000A", "000C", "0020", "00A0", "FFFD", "1F600"])("keeps U+%s", (hex) => {
    expect(unkeptCharacter(Number.parseInt(hex, 16))).toBeUndefined();
  });
});
