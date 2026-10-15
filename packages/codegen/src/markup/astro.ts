// Astro markup (plan §6): JSX-like expressions in `{…}`, ternary chains ending in `null` for
// conditionals (never `&&`, which renders a falsy left side), `.map` without `key` (Astro would
// render it as an attribute), `class:list` and style objects. Astro's compiler reads balanced
// JavaScript in `{…}`, braces in strings, templates and regular expressions included, so
// expression code is printed as written.
import { BINDABLE_BOOLEAN_ATTRIBUTES } from "@unframework/ir";
import type { ForNode, RenderNode } from "@unframework/ir";

import { referencedBindings } from "../references.ts";
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
import type {
  BlockSegment,
  Container,
  MarkupDialect,
  MarkupPiece,
  PrintedAttribute,
  PrintedFill,
} from "./printer.ts";

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
  const read = referencedBindings(node.body, { includeKeys: false, includeClient: false });
  if (index !== undefined && node.index !== undefined && read.has(node.index)) {
    return `${item}, ${index}`;
  }
  return read.has(node.item) ? item : "";
}

/**
 * What a branch, a list body or a slot's fallback holds, as an expression in a ternary or a
 * `.map` callback.
 */
function content(nodes: readonly RenderNode[], container: Container): MarkupPiece {
  const [only, ...more] = nodes;
  if (more.length === 0 && only?.kind === "Element") {
    return { kind: "element", element: only, directives: [] };
  }
  if (more.length === 0 && only?.kind === "Component") {
    return { kind: "component", component: only, directives: [] };
  }
  if (more.length === 0 && only?.kind === "Text") {
    return { kind: "code", code: JSON.stringify(only.value) };
  }
  return {
    kind: "wrapper",
    tag: "",
    attributes: [],
    content: { kind: "nodes", nodes, container },
  };
}

/**
 * A string prop Astro passes on as written between quotes: its compiler decodes no character
 * reference in a component's attribute, so any other string is a string literal in braces.
 */
const PLAIN_PROP = /^[^"&{}<>\\`$\t\n\r\u00a0]*$/;

/**
 * A fill as the content of a component element (ADR-0054): the default slot's children as they
 * are, a named slot's in `<Fragment slot="title">`, and a slot the component forwards as its own
 * `<slot>`. Astro's compiler gives a component every slot its content names, whatever an
 * expression around it gives, so the target branches the element on the forwarded slots'
 * presence and keeps a forwarded fill only where it is present. A scoped fill is no content:
 * Astro's `<Fragment slot>` drops a slot's arguments, so the target passes it as a render prop
 * named as the slot.
 */
function fillContent({ fill, forwardsProps }: PrintedFill): MarkupPiece {
  if (fill.parameter !== undefined || forwardsProps) {
    throw new Error(`The astro dialect writes no scoped fill (${fill.slot}): it is a render prop.`);
  }
  const slot: PrintedAttribute = { name: "slot", text: quotedAttribute("slot", fill.slot) };
  if (fill.forward === "default") return { kind: "tag", tag: "slot", attributes: [] };
  if (fill.forward !== undefined) {
    const name = { name: "name", text: quotedAttribute("name", fill.forward) };
    return { kind: "tag", tag: "slot", attributes: [name, slot] };
  }
  const nodes: MarkupPiece = { kind: "nodes", nodes: fill.children, container: fill };
  return fill.slot === "default"
    ? nodes
    : { kind: "wrapper", tag: "Fragment", attributes: [slot], content: nodes };
}

/**
 * Astro markup: `{` opens an expression in text, and `>` is written `&gt;` too: Astro's compiler
 * reads it as text, but its ESLint parser (L5) parses text as JSX does, which rejects a bare `>`
 * (ADR-0042). Astro's default `compressHTML: "jsx"` applies JSX's whitespace rules: it removes
 * whitespace that holds a line break between or around elements and expressions, and trims
 * lines around line breaks in text. Text holding a line break or a tab is printed as an
 * expression, and so is text with whitespace at an outer edge of the root, where the target's
 * own line break would meet it, and text that starts the root with `---`, which a component
 * without props would start its file with: tools read a file that starts with `---` and a line
 * break as one that opens a frontmatter (the formatter, ADR-0041, and the harness's canaries).
 *
 * A conditional is a ternary chain whose missing else is `null`, with an empty branch as `null`
 * in its place; a branch that is not one element or one text is a fragment. A list is a `.map`
 * whose callback returns its body. A bindable boolean attribute Astro's renderer does not know
 * (`multiple`, `ismap`) is written `name={c ? "" : undefined}` (ADR-0037). A class goes through
 * `class:list` whenever anything in it is bound (Astro's lint rule), and a style through an
 * object whenever any declaration is bound.
 *
 * Astro renders on the server only: a listener and a template ref write nothing, and the capability
 * check reports the module's first as inert (`interactivity`, UF4001 info).
 *
 * `compressHTML` is a project setting a component cannot pin. Deferred to M6 (plan §8.2): the
 * unplugin reads Astro's resolved configuration and reports any value but the default.
 */
export const astroDialect: MarkupDialect = {
  name: "astro",
  escapeText: (text, position) =>
    (JSX_WHITESPACE.test(text) && !keepsWhitespace(position)) ||
    (isRoot(position.container) &&
      ((position.first && /^(?:\s|---)/.test(text)) || (position.last && /\s$/.test(text))))
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
      segments.push({
        open: `${tail}${head}`,
        content: content(branch.children, branch),
        parentheses: true,
      });
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
          content: content([node.body], node),
          parentheses: true,
        },
      ],
      close: ")}",
    },
  ],
  eventAttribute: () => [],
  refAttribute: () => [],
  inert: true,
  // A component's props are attributes (ADR-0053); no listener runs (`component-event`).
  propAttribute: ({ name, code, literal }) => [
    {
      name,
      text:
        literal !== undefined && PLAIN_PROP.test(literal)
          ? `${name}="${literal}"`
          : `${name}={${code}}`,
    },
  ],
  componentEvent: () => [],
  fills: (fills) => fills.map(fillContent),
  /**
   * A slot outlet (ADR-0054): `<slot>`, named unless it is the default, with the fallback as its
   * content, which Astro renders where the consumer passed no slot. A scoped slot is a render
   * prop the target reads by the slot's name: called with its props, or the fallback where the
   * consumer passed none.
   */
  slotOutlet: ({ node, props }) => {
    if (props) {
      const call = `${node.slot}(${props.code})`;
      if (!node.fallback.length) return [{ kind: "code", code: `{${node.slot}?.(${props.code})}` }];
      return [
        {
          kind: "block",
          segments: [
            {
              open: `{${node.slot} ? ${call} : `,
              content: content(node.fallback, node),
              parentheses: true,
            },
          ],
          close: "}",
        },
      ];
    }
    return [
      {
        kind: "tag",
        tag: "slot",
        attributes:
          node.slot === "default"
            ? []
            : [{ name: "name", text: quotedAttribute("name", node.slot) }],
        ...(node.fallback.length
          ? { content: [{ kind: "nodes", nodes: node.fallback, container: node }] }
          : {}),
      },
    ];
  },
  // A child's model is a prop that renders its value: nothing writes it (ADR-0054).
  modelBinding: ({ attribute, value }) => [
    { name: attribute.model, text: `${attribute.model}={${value}}` },
  ],
};
