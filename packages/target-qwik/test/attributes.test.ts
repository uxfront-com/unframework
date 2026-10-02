// The Qwik target's attribute tables, checked against Qwik's own JSX types (L4) for every HTML
// attribute the authoring types accept: a spelling Qwik needs (`tabindex` → `tabIndex`) must be
// in QWIK_ATTRIBUTE_NAMES, and a boolean attribute must be written so Qwik's `boolean` accepts
// it, whatever its value. The authoring types are Vue's vendored JSX types (ADR-0006).
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
} from "@unframework/ir";
import { afterAll, describe, expect, it } from "vitest";

import { QWIK_BOOLEAN_ATTRIBUTES } from "../src/attributes.ts";
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
 * Attributes outside this check: `class` and `style` (their forms are M1's), `aria-*` and
 * `data-*` (Qwik accepts any), event handlers (M2), `is` and `innerHTML`.
 */
const OUT_OF_SCOPE = /^(?:class|style|aria-.*|data-.*|on.*|is|innerhtml)$/;
/** Elements Qwik's types accept any attribute on: obsolete (`keygen`, `param`) or not HTML. */
const UNTYPED_ELEMENTS = new Set(["keygen", "noindex", "param", "webview"]);

/** Every (element, attribute) pair the authoring types declare on an HTML element. */
function authoringPairs(): [tag: string, attribute: string][] {
  const types = readFileSync(join(repo, "packages/unframework/src/vendor/vue-jsx.d.ts"), "utf8");
  const interfaces = new Map<string, { parents: string[]; names: string[] }>();
  for (const match of types.matchAll(
    /export interface (\w+)(?: extends ([\w<>, ]+))? \{([\s\S]*?)\n\}/g,
  )) {
    interfaces.set(match[1]!, {
      parents: (match[2] ?? "").split(",").map((parent) => parent.trim().replace(/<.*$/, "")),
      names: [...match[3]!.matchAll(/^ {4}'?([a-z][a-z0-9-]*)'?\??:/gm)].map((name) => name[1]!),
    });
  }
  const namesOf = (name: string): string[] => {
    const entry = interfaces.get(name);
    return entry ? [...entry.parents.flatMap(namesOf), ...entry.names] : [];
  };
  const elements = types.match(/export interface IntrinsicElementAttributes \{([\s\S]*?)\n\}/)![1]!;
  return [...elements.matchAll(/^ {4}(\w+): (\w+HTMLAttributes);/gm)]
    .filter(([, tag]) => !UNTYPED_ELEMENTS.has(tag!))
    .flatMap(([, tag, type]) =>
      [...new Set(namesOf(type!))]
        .filter((name) => !OUT_OF_SCOPE.test(name))
        .map((name): [string, string] => [tag!, name]),
    );
}

/** Some elements by name, or every element that has the attribute but some. */
type Elements = { readonly on: readonly string[] } | { readonly except: readonly string[] };

/**
 * Attributes the authoring types accept that Qwik 2.0.0-beta.47's JSX types do not declare on
 * some elements: no spelling can make their Qwik output type-check. Pinned so the list only
 * shrinks (an entry that starts passing fails the test). M1, which owns attribute names per
 * target, decides how the Qwik target writes them (a typed spread, or a diagnostic).
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
  enterkeyhint: { except: ["input", "textarea"] },
  exportparts: { except: [] },
  form: { on: ["input"] },
  hreflang: { on: ["area"] },
  httpequiv: { on: ["meta"] },
  list: { on: ["input"] },
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

/** The pinned gaps as (element, attribute) pairs of the authoring types. */
function gapsOf(pairs: readonly [string, string][]): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(QWIK_NAME_GAPS).map(([attribute, tags]) => [
      attribute,
      pairs
        .filter(([, name]) => name === attribute)
        .map(([tag]) => tag)
        .filter((tag) => ("on" in tags ? tags.on.includes(tag) : !tags.except.includes(tag))),
    ]),
  );
}

/** Emits the elements through the Qwik target and type-checks them, one element per line. */
async function typecheck(
  name: string,
  pairs: readonly [string, string, string][],
  blankStrings: boolean,
): Promise<Set<number>> {
  const at = { start: 0, end: 0 };
  const children = pairs.map(([tag, attribute, value]) =>
    createElement(tag, [createStaticAttribute(attribute, value, at)], [], at),
  );
  const render = createElement("div", [], children, at);
  const module = createModule(
    `${name}.uf.tsx`,
    [createComponent(name, render, at)],
    [createExport("default", name, at)],
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
  const path = join(scratch, `${name}.tsx`);
  writeFileSync(path, formatted);
  const lines = formatted.split("\n");
  const first = lines.findIndex((line) => line.trim().startsWith("<div>")) + 2;
  const results = await toolchain.typecheck([path], context);
  // Each element sits on its own line, in order, after the `<div>` line.
  return new Set(results.get(path)!.map((message) => message.line! - first));
}

describe("Qwik's attribute types", { timeout: 120_000 }, () => {
  it("accept every HTML attribute the target writes, but the pinned gaps", async () => {
    const pairs = authoringPairs();
    expect(pairs.length).toBeGreaterThan(1000);
    const failing = await typecheck(
      "Names",
      pairs.map(([tag, attribute]) => [tag, attribute, "x"]),
      true,
    );
    const gaps = new Map<string, string[]>();
    pairs.forEach(([tag, attribute], index) => {
      if (failing.has(index)) gaps.set(attribute, [...(gaps.get(attribute) ?? []), tag]);
    });
    expect(Object.fromEntries(gaps)).toEqual(gapsOf(pairs));
  });

  // Pinned for M1 (see QWIK_ATTRIBUTE_NAMES): Qwik types these values as numbers or booleans,
  // so their static strings fail L4 although Qwik would render them as written. When the target
  // writes them as `{0}` and `{false}`, this fails: turn it into a passing check.
  it("still reject the static strings of attributes Qwik types as numbers or booleans", async () => {
    const pairs: [string, string, string][] = [
      ["div", "tabindex", "0"],
      ["td", "colspan", "2"],
      ["input", "maxlength", "3"],
      ["textarea", "rows", "4"],
      ["div", "spellcheck", "false"],
      ["div", "draggable", "true"],
    ];
    const failing = await typecheck("Values", pairs, false);
    expect([...failing].toSorted((a, b) => a - b)).toEqual(pairs.map((_, index) => index));
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
    const failing = await typecheck("Booleans", pairs, false);
    expect([...failing].map((index) => pairs[index])).toEqual([]);
  });
});
