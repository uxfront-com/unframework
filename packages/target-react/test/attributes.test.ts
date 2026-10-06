// The React target's attribute spellings and values, checked against React's own JSX types
// (@types/react, L4) for every attribute the IR can hold: each name the target writes must be a
// prop React declares, and a prop React types as `number` must be written as a number
// (`tabIndex={0}`, design §5.1). The IR's NUMBER_TYPED_ATTRIBUTES says which those are; this
// pins it against React (the Qwik target pins it against Qwik). The names React's types lack are
// the IR's UNDECLARED_ATTRIBUTES, which the analyser rejects for every target.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { formatOutput } from "@unframework/codegen";
import {
  ARIA_ATTRIBUTES,
  createComponent,
  createElement,
  createExport,
  createModule,
  createStaticAttribute,
  DOCUMENT_ATTRIBUTES,
  ELEMENT_ATTRIBUTES,
  GLOBAL_ATTRIBUTES,
  HTML_ELEMENTS,
  isBooleanAttribute,
  isNumberTypedAttribute,
  isStateAttribute,
  isSvgAttribute,
  SVG_ELEMENT_ATTRIBUTES,
  SVG_ELEMENTS,
  SVG_GLOBAL_ATTRIBUTES,
  TEMPLATE_SYNTAX_ATTRIBUTES,
  undeclaredBy,
  UNPORTABLE_ELEMENTS,
  UNRENDERED_ATTRIBUTES,
} from "@unframework/ir";
import { afterAll, describe, expect, it } from "vitest";

import target from "../src/index.ts";
import { BOOLEAN_PROPS } from "../src/props.ts";
import { toolchain } from "../src/toolchain/index.ts";
import { packageDir, toolchainDir } from "./fixtures.ts";

