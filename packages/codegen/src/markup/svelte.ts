// Svelte markup in runes mode (design §5.3): `{expr}`, `attr={expr}`, `{#if}` and keyed `{#each}`
// blocks, one `class={[…]}` (clsx) and `style:` directives. Svelte parses balanced JavaScript in
// `{…}`, braces in strings and comments included, so expression code is printed as written.
import {
  escapeBraces,
  escapeHtmlAttribute,
  escapeHtmlText,
  isIdentifierName,
  stringLiteral,
} from "./escape.ts";
import {
  classArrayItems,
  keepsWhitespace,
  staticClassValue,
  staticStyleValue,
  withoutEmptyBranches,
} from "./printer.ts";
import type { MarkupDialect } from "./printer.ts";

/** HTML's own whitespace, which Svelte trims at the edges of an element's or a block's content. */
const HTML_WHITESPACE = /[\t\n\f\r ]/;
/** Tabs, line breaks and runs of whitespace, which Svelte may rewrite beside a tag or a block. */
const CONDENSED = /[\t\n\f\r]|[\t\n\f\r ]{2}/;

/** A static attribute value in Svelte markup, where `{` opens an expression. */
const attributeValue = (value: string) => escapeBraces(escapeHtmlAttribute(value));

/**
 * Whether a binding can take Svelte's shorthand, which reads the variable named like the
 * attribute or the style property (`{href}`, `style:color`): the code is that name alone.
 */
const shorthand = (name: string, code: string) => code === name && isIdentifierName(name);

/**
 * Svelte markup: `{` opens an expression or a block, in text and in attribute values. Svelte
 * removes the whitespace at the start and end of every fragment's content (an element's, a
 * block's, the root's) and turns whitespace between text and an element or a block into one
 * space, but keeps it as written between text and `{expr}`; so text that holds line breaks,
 * tabs or runs of spaces, or whitespace at an edge, is printed as an expression. Whitespace
 * between two elements or blocks becomes a space, so the printer never leaves any there. That
 * is `preserveWhitespace: false`, Svelte's default, which the Svelte target pins in every
 * component (`<svelte:options>`).
 *
 * Svelte's server renderer escapes the static attributes of an `<option>` twice (5.57: the
 * compiler escapes them into the `$$renderer.option()` call, which escapes them again), so
 * `title="a<b"` renders `a&amp;lt;b`. An option's value holding `&`, `<` or `"` is an
 * expression, which is escaped once.
 *
 * A binding whose value is the variable named like the attribute takes Svelte's shorthand
 * (`{href}`, `style:color`), as Svelte code is written.
 *
 * A class is one `class={[…]}`, never `class:` directives, which remove a token a dynamic part
 * produces (ADR-0038). A style is a static `style="…"` when every declaration is static, and
 * otherwise one `style:` directive per declaration in source order: Svelte renders `style={{…}}`
 * as `[object Object]`.
 *
 * SVG elements get their namespace from the `<svg>` around them in the component, which every
 * IR tree has: a component rooted in an SVG child, which would need
 * `<svelte:options namespace="svg">`, is UF1002 until M3 (ADR-0040). Svelte drops whitespace
 * between SVG elements, and the IR holds none there.
 */
export const svelteDialect: MarkupDialect = {
  name: "svelte",
  escapeText: (text, position) => {
    if (keepsWhitespace(position)) return escapeBraces(escapeHtmlText(text));
    const atEdge =
      (position.first && HTML_WHITESPACE.test(text.charAt(0))) ||
      (position.last && HTML_WHITESPACE.test(text.charAt(text.length - 1)));
    return atEdge || CONDENSED.test(text)
      ? `{${stringLiteral(text)}}`
      : escapeBraces(escapeHtmlText(text));
  },
  attribute: (name, value, tag) =>
    tag === "option" && /[&<"]/.test(value)
      ? `${name}={${stringLiteral(value)}}`
      : `${name}="${attributeValue(value)}"`,
  voidElement: "self-closing",
  stripsWhitespaceBetweenElements: false,
  stripsEdgeWhitespace: true,
  // `{/` closes a block, so code that starts with a regular expression is parenthesised.
  interpolation: (code) => (code.startsWith("/") ? `{(${code})}` : `{${code}}`),
  boundAttribute: (name, code) => (shorthand(name, code) ? `{${name}}` : `${name}={${code}}`),
  classAttribute: (parts, { element }) => {
    if (parts.every((part) => part.kind === "Static")) {
      return [
        {
          name: "class",
          text: svelteDialect.attribute("class", staticClassValue(parts), element.tag),
        },
      ];
    }
    // One item stands alone: a dynamic value (`class={tone}`) or the toggles' object
    // (`class={{ active, muted }}`), which Svelte passes through clsx as it does an array.
    const items = classArrayItems(parts, true);
    const value = items.length === 1 ? items[0]! : `[${items.join(", ")}]`;
    return [{ name: "class", text: `class={${value}}` }];
  },
  styleAttribute: (parts, { element }) => {
    if (parts.every((part) => part.kind === "Static")) {
      return [
        {
          name: "style",
          text: svelteDialect.attribute("style", staticStyleValue(parts), element.tag),
        },
      ];
    }
    return parts.map((part) => ({
      name: "style",
      text:
        part.kind === "Static"
          ? `style:${part.property}="${attributeValue(part.value)}"`
          : shorthand(part.property, part.value)
            ? `style:${part.property}`
            : `style:${part.property}={${part.value}}`,
    }));
  },
  conditional: (branches) => {
    const kept = withoutEmptyBranches(branches);
    return [
      {
        kind: "block",
        segments: kept.map(({ condition, branch }, index) => ({
          open:
            index === 0
              ? `{#if ${condition!}}`
              : condition === undefined
                ? "{:else}"
                : `{:else if ${condition}}`,
          content: { kind: "nodes", nodes: branch.children, container: branch },
        })),
        close: "{/if}",
      },
    ];
  },
  list: ({ node, source, item, index, key }) => [
    {
      kind: "block",
      segments: [
        {
          open: `{#each ${source} as ${item}${index === undefined ? "" : `, ${index}`} (${key})}`,
          content: { kind: "nodes", nodes: [node.body], container: node },
        },
      ],
      close: "{/each}",
    },
  ],
};
