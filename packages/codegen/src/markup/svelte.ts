// Svelte markup in runes mode (plan §6): `{expr}`, `attr={expr}`, `{#if}` and keyed `{#each}`
// blocks, one `class={[…]}` (clsx), `style:` directives, `on<event>` listener attributes and
// `bind:this`. Svelte parses balanced JavaScript in `{…}`, braces in strings and comments
// included, so expression code is printed as written.
import { HTML_ELEMENTS } from "@unframework/ir";
import type { ElementNode } from "@unframework/ir";

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
  unreachable,
  withoutEmptyBranches,
} from "./printer.ts";
import type { AttributeContext, MarkupDialect } from "./printer.ts";

/** HTML's own whitespace, which Svelte trims at the edges of an element's or a block's content. */
const HTML_WHITESPACE = /[\t\n\f\r ]/;
/**
 * Tabs, line breaks and runs of whitespace, which Svelte may rewrite beside a tag or a block,
 * and which its server folds into one space in a static `class` or `style` value and in a
 * `style:` directive's, where its client keeps them (5.57): `content: "a  b"` would differ.
 */
const CONDENSED = /[\t\n\f\r]|[\t\n\f\r ]{2}/;
/**
 * What Svelte's server escapes in an attribute value (`escape_html`). It hands the static values
 * it renders through its runtime to that runtime escaped already (5.57), so there each of these
 * is escaped twice: `&quot;` renders `&amp;quot;`.
 */
const ESCAPED_TWICE = /[&<"]/;

/** A static attribute value in Svelte markup, where `{` opens an expression. */
const attributeValue = (value: string) => escapeBraces(escapeHtmlAttribute(value));

/**
 * Whether a binding can take Svelte's shorthand, which reads the variable named like the
 * attribute or the style property (`{href}`, `style:color`): the code is that name alone.
 */
const shorthand = (name: string, code: string) => code === name && isIdentifierName(name);

/**
 * Attributes Svelte's element types (`svelte/elements`, 5.57) declare on some elements only, by
 * the elements that declare them. svelte-check rejects one anywhere else, written or bound (a
 * component with a TypeScript script checks its static attributes too), though Svelte renders
 * it as written; so there it goes through an object spread, which TypeScript does not check for
 * excess properties (L4). `autocorrect` is declared on `<input>` only, `popovertarget` and
 * `popovertargetaction` on `<button>` only.
 */
const DECLARED_ONLY_ON: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["autocorrect", new Set(["input"])],
  ["popovertarget", new Set(["button"])],
  ["popovertargetaction", new Set(["button"])],
]);

/** Whether Svelte's element types lack an attribute on an element (see `DECLARED_ONLY_ON`). */
const untyped = (name: string, tag: string) => {
  const declared = DECLARED_ONLY_ON.get(name);
  return declared !== undefined && !declared.has(tag);
};

/** An attribute as an object spread of one key: `{...{ autocorrect: value }}`. */
const spreadOne = (name: string, code: string) =>
  `{...{ ${isIdentifierName(name) ? name : JSON.stringify(name)}: ${code} }}`;

/**
 * The elements whose `value` property starts at a value a binding may hold: 0 on an `<li>`, a
 * `<meter>`'s minimum, and "" on a `<data>`, a `<button>` and an `<input>` of the types whose
 * value is a label or a submitted value ("on" on a checkbox or a radio button). Svelte's client
 * sets a bound `value` with `set_value`, which writes nothing while the property already holds
 * the value (5.57), so a first render with it wrote no attribute where every other target
 * writes one. There the binding is an object spread, whose runtime assigns the property on
 * every render, and these elements reflect it to the attribute. `set_value` does write a
 * `<progress>`'s 0, and Svelte assigns an `<option>`'s value every time.
 *
 * Neither form removes the attribute when the value becomes nullish: Svelte clears it as an
 * input's value, which these elements reflect as "0", "" or "null" (and a `<meter>` throws on a
 * first `null`). So the analyser reports a bound `value` that may be nullish there (UF1002,
 * `NULLISH_VALUE_ELEMENTS`). A plugin's IR may still bind one, which the invariants cannot see
 * without types (ADR-0032's limit, as for the analyser's other rules on kinds).
 */
