// M1's tables and rules against the tools whose behaviour they stand for (design §1.2, §1.5,
// §1.7): the HTML parser's SVG adjustments (parse5), Vue's and Svelte's boolean attributes,
// Angular's security schema and template parser, ARIA's value types (aria-query, through
// Svelte, which warns with them) and the vendored authoring types.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { DomElementSchemaRegistry, parseTemplate } from "@angular/compiler";
import {
  ARIA_ATTRIBUTES,
  BINDABLE_BOOLEAN_ATTRIBUTES,
  BOOLEAN_ATTRIBUTES,
  ELEMENT_ATTRIBUTES,
  GLOBAL_ATTRIBUTES,
  isHtmlAttribute,
  SVG_ELEMENT_ATTRIBUTES,
  SVG_ELEMENTS,
  SVG_GLOBAL_ATTRIBUTES,
  UNBINDABLE_ATTRIBUTES,
  unbindableAttribute,
  UNRENDERABLE_ELEMENTS,
  VOID_ELEMENTS,
} from "@unframework/ir";
import { defaultTreeAdapter, html as spec, parseFragment } from "parse5";
import type { DefaultTreeAdapterTypes } from "parse5";
import { compile as compileSvelte } from "svelte/compiler";
import { describe, expect, it } from "vitest";

import { ABSTRACT_ROLES, ARIA_ROLES, ARIA_TYPES, ariaValueProblem } from "../src/aria.ts";
import { STRING_ATTRIBUTES, STRING_GLOBAL_ATTRIBUTES } from "../src/attribute-names.ts";
import { staticTokens } from "../src/enumerated.ts";
import { codes, component } from "./helpers.ts";
import { random } from "./random.ts";

const require = createRequire(import.meta.url);
const vueRequire = createRequire(require.resolve("vue/package.json"));
const { isBooleanAttr, isSVGTag } = vueRequire("@vue/shared") as {
  isBooleanAttr: (name: string) => boolean;
  isSVGTag: (tag: string) => boolean;
};
const svelteRoot = require.resolve("svelte/package.json").replace(/package\.json$/, "");
const svelteRequire = createRequire(`${svelteRoot}package.json`);

/** The vendored authoring types: the JSX types of `@vue/runtime-dom`. */
const VENDORED = readFileSync(
  new URL("../../unframework/src/vendor/vue-jsx.d.ts", import.meta.url),
  "utf8",
);

/** The members of an interface of the vendored types, with their types as written. */
function interfaceMembers(name: string): Map<string, string> {
  const body = new RegExp(`export interface ${name}(?: extends [^{]+)? \\{([\\s\\S]*?)\\n\\}`).exec(
    VENDORED,
  )?.[1];
  const members = new Map<string, string>();
  for (const match of (body ?? "").matchAll(/^\s{4}'?([\w:-]+)'?\??: ([^;]+);/gm)) {
    members.set(match[1]!, match[2]!);
  }
  return members;
}

/** The tags the vendored types map to SVG's attributes. */
const VENDORED_SVG_TAGS = new Set(
  [
    ...(
      /export interface IntrinsicElementAttributes \{([\s\S]*?)\n\}/.exec(VENDORED)?.[1] ?? ""
    ).matchAll(/^\s{4}(\w+): SVGAttributes;/gm),
  ].map((match) => match[1]!),
);

/** The first element of a fragment parsed in an `<svg>`, as the HTML parser builds it. */
function parsedInSvg(markup: string): DefaultTreeAdapterTypes.Element {
  const body = defaultTreeAdapter.createElement("body", spec.NS.HTML, []);
  const fragment = parseFragment(body, `<svg>${markup}</svg>`, {});
  const svg = fragment.childNodes[0] as DefaultTreeAdapterTypes.Element;
  return svg.childNodes[0] as DefaultTreeAdapterTypes.Element;
}

