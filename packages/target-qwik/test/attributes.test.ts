// The Qwik target's attribute tables, checked against Qwik's own JSX types (L4) for every HTML
// attribute the authoring types accept: a spelling Qwik needs (`tabindex` → `tabIndex`) must be
// in QWIK_ATTRIBUTE_NAMES, an attribute Qwik declares under no name must be in
// QWIK_UNTYPED_ATTRIBUTES, a boolean attribute must be written so Qwik's `boolean` accepts it,
// whatever its value, and a number-typed one as a number. The authoring types are Vue's vendored
// JSX types (ADR-0006).
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { formatOutput } from "@unframework/codegen";
import {
  BOOLEAN_ATTRIBUTES,
  createComponent,
  createElement,
  createExport,
  createModule,
  createStaticAttribute,
  NUMBER_TYPED_ATTRIBUTES,
  NUMBER_TYPED_GLOBAL_ATTRIBUTES,
} from "@unframework/ir";
import { afterAll, describe, expect, it } from "vitest";

import { enumeratedValues } from "../../analyzer/src/enumerated.ts";
import { analyze } from "../../analyzer/src/index.ts";
import { parseModule } from "../../parser/src/index.ts";
import {
  isUntypedAttribute,
  QWIK_BOOLEAN_ATTRIBUTES,
  QWIK_UNTYPED_ATTRIBUTES,
  qwikAttributeName,
} from "../src/attributes.ts";
import target from "../src/index.ts";
import { toolchain } from "../src/toolchain/index.ts";

const repo = fileURLToPath(new URL("../../..", import.meta.url));
const context = {
  toolchainDir: join(repo, "tests/toolchains/qwik"),
  root: join(repo, "tests/integration"),
};
const scratchRoot = fileURLToPath(new URL("../.uf-tmp", import.meta.url));
mkdirSync(scratchRoot, { recursive: true });
const scratch = mkdtempSync(join(scratchRoot, "attributes-test-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/**
 * Attributes outside this check: `class` and `style` (their forms have their own tests),
 * `aria-*` and `data-*` (Qwik accepts any), event handlers (M2), `is` and `innerHTML`.
 */
const OUT_OF_SCOPE = /^(?:class|style|aria-.*|data-.*|on.*|is|innerhtml)$/;
/** Elements Qwik's types accept any attribute on: obsolete (`keygen`, `param`) or not HTML. */
const UNTYPED_ELEMENTS = new Set(["keygen", "noindex", "param", "webview"]);

const vendored = readFileSync(join(repo, "packages/unframework/src/vendor/vue-jsx.d.ts"), "utf8");

/** Every (element, attribute, authoring type) the authoring types declare on an HTML element. */
function authoringPairs(): [tag: string, attribute: string, type: string][] {
  const interfaces = new Map<string, { parents: string[]; members: [string, string][] }>();
  for (const match of vendored.matchAll(
    /export interface (\w+)(?: extends ([\w<>, ]+))? \{([\s\S]*?)\n\}/g,
  )) {
    interfaces.set(match[1]!, {
      parents: (match[2] ?? "").split(",").map((parent) => parent.trim().replace(/<.*$/, "")),
      members: [...match[3]!.matchAll(/^ {4}'?([a-z][a-z0-9-]*)'?\??: ([^;]*);/gm)].map(
        (member): [string, string] => [member[1]!, member[2]!],
      ),
    });
  }
  const membersOf = (name: string): [string, string][] => {
    const entry = interfaces.get(name);
    return entry ? [...entry.parents.flatMap(membersOf), ...entry.members] : [];
  };
  const elements = vendored.match(
    /export interface IntrinsicElementAttributes \{([\s\S]*?)\n\}/,
  )![1]!;
  return [...elements.matchAll(/^ {4}(\w+): (\w*HTMLAttributes);/gm)]
    .filter(([, tag]) => !UNTYPED_ELEMENTS.has(tag!))
    .flatMap(([, tag, type]) => {
      const members = new Map(membersOf(type!));
      return [...members]
        .filter(([name]) => !OUT_OF_SCOPE.test(name))
        .map(([name, member]): [string, string, string] => [tag!, name, member]);
    });
}

/** Some elements by name, or every element that has the attribute but some. */
type Elements = { readonly on: readonly string[] } | { readonly except: readonly string[] };

/**
 * Attributes the authoring types accept that Qwik 2.0.0-beta.47's JSX types do not declare on
 * some elements, and that the analyser rejects there (the second test proves it), so no IR
 * carries them. Pinned so the list only shrinks (an entry that starts passing fails the test).
 * What the analyser accepts and Qwik does not declare is QWIK_UNTYPED_ATTRIBUTES.
 */
const QWIK_NAME_GAPS: Readonly<Record<string, Elements>> = {
  acceptcharset: { on: ["form"] },
  allowtransparency: { on: ["iframe"] },
  autosave: { except: [] },
  classid: { on: ["object"] },
  color: { except: ["hr"] },
  contextmenu: { except: [] },
  controlslist: { on: ["audio", "video"] },
  crossorigin: { on: ["input"] },
  dirname: { on: ["textarea"] },
  exportparts: { except: [] },
  hreflang: { on: ["area"] },
  httpequiv: { on: ["meta"] },
  manifest: { on: ["html"] },
  media: { on: ["a", "area"] },
  mediagroup: { on: ["audio", "video"] },
  part: { except: [] },
  placeholder: { except: ["input", "textarea"] },
  playsinline: { on: ["audio"] },
  prefix: { except: [] },
  radiogroup: { except: [] },
  type: { on: ["menu"] },
};

const covers = (elements: Elements, tag: string) =>
  "on" in elements ? elements.on.includes(tag) : !elements.except.includes(tag);

/** The pinned gaps as (element, attribute) pairs of the authoring types. */
function gapsOf(pairs: readonly [string, string, string][]): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(QWIK_NAME_GAPS).map(([attribute, elements]) => [
      attribute,
      pairs
        .filter(([tag, name]) => name === attribute && covers(elements, tag))
        .map(([tag]) => tag),
    ]),
  );
}

