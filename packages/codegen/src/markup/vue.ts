// Vue templates (design §5.2): `{{ }}` interpolations, `:attr` bindings, `v-if` and `v-for` on the
// element they control (or on a `<template>` around content that is not one element), and
// attributes in `vue/attributes-order`. Vue is the reference target (ADR-0014): whatever it
// renders becomes every target's expectation.
import {
  camelCaseProperty,
  escapeHtmlAttribute,
  escapeHtmlText,
  escapeReferences,
  mapCode,
  quotedAttribute,
  separateClosingBraces,
  stringLiteral,
} from "./escape.ts";
import {
  classArrayItems,
  isRoot,
  keepsWhitespace,
  staticClassValue,
  staticStyleValue,
  toggleObject,
  withoutEmptyBranches,
} from "./printer.ts";
import type {
  ClassPart,
  MarkupDialect,
  MarkupPiece,
  PrintedAttribute,
  StylePart,
  TextPosition,
} from "./printer.ts";

/** Whitespace Vue's `condense` mode rewrites: tabs, breaks and runs (Vue's `isWhitespace` set). */
const VUE_CONDENSED = /[\t\n\f\r]|[\t\n\f\r ]{2}/;
const VUE_WHITESPACE_ONLY = /^[\t\n\f\r ]+$/;

/** A string literal in single quotes, escaped as the value of a double-quoted attribute binding. */
function boundLiteral(value: string): string {
  const body = stringLiteral(value).slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'");
  return escapeHtmlAttribute(`'${body}'`);
}

/**
 * Code for `{{ }}`: Vue ends an interpolation at the first `}}`, even inside a string, and
 * decodes character references in it before parsing the expression.
 */
export function vueInterpolationCode(code: string): string {
  return escapeReferences(separateClosingBraces(code));
}

/**
 * Code for a double-quoted attribute value (`:title="…"`, `v-if="…"`): string literals in
 * double quotes are written in single quotes, as Vue templates do, and what is left of `"` and
 * of character references is escaped, since Vue decodes them before parsing.
 */