describe("the SVG vocabulary", () => {
  it("is the vendored types' SVG elements (with <title>) that Vue knows", () => {
    for (const tag of SVG_ELEMENTS) {
      expect(VENDORED_SVG_TAGS.has(tag) || tag === "title", tag).toBe(true);
      expect(isSVGTag(tag), tag).toBe(true);
      expect(tag).toMatch(/^[A-Za-z][A-Za-z0-9]*$/);
    }
  });

  // The server's HTML reaches the browser through the HTML parser, which lower-cases names
  // and restores SVG's case only from its own tables: a client creates the name as written.
  it("keeps each element's case through the HTML parser", () => {
    for (const tag of SVG_ELEMENTS) {
      const element = parsedInSvg(`<${tag.toLowerCase()}></${tag.toLowerCase()}>`);
      expect(element.tagName, tag).toBe(tag);
      expect(element.namespaceURI).toBe(spec.NS.SVG);
    }
  });

  it("keeps each attribute's case through the HTML parser, and the vendored types declare it", () => {
    const declared = interfaceMembers("SVGAttributes");
    const known = new Set(declared.keys());
    for (const [tag, names] of [
      ...[...SVG_ELEMENTS].map((tag) => [tag, SVG_GLOBAL_ATTRIBUTES] as const),
      ...SVG_ELEMENT_ATTRIBUTES,
    ]) {
      for (const name of names) {
        const element = parsedInSvg(`<${tag} ${name.toLowerCase()}="x"></${tag}>`);
        expect(
          element.attrs.map((attribute) => attribute.name),
          `${tag} ${name}`,
        ).toEqual([name]);
        expect(known.has(name), `${name} is declared`).toBe(true);
      }
    }
  });

  it("is accepted by the analyser, each element in an <svg>", () => {
    for (const tag of SVG_ELEMENTS) {
      if (tag === "svg") continue;
      // `<title>` and `<desc>` hold text only; the others take text too, as their content.
      const { diagnostics } = component(`<svg><${tag} /></svg>`);
      expect(diagnostics, tag).toEqual([]);
    }
    for (const [tag, names] of SVG_ELEMENT_ATTRIBUTES) {
      for (const name of names) {
        // An enumerated attribute takes one of its keywords.
        const value = staticTokens(tag, "svg", name)?.[0] ?? "1";
        const jsx =
          tag === "svg" ? `<svg ${name}="${value}" />` : `<svg><${tag} ${name}="${value}" /></svg>`;
        expect(codes(component(jsx).diagnostics), jsx).toEqual([]);
      }
    }
  });
});

describe("boolean attributes", () => {
  /** Svelte's own list: the attributes it renders as present or absent. */
  const svelteBooleans = new Set(
    [
      ...(
        /const DOM_BOOLEAN_ATTRIBUTES = \[([\s\S]*?)\];/.exec(
          readFileSync(`${svelteRoot}src/utils.js`, "utf8"),
        )?.[1] ?? ""
      ).matchAll(/'([a-z]+)'/g),
    ].map((match) => match[1]!),
  );

  it("can be bound exactly where Vue and Svelte both render false as no attribute", () => {
    expect(svelteBooleans.size).toBeGreaterThan(20);
    const both = [...BOOLEAN_ATTRIBUTES].filter(
      (name) => isBooleanAttr(name) && svelteBooleans.has(name),
    );
    expect([...BINDABLE_BOOLEAN_ATTRIBUTES].toSorted()).toEqual(both.toSorted());
  });

  it("are accepted bound where bindable, and reported where not", () => {
    for (const name of BOOLEAN_ATTRIBUTES) {
      const owner =
        [...ELEMENT_ATTRIBUTES].find(
          ([tag, names]) => names.has(name) && !UNRENDERABLE_ELEMENTS.has(tag),
        )?.[0] ?? "div";
      // Some belong to elements a component cannot render (`<template>`'s `shadowroot*`).
      if (!isHtmlAttribute(owner, name)) continue;
      const markup = VOID_ELEMENTS.has(owner)
        ? `<${owner} ${name}={on} />`
        : `<${owner} ${name}={on}></${owner}>`;
      const { diagnostics } = component(
        owner === "option" ? `<select>${markup}</select>` : markup,
        {
          props: "on: boolean",
        },
      );
      if (BINDABLE_BOOLEAN_ATTRIBUTES.has(name)) {
        // Form state, `autofocus` and the like keep their own diagnostics.
        expect(
          diagnostics.every((diagnostic) => !diagnostic.message.includes("Binding")),
          name,
        ).toBe(true);
      } else {
        expect(codes(diagnostics), name).toContain("UF1002");
      }
    }
  });
});

describe("attributes Angular cannot bind", () => {
  // Angular throws for a bound resource URL it does not trust (NG0904), and refuses to bind the
  // iframe policy attributes (NG0910): `SecurityContext.RESOURCE_URL` and
  // `ATTRIBUTE_NO_BINDING`.
  const RESOURCE_URL = 5;
  const ATTRIBUTE_NO_BINDING = 6;
  const registry = new DomElementSchemaRegistry();

  it("are exactly the attributes of the vocabulary in those security contexts", () => {
    const sensitive: string[] = [];
    for (const [tag, own] of ELEMENT_ATTRIBUTES) {
      if (UNRENDERABLE_ELEMENTS.has(tag)) continue;
      for (const name of [...own, ...GLOBAL_ATTRIBUTES]) {
        if (!isHtmlAttribute(tag, name)) continue;
        const context = Math.max(
          registry.securityContext(tag, name, true),
          registry.securityContext(tag, name, false),
        );
        if (context === RESOURCE_URL || context === ATTRIBUTE_NO_BINDING) {
          sensitive.push(`${tag} ${name}`);
        }
      }
    }
    // Besides Angular's: the attributes that decide a <select>'s first selection.
    const unbindable = [...UNBINDABLE_ATTRIBUTES]
      .flatMap(([tag, names]) => [...names].map(([name, reason]) => ({ tag, name, reason })))
      .filter(({ reason }) => !reason.includes("decides which option starts selected"))
      .map(({ tag, name }) => `${tag} ${name}`);
    expect(unbindable.toSorted()).toEqual(sensitive.toSorted());
    for (const entry of sensitive) {
      const [tag, name] = entry.split(" ") as [string, string];
      expect(unbindableAttribute(tag, name)).toBeDefined();
    }
  });
});