let files = 0;

/** Type-checks a Qwik component file and returns the 0-based indices of the failing lines. */
async function failingLines(contents: string, first: number): Promise<Set<number>> {
  const path = join(scratch, `Attributes${files++}.tsx`);
  writeFileSync(path, contents);
  const results = await toolchain.typecheck([path], context);
  return new Set(results.get(path)!.map((message) => message.line! - first));
}

/** Emits the elements through the Qwik target and type-checks them, one element per line. */
async function typecheck(
  pairs: readonly (readonly [string, string, string])[],
  blankStrings: boolean,
): Promise<Set<number>> {
  const at = { start: 0, end: 0 };
  const children = pairs.map(([tag, attribute, value]) =>
    createElement(tag, [createStaticAttribute(attribute, value, at)], [], at),
  );
  const render = createElement("div", [], children, at);
  const module = createModule(
    "Attributes.uf.tsx",
    [createComponent("Attributes", render, at)],
    [createExport("default", "Attributes", at)],
  );
  const [file] = target.emit(module.components[0]!, {
    module,
    options: undefined,
    report: (diagnostic) => {
      throw new Error(diagnostic.message);
    },
  });
  // A string value only tests the name: Qwik types many values narrower than HTML does.
  const contents = blankStrings ? file!.contents.replace(/="x"/g, "={undefined}") : file!.contents;
  const formatted = (await formatOutput({ ...file!, contents })).file.contents;
  // Each element sits on its own line, in order, after the `<div>` line.
  const first = formatted.split("\n").findIndex((line) => line.trim().startsWith("<div>")) + 2;
  return failingLines(formatted, first);
}

/** A hand-written Qwik component of one JSX line per entry, after some declarations. */
async function typecheckLines(lines: readonly string[], before = ""): Promise<Set<number>> {
  const head = `import { component$ } from "@qwik.dev/core";\n${before}\nexport default component$(() => {\n  return (\n    <>`;
  const contents = `${head}\n${lines.map((line) => `      ${line}`).join("\n")}\n    </>\n  );\n});\n`;
  return failingLines(contents, head.split("\n").length + 1);
}

/**
 * Whether the analyser rejects an attribute on an element, whatever its value: it reports the
 * attribute itself (written with a value its kind takes), or the element (`<meta>`, `<html>`:
 * UF3002), so no IR carries the pair. Placement problems (`<td>` outside a table) do not count.
 */