export function vueAttributeCode(code: string): string {
  const requoted = code.includes('"')
    ? mapCode(code, { string: (raw) => (raw.startsWith('"') ? singleQuoted(raw) : raw) })
    : code;
  return escapeReferences(requoted).replace(/"/g, "&quot;");
}

/** A double-quoted string literal's raw text, in single quotes with the same escapes. */
function singleQuoted(raw: string): string {
  let body = "";
  for (let index = 1; index < raw.length - 1; index++) {
    const character = raw[index]!;
    if (character === "\\") {
      const next = raw[index + 1]!;
      body += next === '"' ? '"' : `\\${next}`;
      index++;
    } else body += character === "'" ? "\\'" : character;
  }
  return `'${body}'`;
}

/**
 * The class parts that are not static as one JavaScript value Vue's `:class` takes: a dynamic
 * part alone, an object of toggles alone, or an array of both in source order, consecutive
 * toggles in one object.
 */
export function vueClassValue(parts: readonly ClassPart[]): string {
  const bound = parts.filter((part) => part.kind !== "Static");
  const [only, ...more] = bound;
  if (only?.kind === "Dynamic" && more.length === 0) return only.value;
  if (bound.every((part) => part.kind === "Toggle")) return toggleObject(bound);
  return `[${classArrayItems(bound, false).join(", ")}]`;
}

/** The bound declarations as an object Vue's `:style` takes: camel-case or custom keys. */
function styleObject(parts: readonly StylePart[]): string {
  return `{ ${parts
    .flatMap((part) =>
      part.kind === "Bound"
        ? [
            `${part.property.startsWith("--") ? JSON.stringify(part.property) : camelCaseProperty(part.property)}: ${part.value}`,
          ]
        : [],
    )
    .join(", ")} }`;
}

/**
 * The order `vue/attributes-order` (in `plugin:vue/recommended`) wants: `v-for`, then the
 * conditionals, then `id`, then `key`, then everything else, which it leaves in any order.
 */
function vueRank({ name }: PrintedAttribute): number {
  if (name === "v-for") return 0;
  if (name === "v-if" || name === "v-else-if" || name === "v-else") return 1;
  if (name === "id") return 2;
  if (name === "key") return 3;
  return 4;
}

/**
 * Vue templates: `{{` opens an interpolation, and the `condense` whitespace mode turns any tab,
 * line break or run of whitespace in text into one space, drops whitespace-only text that is
 * the first or last child of an element, a `<template>` or the root, and turns `\r\n` into `\n`
 * even in `<pre>`. Such text is printed as an interpolated string literal, which Vue renders as
 * it is. Text at the root's edges is one too, whatever it holds: the target puts the markup on
 * lines of its own in `<template>`, and that line break would join the text. Vue's server
 * compiler writes static attributes into a template literal, which turns a carriage return into
 * a line feed, so a value holding one is bound to a string literal instead.
 *
 * A conditional puts `v-if`, `v-else-if` and `v-else` on its branch's element, or on a
 * `<template>` around a branch that is not one element; an empty branch is folded into the
 * conditions after it. A list puts `v-for` and `:key` on its body, never beside a `v-if`.
 *
 * `condense` is @vitejs/plugin-vue's default, and an SFC cannot pin its own: with a consumer's
 * `whitespace: "preserve"`, the layout's line breaks would become text between the elements.
 * Deferred to M6 (plan §8.2): the unplugin reads the Vue plugin's resolved option and reports
 * any other value.
 */
export const vueDialect: MarkupDialect = {
  name: "vue",
  escapeText: (text, position) => {
    const condensed = keepsWhitespace(position)
      ? text.includes("\r")
      : VUE_CONDENSED.test(text) ||
        ((position.first || position.last) && VUE_WHITESPACE_ONLY.test(text)) ||
        atRootEdge(position);
    if (condensed) return `{{ ${stringLiteral(text)} }}`;
    const escaped = escapeHtmlText(text).replace(/\{\{/g, "{&#123;");
    // A `{` right before an interpolation would open it early (`{{{ x }}`).
    return position.next === "Interpolation" && escaped.endsWith("{")
      ? `${escaped.slice(0, -1)}&#123;`
      : escaped;
  },
  attribute: (name, value) =>
    value.includes("\r") ? `:${name}="${boundLiteral(value)}"` : quotedAttribute(name, value),
  voidElement: "self-closing",
  stripsWhitespaceBetweenElements: true,
  stripsEdgeWhitespace: true,
  interpolation: (code) => `{{ ${vueInterpolationCode(code)} }}`,
  boundAttribute: (name, code) => `:${name}="${vueAttributeCode(code)}"`,
  classAttribute: (parts) => {
    const value = staticClassValue(parts);
    const printed: PrintedAttribute[] = value
      ? [{ name: "class", text: vueDialect.attribute("class", value, "") }]
      : [];
    if (parts.some((part) => part.kind !== "Static")) {
      printed.push({ name: "class", text: `:class="${vueAttributeCode(vueClassValue(parts))}"` });
    }
    return printed;
  },
  styleAttribute: (parts) => {
    const value = staticStyleValue(parts);
    const printed: PrintedAttribute[] = value
      ? [{ name: "style", text: vueDialect.attribute("style", value, "") }]
      : [];
    if (parts.some((part) => part.kind === "Bound")) {
      printed.push({ name: "style", text: `:style="${vueAttributeCode(styleObject(parts))}"` });
    }
    return printed;
  },
  conditional: (branches) =>
    withoutEmptyBranches(branches).map(({ condition, branch }, index): MarkupPiece => {
      const name = index === 0 ? "v-if" : condition === undefined ? "v-else" : "v-else-if";
      const directive: PrintedAttribute = {
        name,
        text: condition === undefined ? name : `${name}="${vueAttributeCode(condition)}"`,
      };
      const [only, ...more] = branch.children;
      return only?.kind === "Element" && more.length === 0
        ? { kind: "element", element: only, directives: [directive] }
        : {
            kind: "wrapper",
            tag: "template",
            attributes: [directive],
            content: { kind: "nodes", nodes: branch.children, container: branch },
          };
    }),
  list: ({ node, source, item, index, key }) => [
    {
      kind: "element",
      element: node.body,
      directives: [
        {
          name: "v-for",
          text: `v-for="${index === undefined ? item : `(${item}, ${index})`} in ${vueAttributeCode(source)}"`,
        },
        { name: "key", text: `:key="${vueAttributeCode(key)}"` },
      ],
    },
  ],
  orderAttributes: (attributes) =>
    attributes
      .map((attribute, index) => ({ attribute, index }))
      .toSorted((a, b) => vueRank(a.attribute) - vueRank(b.attribute) || a.index - b.index)
      .map(({ attribute }) => attribute),
};

/** Whether text sits at an edge of the root, where the target's own line breaks meet it. */
function atRootEdge(position: TextPosition): boolean {
  return isRoot(position.container) && (position.first || position.last);
}