describe("ARIA", () => {
  const { aria, roles } = svelteRequire("aria-query") as {
    aria: Map<string, { type: string; values?: unknown[] }>;
    roles: Map<string, { abstract: boolean }>;
  };

  it("types every ARIA attribute the vocabulary knows, as aria-query does", () => {
    expect([...ARIA_TYPES.keys()].toSorted()).toEqual([...ARIA_ATTRIBUTES].toSorted());
    for (const [name, type] of ARIA_TYPES) {
      const own = aria.get(name)!;
      expect(type.type, name).toBe(own.type);
      if ("values" in type) {
        expect([...type.values].toSorted(), name).toEqual(own.values!.map(String).toSorted());
      }
    }
  });

  it("knows ARIA's roles, and its abstract ones", () => {
    const named = [...roles.entries()];
    expect([...ARIA_ROLES].toSorted()).toEqual(
      named
        .filter(([, role]) => !role.abstract)
        .map(([name]) => name)
        .toSorted(),
    );
    expect([...ABSTRACT_ROLES].toSorted()).toEqual(
      named
        .filter(([, role]) => role.abstract)
        .map(([name]) => name)
        .toSorted(),
    );
  });

  // Svelte's compiler warns with aria-query's tables (L3): the analyser rejects exactly the
  // values it warns about.
  it("rejects exactly the values Svelte warns about", () => {
    const values = [
      "",
      "true",
      "false",
      "mixed",
      "TRUE",
      "2",
      "-1",
      "1.5",
      "x",
      "polite",
      "page",
      "additions text",
      "nope ",
      "undefined",
    ];
    for (const name of ARIA_TYPES.keys()) {
      for (const value of values) {
        const { warnings } = compileSvelte(`<div ${name}="${value}"></div>`, {
          generate: "server",
        });
        const warned = warnings.some((warning) =>
          warning.code.startsWith("a11y_incorrect_aria_attribute_type"),
        );
        expect(ariaValueProblem(name, value) !== undefined, `${name}="${value}"`).toBe(warned);
      }
    }
  });
});

describe("string-only attributes", () => {
  /** Whether a vendored type is a string, or string literals, only. */
  function stringOnly(type: string): boolean {
    const aliases = new Map(
      [...VENDORED.matchAll(/^type (\w+) = ([^;]+);/gm)].map((match) => [match[1]!, match[2]!]),
    );
    let text = type.replace(/\s*\|\s*undefined/g, "").trim();
    for (let depth = 0; depth < 3; depth++) {
      text = text.replace(/\b([A-Z]\w+)\b/g, (name) =>
        aliases.has(name) ? `(${aliases.get(name)})` : name,
      );
    }
    if (/\[/.test(text)) return false;
    const parts = text
      .replace(/[()]/g, "")
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);
    return parts.length > 0 && parts.every((part) => part === "string" || /^'[^']*'$/.test(part));
  }

  /** Every interface's members, through `extends`. */
  function members(name: string, seen = new Set<string>()): Map<string, string> {
    const header = new RegExp(`export interface ${name}(?: extends ([^{]+))? \\{`).exec(VENDORED);
    if (!header || seen.has(name)) return new Map();
    seen.add(name);
    const result = new Map<string, string>();
    for (const parent of (header[1] ?? "")
      .split(",")
      .map((item) => item.trim().replace(/<.*$/, ""))) {
      for (const [key, value] of members(parent, seen)) result.set(key, value);
    }
    for (const [key, value] of interfaceMembers(name)) result.set(key, value);
    return result;
  }

  const ALIASES = new Map([
    ["acceptcharset", "accept-charset"],
    ["httpequiv", "http-equiv"],
  ]);

  it("are the attributes the vendored types declare as strings only", () => {
    const global = members("HTMLAttributes");
    const globalStrings = [...global]
      .filter(
        ([name, type]) => !name.startsWith("aria-") && name !== "innerHTML" && stringOnly(type),
      )
      .map(([name]) => name);
    expect([...STRING_GLOBAL_ATTRIBUTES].toSorted()).toEqual(globalStrings.toSorted());
    const tags = /export interface IntrinsicElementAttributes \{([\s\S]*?)\n\}/.exec(VENDORED)![1]!;
    for (const match of tags.matchAll(/^\s{4}(\w+): (\w+);/gm)) {
      const [, tag, type] = match as unknown as [string, string, string];
      if (type === "SVGAttributes" || type === "HTMLAttributes") continue;
      const own = [...members(type)]
        .filter(([name, value]) => !global.has(name) && stringOnly(value))
        .map(([name]) => ALIASES.get(name) ?? name);
      if (tag === "webview") continue;
      expect([...(STRING_ATTRIBUTES.get(tag) ?? [])].toSorted(), tag).toEqual(own.toSorted());
    }
  });
});

