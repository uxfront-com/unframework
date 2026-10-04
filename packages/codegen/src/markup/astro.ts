// Astro markup (design §5.7): JSX-like expressions in `{…}`, ternary chains ending in `null` for
// conditionals (never `&&`, which renders a falsy left side), `.map` without `key` (Astro would
// render it as an attribute), `class:list` and style objects. Astro's compiler reads balanced
// JavaScript in `{…}`, braces in strings, templates and regular expressions included, so
// expression code is printed as written.
import { BINDABLE_BOOLEAN_ATTRIBUTES } from "@unframework/ir";
import type { ForNode } from "@unframework/ir";

import { referencedBindings } from "../rewrite.ts";
import {
  camelCaseProperty,
  escapeBraces,
  escapeHtmlText,
  quotedAttribute,
  stringLiteral,
} from "./escape.ts";
import {
  classArrayItems,
  isRoot,
  keepsWhitespace,
  operand,
  staticClassValue,
  staticStyleValue,
  test,
} from "./printer.ts";
import type { BlockSegment, ConditionalBranch, MarkupDialect, MarkupPiece } from "./printer.ts";

/** Line breaks and tabs, which JSX-style whitespace rules (Astro's `compressHTML`) rewrite. */
const JSX_WHITESPACE = /[\t\n\r]/;

/**
 * The boolean attributes Astro's renderer knows (`htmlBooleanAttributes` in
 * `astro/dist/runtime/server/render/util.js`, 7.3): it renders `false` as no attribute and
 * `true` as a bare one. It renders a boolean on any other attribute as `="false"`/`="true"`.
 */
const ASTRO_BOOLEAN_ATTRIBUTES: ReadonlySet<string> = new Set(
  `allowfullscreen async autofocus autoplay checked controls default defer disabled
  disablepictureinpicture disableremoteplayback formnovalidate inert loop muted nomodule
  novalidate open playsinline readonly required reversed scoped seamless selected itemscope`.split(
    /\s+/,
  ),
);

/**
 * The parameters of a list's callback: the item and the index as far as the body reads them.
 * Astro prints no `key`, so a variable only the key reads is left out too (the printer keeps
 * an index any expression reads), and a callback that reads neither takes none.
 */
function listParameters(node: ForNode, item: string, index: string | undefined): string {
  const read = referencedBindings(node.body, { includeKeys: false });
  if (index !== undefined && node.index !== undefined && read.has(node.index)) {
    return `${item}, ${index}`;
  }
  return read.has(node.item) ? item : "";
}

/** What a branch or a list body holds, as an expression in a ternary or a `.map` callback. */
function content(nodes: ConditionalBranch["branch"]): MarkupPiece {
  const [only, ...more] = nodes.children;
  if (more.length === 0 && only?.kind === "Element") {
    return { kind: "element", element: only, directives: [] };
  }
  if (more.length === 0 && only?.kind === "Text") {
    return { kind: "code", code: JSON.stringify(only.value) };
  }
  return {
    kind: "wrapper",
    tag: "",
    attributes: [],
    content: { kind: "nodes", nodes: nodes.children, container: nodes },
  };
}

/**
 * Astro markup: `{` opens an expression in text, and `>` is written `&gt;` too: Astro's compiler
 * reads it as text, but its ESLint parser (L5) parses text as JSX does, which rejects a bare `>`
 * (ADR-0042). Astro's default `compressHTML: "jsx"`
 * applies JSX's whitespace rules: it removes whitespace that holds a line break between or
 * around elements and expressions, and trims lines around line breaks in text. Text holding a
 * line break or a tab is printed as an expression, and so is text with whitespace at an outer
 * edge of the root, where the target's own line break would meet it.
 *
 * A conditional is a ternary chain whose missing else is `null`, with an empty branch as `null`
 * in its place; a branch that is not one element or one text is a fragment. A list is a `.map`
 * whose callback returns its body. A bindable boolean attribute Astro's renderer does not know
 * (`multiple`, `ismap`) is written `name={c ? "" : undefined}` (ADR-0037). A class goes through
 * `class:list` whenever anything in it is bound (Astro's lint rule), and a style through an
 * object whenever any declaration is bound.
 *
 * `compressHTML` is a project setting a component cannot pin. Deferred to M6 (plan §8.2): the
 * unplugin reads Astro's resolved configuration and reports any value but the default.
 */
export const astroDialect: MarkupDialect = {
  name: "astro",
  escapeText: (text, position) =>
    (JSX_WHITESPACE.test(text) && !keepsWhitespace(position)) ||
    (isRoot(position.container) &&
      ((position.first && /^\s/.test(text)) || (position.last && /\s$/.test(text))))
      ? `{${stringLiteral(text)}}`
      : escapeBraces(escapeHtmlText(text)).replace(/>/g, "&gt;"),
  attribute: quotedAttribute,
  voidElement: "self-closing",
  stripsWhitespaceBetweenElements: true,
  stripsEdgeWhitespace: true,
  interpolation: (code) => `{${code}}`,
  boundAttribute: (name, code, { namespace }) =>
    namespace === "html" &&
    BINDABLE_BOOLEAN_ATTRIBUTES.has(name) &&
    !ASTRO_BOOLEAN_ATTRIBUTES.has(name)
      ? `${name}={${test(code)} ? "" : undefined}`
      : `${name}={${code}}`,
  classAttribute: (parts) =>
    parts.every((part) => part.kind === "Static")
      ? [{ name: "class", text: quotedAttribute("class", staticClassValue(parts)) }]
      : [{ name: "class", text: `class:list={[${classArrayItems(parts, true).join(", ")}]}` }],
  styleAttribute: (parts) =>
    parts.every((part) => part.kind === "Static")
      ? [{ name: "style", text: quotedAttribute("style", staticStyleValue(parts)) }]
      : [
          {
            name: "style",
            text: `style={{ ${parts
              .map(
                (part) =>
                  `${part.property.startsWith("--") ? JSON.stringify(part.property) : camelCaseProperty(part.property)}: ${
                    part.kind === "Static" ? JSON.stringify(part.value) : part.value
                  }`,
              )
              .join(", ")} }}`,
          },
        ],
  conditional: (branches) => {
    // A trailing empty branch renders nothing either way.
    let last = branches.length;
    while (last > 0 && branches[last - 1]!.branch.children.length === 0) last--;
    const segments: BlockSegment[] = [];
    let tail = "{";
    for (const { condition, branch } of branches.slice(0, last)) {
      const head = condition === undefined ? "" : `${test(condition)} ? `;
      if (branch.children.length === 0) {
        tail += `${head}null : `;
        continue;
      }
      segments.push({ open: `${tail}${head}`, content: content(branch), parentheses: true });
      tail = condition === undefined ? "" : " : ";
    }
    return [{ kind: "block", segments, close: tail === "" ? "}" : `${tail}null}` }];
  },
  list: ({ node, source, item, index }) => [
    {
      kind: "block",
      segments: [
        {
          open: `{${operand(source)}.map((${listParameters(node, item, index)}) => `,
          content: { kind: "element", element: node.body, directives: [] },
          parentheses: true,
        },
      ],
      close: ")}",
    },
  ],
};