const ASSIGNED_VALUE: ReadonlySet<string> = new Set(["li", "meter", "data", "button", "input"]);

/** Whether a bound attribute of an element is a `value` Svelte must assign (`ASSIGNED_VALUE`). */
const assignedValue = (name: string, tag: string) => name === "value" && ASSIGNED_VALUE.has(tag);

/** Whether the dialect writes one of an element's attributes as an object spread. */
const hasSpread = (element: ElementNode) =>
  element.attributes.some((attribute) => {
    switch (attribute.kind) {
      case "Spread":
        return attribute.keys.some(
          (key) => untyped(key.name, element.tag) || assignedValue(key.name, element.tag),
        );
      case "Bound":
        return untyped(attribute.name, element.tag) || assignedValue(attribute.name, element.tag);
      case "Static":
        return untyped(attribute.name, element.tag);
      case "Class":
      case "Style":
      case "Event":
      case "Ref":
      // Not printed yet (ADR-0055): each target's `emit` reports UF1002 for it.
      case "Model":
        return false;
      default:
        return unreachable(attribute);
    }
  });

/**
 * Whether Svelte's server renders an element's static attributes through its runtime, which
 * escapes them twice (`ESCAPED_TWICE`): every `<option>`'s (`$$renderer.option()`), and those of
 * an element with a spread (`$.attributes()`, `$$renderer.select()`), which is one the dialect
 * writes an object spread on. Svelte's server also renders a `<select>`'s attributes through
 * its runtime when it has a `value`, and escapes a `<textarea>`'s static `value` twice; the
 * analyser rejects both values as form state (M3).
 */
const rendersAtRuntime = (tag: string, context: AttributeContext | undefined) =>
  tag === "option" || (context !== undefined && hasSpread(context.element));

/**
 * Whether a static value of an attribute is written as an expression (`name={"…"}`), which
 * Svelte's server escapes once and keeps as written: where it would escape the attribute text
 * twice, or fold the whitespace of a `style` (`CONDENSED`).
 */
const staticAsExpression = (
  name: string,
  value: string,
  tag: string,
  context: AttributeContext | undefined,
) =>
  (ESCAPED_TWICE.test(value) && rendersAtRuntime(tag, context)) ||
  (name === "style" && CONDENSED.test(value));

/**
 * A static `style:` directive. Svelte's server renders every directive through its runtime, so
 * a value it would escape twice or whose whitespace it would fold is an expression.
 */