const context = { toolchainDir, root: packageDir };
mkdirSync(join(packageDir, ".uf-tmp"), { recursive: true });
const scratch = mkdtempSync(join(packageDir, ".uf-tmp", "attributes-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

type Pair = readonly [tag: string, attribute: string];

/**
 * Names no IR holds whatever their value, so no output writes them: `class` and `style` (their
 * own kinds), template syntax, attributes a target acts on instead of rendering, documents, and
 * the names some framework's element types lack.
 */
const neverWritten = (tag: string, namespace: "html" | "svg", name: string) =>
  name === "class" ||
  name === "style" ||
  TEMPLATE_SYNTAX_ATTRIBUTES.has(name) ||
  UNRENDERED_ATTRIBUTES.has(name) ||
  DOCUMENT_ATTRIBUTES.has(name) ||
  undeclaredBy(tag, namespace, name) !== undefined ||
  (namespace === "html" && isStateAttribute(tag, name, undefined));

/** Every (element, attribute) pair of the IR's vocabulary, HTML and SVG apart. */
function vocabulary(): { html: Pair[]; svg: Pair[] } {
  const pairs = (
    namespace: "html" | "svg",
    tags: Iterable<string>,
    names: (tag: string) => Iterable<string>,
  ) =>
    [...tags].flatMap((tag) =>
      [...new Set(names(tag))]
        .filter((name) => !neverWritten(tag, namespace, name))
        .map((name): Pair => [tag, name]),
    );
  return {
    html: pairs(
      "html",
      [...HTML_ELEMENTS].filter(
        (tag) => tag !== "svg" && tag !== "math" && !UNPORTABLE_ELEMENTS.has(tag),
      ),
      (tag) => [...GLOBAL_ATTRIBUTES, ...ARIA_ATTRIBUTES, ...(ELEMENT_ATTRIBUTES.get(tag) ?? [])],
    ),
    // The descriptive elements (`<title>`, `<desc>`) take the core attributes only.
    svg: pairs("svg", SVG_ELEMENTS, (tag) =>
      [...SVG_GLOBAL_ATTRIBUTES, ...(SVG_ELEMENT_ATTRIBUTES.get(tag) ?? [])].filter((name) =>
        isSvgAttribute(tag, name),
      ),
    ),
  };
}

/** Some elements by name, or every element that has the attribute but some. */
type Elements = { readonly on: readonly string[] } | { readonly except: readonly string[] };

/**
 * Attributes the IR holds that @types/react 19.3 does not declare on some elements: no React
 * spelling makes their output type-check, though React renders them. Pinned so the list only
 * shrinks (an entry that starts passing fails the test). There are none: the HTML ones are the
 * IR's UNDECLARED_ATTRIBUTES, and SVG's `<title>`, which React types as HTML's, takes only the
 * core attributes (SVG_DESCRIPTIVE_ATTRIBUTES).
 */
const REACT_NAME_GAPS: Readonly<Record<"html" | "svg", Readonly<Record<string, Elements>>>> = {
  html: {},
  svg: {},
};

/** The pinned gaps as (element → attributes), for the pairs given. */
function gapsOf(pairs: readonly Pair[], gaps: Readonly<Record<string, Elements>>) {
  const found = new Map<string, string[]>();
  for (const [tag, name] of pairs) {
    const elements = gaps[name];
    if (!elements) continue;
    if ("on" in elements ? elements.on.includes(tag) : !elements.except.includes(tag)) {
      found.set(name, [...(found.get(name) ?? []), tag]);
    }
  }
  return Object.fromEntries(found);
}

/**
 * Emits each pair as a childless element with one static attribute (`value` given per pair)
 * under one root, through the React target; rewrites the output with `edit` (a test's
 * control), formats and type-checks it. Returns the failing pairs' indexes, with the messages.
 */
async function typecheck(
  name: string,
  root: "div" | "svg",
  pairs: readonly Pair[],
  value: (pair: Pair) => string | true,
  edit: (contents: string) => string = (contents) => contents,
): Promise<Map<number, string>> {
  const at = { start: 0, end: 0 };
  const children = pairs.map((pair) =>
    createElement(pair[0], [createStaticAttribute(pair[1], value(pair), at)], [], at),
  );
  const module = createModule(
    `${name}.uf.tsx`,
    [createComponent(name, createElement(root, [], children, at), at)],
    [createExport("default", name, at)],
  );
  const [file] = target.emit(module.components[0]!, {
    module,
    options: undefined,
    report: (diagnostic) => {
      throw new Error(diagnostic.message);
    },
  });
  const outcome = await formatOutput({ ...file!, contents: edit(file!.contents) });
  expect(outcome.error).toBeUndefined();
  const lines = outcome.file.contents.split("\n");
  // Each element sits on its own line, in order, after the root's opening line.
  const first = lines.findIndex((line) => line.trim() === `<${root}>`) + 2;
  expect(lines[first - 1 + pairs.length]?.trim()).toBe(`</${root}>`);
  const path = join(scratch, `${name}.tsx`);
  writeFileSync(path, outcome.file.contents);
  const results = await toolchain.typecheck([path], context);
  return new Map(results.get(path)!.map((message) => [message.line! - first, message.message]));
}

/** A value of the right form whose own type is beside the point: the test checks names. */
const anyValue = ([tag, name]: Pair): string | true =>
  isBooleanAttribute(name) && !SVG_ELEMENTS.has(tag)
    ? true
    : isNumberTypedAttribute(tag, name)
      ? "1"
      : "x";

/** What tsgo says of a string where React's types take a number alone. */
const NUMBER_ONLY = /not assignable to type 'number(?: \| undefined)?'/;

/** Writes every quoted value as `{undefined}`, so only the attribute's name is checked. */
const namesOnly = (contents: string) => contents.replace(/="x"/g, "={undefined}");

describe("React's attribute types", { timeout: 120_000 }, () => {
  const { html, svg } = vocabulary();

  it.each([
    ["html", "div", html],
    ["svg", "svg", svg],
  ] as const)(
    "declare every %s attribute the target writes, but the pinned gaps",
    async (namespace, root, pairs) => {
      expect(pairs.length).toBeGreaterThan(1000);
      const failing = await typecheck(`Names_${namespace}`, root, pairs, anyValue, namesOnly);
      const gaps = new Map<string, string[]>();
      for (const index of failing.keys()) {
        const [tag, name] = pairs[index]!;
        gaps.set(name, [...(gaps.get(name) ?? []), tag]);
      }
      expect(Object.fromEntries(gaps)).toEqual(gapsOf(pairs, REACT_NAME_GAPS[namespace]));
    },
  );

  // The target writes a boolean attribute bare and binds it as it is (`disabled={locked}`):
  // React renders presence only for its own boolean props, and warns about `true` elsewhere.
  it("take every boolean attribute the IR can hold as a boolean prop", () => {
    const booleans = new Set(html.filter(([, name]) => isBooleanAttribute(name)).map(([, n]) => n));
    expect(booleans.size).toBeGreaterThan(15);
    expect([...booleans].filter((name) => !BOOLEAN_PROPS.has(name))).toEqual([]);
  });

  it("take numbers for the number-typed attributes, which the target writes as numbers", async () => {
    // React's JSX elements are typed by name alone, so SVG's sit under a `<div>` too.
    const pairs = [...html, ...svg].filter(([tag, name]) => isNumberTypedAttribute(tag, name));
    expect(new Set(pairs.map(([, name]) => name)).size).toBeGreaterThan(20);
    // As the target writes them, `tabIndex={1}`: React's types take every one.
    const numbers = await typecheck("Numbers", "div", pairs, () => "1");
    expect([...numbers.values()]).toEqual([]);
    // The control: as strings, React's types reject every one but those the table holds for
    // Qwik's sake (React takes a string or a number there), so each entry is needed.
    const strings = await typecheck(
      "Strings",
      "div",
      pairs,
      () => "1",
      (contents) => contents.replace(/=\{1\}/g, '="1"'),
    );
    // Every message says so, as the next test reads them.
    for (const message of strings.values()) expect(message).toMatch(NUMBER_ONLY);
    const taken = pairs.filter((_, index) => !strings.has(index)).map((pair) => pair.join(" "));
    expect(taken).toEqual([
      "img height",
      "img width",
      "meter max",
      "meter min",
      "video height",
      "video width",
    ]);
  });

  it("take a string for every other attribute: none is typed as a number alone", async () => {
    const strings = [...html, ...svg].filter(
      ([tag, name]) => !isNumberTypedAttribute(tag, name) && !isBooleanAttribute(name),
    );
    const failing = await typecheck("Others", "div", strings, () => "1");
    const numeric = [...failing]
      .filter(([, message]) => NUMBER_ONLY.test(message))
      .map(([index]) => strings[index]!.join(" "));
    expect(numeric).toEqual([]);
  });
});