describe("expressions Angular reads", () => {
  /** Props the generated expressions read. */
  const PROPS =
    "label: string; count: number; on: boolean; items: string[]; user: { name: string }; maybe?: string";

  /** A random expression of the accepted subset (design §1.2), depth-limited. */
  function expression(next: () => number, depth: number, locals: readonly string[]): string {
    const pick = <T>(items: readonly T[]) => items[Math.floor(next() * items.length)]!;
    const leaf = () =>
      pick([
        () => pick(["label", "count", "on", "items.length", "user.name", ...locals]),
        () => pick(['"a b"', "'c'", '"\\n\\t"', '"\\x41"', '"\\u0041"', '""', "`t`"]),
        () => pick(["0", "1.5", "1e3", ".5", "1_000", "(-2)"]),
        () => pick(["true", "false", "null", "undefined", "NaN", "Infinity"]),
        // Not `maybe?.length`, which would narrow `maybe` as a test, where `?.` and `??` on it
        // do nothing (UF3023): TypeScript narrows no call.
        () => pick(['(maybe ?? "x")', "maybe?.trim().length", "maybe?.trim()", "items[0]"]),
      ])();
    if (depth <= 0) return leaf();
    const inner = () => expression(next, depth - 1, locals);
    return pick([
      leaf,
      () => `(${inner()})`,
      () => `\`a${"${"}${inner()}}b\``,
      // Parenthesised, as JavaScript requires of a unary operand of `**`, and `??` beside `||`.
      () => {
        const operand = inner();
        // A regex right after `typeof` is rejected (UF1002), with its fix.
        const operator = pick(["!", "-", "+", "typeof "]);
        return operator === "typeof " && operand.startsWith("/")
          ? `(${operator}(${operand}))`
          : `(${operator}${operand})`;
      },
      () =>
        `(${inner()} ${pick(["+", "-", "*", "/", "%", "**", "===", "!==", "==", "!=", "<", "<=", ">", ">=", "&&", "||"])} ${inner()})`,
      () => `(${inner()} ? ${inner()} : ${inner()})`,
      () => `String(${inner()})`,
      () => `Math.max(${inner()}, ${inner()})`,
      () => `label.slice(${inner()})`,
      () => `items.join(${inner()})`,
      () => `items.filter((x) => ${expression(next, depth - 1, [...locals, "x"])} || x).length`,
      () => `items.map((x, i) => ${expression(next, depth - 1, [...locals, "x"])} + i).join()`,
      () => `[${inner()}, ...items].length`,
      () => `JSON.stringify({ a: ${inner()}, "b-c": ${inner()}, label })`,
      () => `/a+/.test(label)`,
    ])();
  }

  it("parses every accepted expression the generator writes", () => {
    const next = random(7);
    const failures: string[] = [];
    for (let sample = 0; sample < 1500; sample++) {
      const code = `String(${expression(next, 3, [])})`;
      const { diagnostics } = component(`<p>{${code}}</p>`, { props: PROPS });
      expect(diagnostics, code).toEqual([]);
      const { errors } = parseTemplate(`<p>{{ ${code} }}</p>`, "test.html", {});
      if (errors?.length) failures.push(`${code}: ${errors.map((error) => error.msg).join("; ")}`);
    }
    expect(failures).toEqual([]);
  }, 60_000);

  it.each([
    "items.map((x) => { return x; }).join()",
    "items.map(({ length }) => length).join()",
    "0x1F",
    '"\\u{1F600}"',
    "[1, , 2].length",
    'JSON.stringify({ ["k"]: 1 })',
    "count | 1",
    "new Array(1).length",
    "typeof /a/.test(label)",
  ])("rejects %s, which Angular cannot parse", (code) => {
    const { diagnostics } = component(`<p>{String(${code})}</p>`, { props: PROPS });
    expect(codes(diagnostics)).toContain("UF1002");
    const { errors } = parseTemplate(`<p>{{ String(${code}) }}</p>`, "test.html", {});
    // `|` is Angular's pipe: it parses, as a pipe named `1`, which is no number.
    if (!code.includes("|")) expect(errors?.length, code).toBeGreaterThan(0);
  });
});