const styleDirective = (property: string, value: string) =>
  ESCAPED_TWICE.test(value) || CONDENSED.test(value)
    ? `style:${property}={${stringLiteral(value)}}`
    : `style:${property}="${attributeValue(value)}"`;

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
 * Svelte's server writes most static attribute text into its HTML as it is, but it renders
 * some through its runtime (5.57): the compiler escapes the text into the runtime's call, which
 * escapes it again, and folds the whitespace of a `class` or a `style`, which the client keeps.
 * That is every `style:` directive, every attribute of an `<option>`, and every attribute of an
 * element with a spread; so `title="a<b"` there renders `a&amp;lt;b`. Such a static value
 * holding `&`, `<` or `"`, and a `style` value or a `style:` directive's holding whitespace
 * Svelte folds, is a string-literal expression (`title={"…"}`), which the server escapes once
 * and keeps as written, as the client does.
 *
 * A binding whose value is the variable named like the attribute takes Svelte's shorthand
 * (`{href}`, `style:color`), as Svelte code is written. An attribute Svelte's element types lack
 * on its element is written as an object spread (`DECLARED_ONLY_ON`), and so is a bound `value`
 * that Svelte would skip writing (`ASSIGNED_VALUE`).
 *
 * A class is one `class={[…]}`, never `class:` directives, which remove a token a dynamic part
 * produces (ADR-0038). A style is a static `style="…"` when every declaration is static, and
 * otherwise one `style:` directive per declaration in source order: Svelte renders `style={{…}}`
 * as `[object Object]`.
 *
 * A listener is an `on<event>` attribute, `onclickcapture` in the capture phase (Svelte 5's
 * event attributes, which `svelte/elements` types), its handler as code: a setup function's name
 * (`{onclick}` when it is named like the attribute) or an arrow. Svelte has no attribute for a
 * `once` or a `passive` listener, which its target writes itself (ADR-0047). A template ref is
 * `bind:this`, to the variable the target declares for it.
 *
 * SVG elements get their namespace from the `<svg>` around them in the component, which every
 * IR tree has: a component rooted in an SVG child, which would need
 * `<svelte:options namespace="svg">`, is UF1002 until M3 (ADR-0040). Svelte drops whitespace
 * between SVG elements, and the IR holds none there. A childless one closes itself, but for an
 * SVG element named like an HTML one (`<title>`): Svelte tells them apart by name only, and warns
 * that `<title />` is a self-closing non-void HTML element (`element_invalid_self_closing_tag`).
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
  attribute: (name, value, tag, context) =>
    untyped(name, tag)
      ? spreadOne(name, stringLiteral(value))
      : staticAsExpression(name, value, tag, context)
        ? `${name}={${stringLiteral(value)}}`
        : `${name}="${attributeValue(value)}"`,
  voidElement: "self-closing",
  selfClosingSvg: (tag) => !HTML_ELEMENTS.has(tag),
  stripsWhitespaceBetweenElements: false,
  stripsEdgeWhitespace: true,
  // `{/` closes a block, so code that starts with a regular expression is parenthesised.
  interpolation: (code) => (code.startsWith("/") ? `{(${code})}` : `{${code}}`),
  boundAttribute: (name, code, { element }) =>
    untyped(name, element.tag) || assignedValue(name, element.tag)
      ? spreadOne(name, code)
      : shorthand(name, code)
        ? `{${name}}`
        : `${name}={${code}}`,
  classAttribute: (parts, context) => {
    if (parts.every((part) => part.kind === "Static")) {
      return [
        {
          name: "class",
          text: svelteDialect.attribute(
            "class",
            staticClassValue(parts),
            context.element.tag,
            context,
          ),
        },
      ];
    }
    // One item stands alone: a dynamic value (`class={tone}`) or the toggles' object
    // (`class={{ active, muted }}`), which Svelte passes through clsx as it does an array.
    const items = classArrayItems(parts, true);
    const value = items.length === 1 ? items[0]! : `[${items.join(", ")}]`;
    return [{ name: "class", text: `class={${value}}` }];
  },
  styleAttribute: (parts, context) => {
    if (parts.every((part) => part.kind === "Static")) {
      return [
        {
          name: "style",
          text: svelteDialect.attribute(
            "style",
            staticStyleValue(parts),
            context.element.tag,
            context,
          ),
        },
      ];
    }
    return parts.map((part) => ({
      name: "style",
      text:
        part.kind === "Static"
          ? styleDirective(part.property, part.value)
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
  eventAttribute: ({ attribute, handler, statement }) => {
    const option = attribute.once ? "once" : attribute.passive ? "passive" : undefined;
    if (option) {
      throw new Error(
        `Svelte has no attribute for a ${option} \`${attribute.event}\` listener: the Svelte target writes it.`,
      );
    }
    const name = `on${attribute.event}${attribute.capture ? "capture" : ""}`;
    const code = statement ?? handler;
    return [{ name, text: shorthand(name, code) ? `{${name}}` : `${name}={${code}}` }];
  },
  refAttribute: ({ name }) => [{ name: "bind:this", text: `bind:this={${name}}` }],
};