function rejects(tag: string, attribute: string): boolean {
  // A value of the attribute's kind: an enumerated one's first token (ADR-0037).
  const enumerated = enumeratedValues(tag, "html", attribute);
  const token = enumerated?.tokens[0] ?? (enumerated?.boolean ? "true" : undefined);
  const value = BOOLEAN_ATTRIBUTES.has(attribute)
    ? ""
    : NUMBER_TYPED_GLOBAL_ATTRIBUTES.has(attribute) ||
        NUMBER_TYPED_ATTRIBUTES.get(tag)?.has(attribute)
      ? '="1"'
      : `="${token ?? "x"}"`;
  const written = ` ${attribute}${value}`;
  const source = `export function A() {\n  return <div><${tag}${written}></${tag}></div>;\n}\n`;
  const start = source.indexOf(written) + 1;
  const end = start + written.length - 1;
  return analyze(parseModule("A.uf.tsx", source)).diagnostics.some(
    (diagnostic) =>
      diagnostic.severity === "error" &&
      ((diagnostic.span.start >= start && diagnostic.span.end <= end) ||
        diagnostic.code === "UF3002"),
  );
}

describe("Qwik's attribute types", { timeout: 120_000 }, () => {
  it("accept every HTML attribute the target writes, but the pinned gaps", async () => {
    const pairs = authoringPairs();
    expect(pairs.length).toBeGreaterThan(1000);
    const failing = await typecheck(
      pairs.map(([tag, attribute]) => [tag, attribute, "x"]),
      true,
    );
    const gaps = new Map<string, string[]>();
    pairs.forEach(([tag, attribute], index) => {
      if (failing.has(index)) gaps.set(attribute, [...(gaps.get(attribute) ?? []), tag]);
    });
    expect(Object.fromEntries(gaps)).toEqual(gapsOf(pairs));
  });

  it("leave out only attributes the analyser rejects", () => {
    const gaps = Object.entries(gapsOf(authoringPairs())).flatMap(([attribute, tags]) =>
      tags.map((tag) => `<${tag} ${attribute}>`),
    );
    expect(gaps.length).toBeGreaterThan(20);
    const accepted = gaps.filter((pair) => {
      const [tag, attribute] = pair.slice(1, -1).split(" ");
      return !rejects(tag!, attribute!);
    });
    expect(accepted).toEqual([]);
  });

  it("declare no name for the untyped attributes, which the analyser accepts", async () => {
    // Every entry reaches the target (the analyser accepts it on some element it covers), and
    // there it is needed: written as a plain attribute it fails, as the target writes it it
    // passes.
    const pairs = authoringPairs().filter(([tag, attribute]) => {
      const elements = QWIK_UNTYPED_ATTRIBUTES[attribute];
      return elements !== undefined && covers(elements, tag) && !rejects(tag, attribute);
    });
    expect(new Set(pairs.map(([, attribute]) => attribute))).toEqual(
      new Set(Object.keys(QWIK_UNTYPED_ATTRIBUTES)),
    );
    const plain = pairs.map(
      ([tag, attribute]) => `<${tag} ${qwikAttributeName(attribute, "html")}="x" />`,
    );
    const failing = await typecheckLines(plain);
    expect([...failing].toSorted((a, b) => a - b)).toEqual(pairs.map((_, index) => index));
    expect([
      ...(await typecheck(
        pairs.map(([tag, name]) => [tag, name, "x"]),
        false,
      )),
    ]).toEqual([]);
  });

  it("write the static values of attributes Qwik types as numbers or booleans as Qwik takes them", async () => {
    // Qwik types these values as numbers or booleans, so their static strings fail L4: the
    // target writes `{0}` and `{false}`, which Qwik serialises back to the same strings.
    const pairs: [string, string, string][] = [
      ["div", "tabindex", "0"],
      ["td", "colspan", "2"],
      ["input", "maxlength", "3"],
      ["textarea", "rows", "4"],
      ["div", "spellcheck", "false"],
      ["div", "draggable", "true"],
      ["div", "aria-level", "2"],
    ];
    expect([...(await typecheck(pairs, false))]).toEqual([]);
    const strings = pairs.map(
      ([tag, attribute, value]) => `<${tag} ${qwikAttributeName(attribute, "html")}="${value}" />`,
    );
    const failing = await typecheckLines(strings);
    expect([...failing].toSorted((x, y) => x - y)).toEqual(pairs.map((_, index) => index));
  });

  it("take a number, and only a number, on every number-typed attribute", async () => {
    // NUMBER_TYPED_ATTRIBUTES is what React or Qwik types as a number (ADR-0037): on Qwik, a
    // number type-checks on every entry and a string on none, so every entry is Qwik's too.
    const entries = [
      ...[...NUMBER_TYPED_GLOBAL_ATTRIBUTES].map((name) => ["div", name] as const),
      ...[...NUMBER_TYPED_GLOBAL_ATTRIBUTES]
        .filter((name) => name === "tabindex")
        .map((name) => ["svg", name] as const),
      ...[...NUMBER_TYPED_ATTRIBUTES].flatMap(([tag, names]) =>
        [...names].map((name) => [tag, name] as const),
      ),
    ];
    expect(entries.length).toBeGreaterThan(35);
    const declarations = "declare const n: number;\ndeclare const s: string;";
    const numbers = await typecheckLines(
      entries.map((entry) => numberLine(entry, "n")),
      declarations,
    );
    expect([...numbers]).toEqual([]);
    const strings = await typecheckLines(
      entries.map((entry) => numberLine(entry, "s")),
      declarations,
    );
    expect([...strings].toSorted((x, y) => x - y)).toEqual(entries.map((_, index) => index));
  });

  it("accept a boolean attribute with any string value, which the target writes bare", async () => {
    const booleans = new Set([...BOOLEAN_ATTRIBUTES, ...QWIK_BOOLEAN_ATTRIBUTES]);
    const all = authoringPairs();
    const gaps = gapsOf(all);
    const pairs = all
      .filter(([tag, attribute]) => booleans.has(attribute) && !gaps[attribute]?.includes(tag))
      .flatMap(([tag, attribute]): [string, string, string][] =>
        ["", "false", attribute].map((value) => [tag, attribute, value]),
      );
    expect(new Set(pairs.map(([, attribute]) => attribute)).size).toBeGreaterThan(20);
    const failing = await typecheck(pairs, false);
    expect([...failing].map((index) => pairs[index])).toEqual([]);
  });

  it("accept every bound value of its authoring type that the analyser accepts", async () => {
    // Every attribute the authoring types declare, bound to a value of exactly its authoring
    // type as far as the analyser's value kinds allow (ADR-0037: numbers on number-typed
    // attributes, booleans on boolean ones, the tokens every target lists on enumerated ones),
    // written as the target writes it.
    const aliases = [...vendored.matchAll(/^(?:export )?type \w+(?:<[^=]*>)? = [^\n]*;$/gm)]
      .map(([alias]) => alias.replace(/^export /, ""))
      .filter((alias) => !/VNodeRef|StyleValue|ClassValue|CSS/.test(alias));
    // Global attributes once, on a `<div>`.
    const all = authoringPairs();
    const globals = new Set(all.filter(([tag]) => tag === "div").map(([, name]) => name));
    const pairs = all.filter(
      ([tag, name]) => (tag === "div" || !globals.has(name)) && !rejects(tag, name),
    );
    expect(pairs.length).toBeGreaterThan(150);
    const declarations = pairs.map(([tag, name, type], index) => {
      const enumerated = enumeratedValues(tag, "html", name);
      const kinds = enumerated
        ? [
            ...enumerated.tokens.map((token) => JSON.stringify(token)),
            ...(enumerated.boolean ? ["boolean"] : []),
          ].join(" | ") || "never"
        : BOOLEAN_ATTRIBUTES.has(name)
          ? "boolean"
          : NUMBER_TYPED_GLOBAL_ATTRIBUTES.has(name) || NUMBER_TYPED_ATTRIBUTES.get(tag)?.has(name)
            ? "number"
            : /^(?:aria-.*|contenteditable|draggable|spellcheck)$/.test(name)
              ? "string | number | boolean"
              : "string | number";
      return `declare const v${index}: Extract<${type.replace(/ \| undefined$/, "")}, ${kinds}>;`;
    });
    const lines = pairs.map(([tag, name], index) =>
      isUntypedAttribute(tag, "html", name)
        ? `<${tag} {...{ ${JSON.stringify(name)}: v${index} }} />`
        : `<${tag} ${qwikAttributeName(name, "html")}={v${index}} />`,
    );
    const failing = await typecheckLines(lines, [...aliases, ...declarations].join("\n"));
    expect(pairs.filter((_, index) => failing.has(index))).toEqual([]);
  });
});

/** An element binding a number-typed attribute to `value`, as the target names it. */
function numberLine([tag, name]: readonly [string, string], value: string): string {
  return `<${tag} ${qwikAttributeName(name, tag === "svg" ? "svg" : "html")}={${value}} />`;
}
