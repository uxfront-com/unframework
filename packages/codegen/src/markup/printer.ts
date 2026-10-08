// The markup printer (plan §5.8, ADR-0026): one walk over the IR for every template language, which
// lays out lines so that no whitespace it adds can reach the DOM, while each dialect decides how
// its language writes text, attributes, bindings, listeners and control flow. Expressions and
// handlers reach a dialect as code in the target's spelling (`RewriteRules`, plan §5.4); the
// dialect escapes them for where they sit.
import {
  elementNamespace,
  isBlockElement,
  isVoidElement,
  WHITESPACE_PRESERVING_ELEMENTS,
} from "@unframework/ir";
import type {
  Attribute,
  ComponentAttribute,
  ComponentNode,
  ElementNode,
  EventAttribute,
  Expression,
  ForNode,
  FragmentNode,
  Handler,
  IfBranch,
  ListenerAttribute,
  Namespace,
  RefAttribute,
  RenderNode,
  SlotFill,
  SlotOutletNode,
  SlotReference,
  UfComponent,
} from "@unframework/ir";

import { functionSource, handlerText } from "../functions.ts";
import { parseExpression } from "../parse.ts";
import { referencedBindings } from "../references.ts";
import { bindingOf, needsParentheses, parenthesesNeeded, rewriteExpression } from "../rewrite.ts";
import type { RewriteRules, RewriteSite } from "../rewrite.ts";
import { codeTokens, isIdentifierName } from "./escape.ts";
import type { CodeToken } from "./escape.ts";

/**
 * What holds a child list: an element, a branch of an `If`, a `For` (its body), the root, a
 * fill of a child's slot, or a slot outlet (its fallback).
 */
export type Container = ElementNode | FragmentNode | IfBranch | ForNode | SlotFill | SlotOutletNode;

/** Where a text or an interpolation sits, for the compilers that treat edges differently. */
export interface TextPosition {
  /** The nearest element around it: none at the top level of a root fragment. */
  element: ElementNode | undefined;
  /** What holds it: an element, a branch, or the root fragment (whose edges a target pads). */
  container: Container;
  /** The kind of the sibling before it in its container, if any. */
  previous?: RenderNode["kind"];
  /** The kind of the sibling after it in its container, if any. */
  next?: RenderNode["kind"];
  /** Whether it is its container's first child. */
  first: boolean;
  /** Whether it is its container's last child. */
  last: boolean;
}

/** Where an attribute is printed: its element, and the element's namespace. */
export interface AttributeContext {
  element: ElementNode;
  namespace: Namespace;
}

/** A printed attribute, by the name a dialect orders it by (`v-if`, `key`, `class`). */
export interface PrintedAttribute {
  name: string;
  text: string;
}

/**
 * A part of an element's class, with expressions as code: the IR's class items, a static
 * `class` and a spread's `class` key merged (ADR-0038, ADR-0039).
 */
export type ClassPart =
  | { kind: "Static"; value: string }
  | { kind: "Toggle"; name: string; condition: string }
  | { kind: "Dynamic"; value: string };

/** A declaration of an element's style, with its value as code when it is bound. */
export type StylePart =
  | { kind: "Static"; property: string; value: string }
  | { kind: "Bound"; property: string; value: string };

/** A listener, with its handler as code. */
export interface PrintedEvent {
  /** The listener: its DOM event's name, its option and its handler. */
  attribute: EventAttribute;
  /**
   * The handler as JavaScript, for the `client` site: a named handler's function as the rules
   * spell it (`save`), or an inline handler as an arrow (`functionText`: `() => count++`).
   * Rewritten only when read.
   */
  readonly handler: string;
  /**
   * The handler as the target writes it in its template, when it supplies one
   * (`MarkupOptions.handler`): a template statement, such as Angular's `onSave($event)` calling a
   * method it hoisted the handler to.
   */
  statement?: string;
}

/** A template ref, with its binding's name. */
export interface PrintedRef {
  attribute: RefAttribute;
  /** The `templateRef` binding's name. */
  name: string;
}

/** Where a component element's attributes and fills are printed (ADR-0053). */
export interface ComponentContext {
  component: ComponentNode;
  /** The tag the component is written with. */
  tag: string;
  namespace: Namespace;
}

/** A prop passed to a component, as code: `literal` is the string a static prop holds. */
export interface PrintedProp {
  name: string;
  code: string;
  literal?: string;
}

/** A listener of a child's event, with its handler as code for the `client` site. */
export interface PrintedListener {
  attribute: ListenerAttribute;
  readonly handler: string;
}

/**
 * A fill of a child's slot (ADR-0054): its parameter as written, or the parent's own slot it
 * forwards, with that slot's presence as the target tests it.
 */
export interface PrintedFill {
  fill: SlotFill;
  /** A scoped fill's parameter: a name, or a destructuring pattern, as written. */
  parameter?: string;
  /** Whether the parent's own slot it forwards takes props. */
  forwardsProps?: boolean;
  /** The forwarded slot's presence, `slots.title`, as the rules spell it. */
  presence?: string;
}

/** A slot outlet, with its props as code, and key by key when they are an object literal. */
export interface PrintedSlotOutlet {
  node: SlotOutletNode;
  props?: { code: string; entries?: { key: string; value: string }[] };
}

/** A branch of a conditional, with its condition as code: absent on the final else. */
export interface ConditionalBranch {
  condition?: string;
  /** The branch, whose children the dialect prints and whose position texts take. */
  branch: IfBranch;
}

/** A list, with its parts as code and its variables by name. */
export interface ListParts {
  node: ForNode;
  source: string;
  item: string;
  /** The index variable's name, when a printed expression reads it. */
  index?: string;
  key: string;
}

/**
 * What a dialect writes for a conditional or a list, which the printer lays out:
 * - `nodes`: render nodes printed in a container (a branch's children);
 * - `element`: an element with directives before its own attributes (Vue's `v-if`);
 * - `wrapper`: an element the dialect adds around content (`<template v-if>`), or a fragment
 *   (`<>…</>`) when `tag` is empty;
 * - `block`: segments of content after an opening each (`{#if c}`, `{:else}`), then a closing;
 * - `code`: code that hugs its neighbours like text;
 * - `component`: a component element with directives before its own attributes (Vue's `v-for`);
 * - `tag`: a tag the dialect writes with its attributes (`<slot name="title">`, `<template
 *   #title>`), closing itself without content.
 */
export type MarkupPiece =
  | { kind: "nodes"; nodes: readonly RenderNode[]; container: Container }
  | { kind: "element"; element: ElementNode; directives: readonly PrintedAttribute[] }
  | {
      kind: "wrapper";
      tag: string;
      attributes: readonly PrintedAttribute[];
      content: MarkupPiece;
    }
  | { kind: "block"; segments: readonly BlockSegment[]; close: string }
  | { kind: "code"; code: string }
  | { kind: "component"; component: ComponentNode; directives: readonly PrintedAttribute[] }
  | {
      kind: "tag";
      tag: string;
      attributes: readonly PrintedAttribute[];
      /** Its content: none for a tag that closes itself. */
      content?: readonly MarkupPiece[];
    };

/** A segment of a block: what opens it, and what it holds. */
export interface BlockSegment {
  open: string;
  content: MarkupPiece;
  /**
   * Whether the content goes in parentheses when it takes lines of its own, as JSX in an
   * expression does (Astro's `{c ? (` … `) : null}`).
   */
  parentheses?: boolean;
}

/**
 * How a template language writes markup, and how its compiler treats whitespace. The printer and
 * the dialect together guarantee that the framework renders exactly the IR's DOM; the
 * render-parity tests check that with each framework's own compiler and server renderer.
 */
export interface MarkupDialect {
  name: string;
  /**
   * Writes a text node so that the template compiler produces exactly its value: entities,
   * the language's own delimiters (`{{`, `{`, `@`), and any whitespace the compiler would
   * otherwise collapse or drop.
   */
  escapeText(text: string, position: TextPosition): string;
  /**
   * Writes a static attribute of a `tag` element so that the element gets exactly this value:
   * `name="…"` with the value escaped, or the language's binding when a static value cannot
   * express it. `context`, which the printer always passes, is the element with the rest of
   * its attributes, for a language that writes a value by what is beside it (Svelte's server
   * escapes a static value twice on an element with a spread).
   */
  attribute(name: string, value: string, tag: string, context?: AttributeContext): string;
  /** `<br />` or `<br>`. */
  voidElement: "self-closing" | "html";
  /**
   * Whether a childless SVG element of a tag closes itself (`<circle />`, ADR-0040), as it does
   * unless the language says otherwise: Svelte warns on `<title />`, whose name is HTML's too.
   */
  selfClosingSvg?(tag: string): boolean;
  /**
   * The name a `tag` element in `namespace` is written with, when the language reads its
   * content by its name (Angular reads a `<title>` as text unless it is written `<svg:title>`).
   */
  elementName?(tag: string, namespace: Namespace): string;
  /**
   * Whether the template compiler drops whitespace-only text that holds a line break and sits
   * between two elements or blocks (Vue's `condense`, Angular's whitespace removal, Astro's JSX
   * rules), so the printer may break the line there. Otherwise it breaks inside a tag
   * (`</li\n><li>`), or right after a block's closing.
   */
  stripsWhitespaceBetweenElements: boolean;
  /**
   * Whether it drops whitespace-only text at the start and end of an element's or a block's
   * content, so the printer may break lines there. Otherwise content stays on its tag's line.
   */
  stripsEdgeWhitespace: boolean;
  /**
   * The region an element must be printed in, when the language would read one of its static
   * attribute values as a binding and no escape can stop it (Angular's `{{`).
   */
  literalRegion?(element: ElementNode): LiteralRegion | undefined;
  /** Writes an interpolation of code, rendered as text: nothing when it is nullish. */
  interpolation(code: string, position: TextPosition): string;
  /**
   * Writes an attribute bound to code: left out when the value is nullish, and rendered by
   * ADR-0037's rules otherwise. Spread keys are written as bound attributes too.
   */
  boundAttribute(name: string, code: string, context: AttributeContext): string;
  /** Writes an element's class: the union of its parts' tokens, none when there are none. */
  classAttribute(parts: readonly ClassPart[], context: AttributeContext): PrintedAttribute[];
  /** Writes an element's style: its declarations whose value is present, in any order. */
  styleAttribute(parts: readonly StylePart[], context: AttributeContext): PrintedAttribute[];
  /** Writes a conditional: the first branch whose condition is truthy renders, or the else. */
  conditional(branches: readonly ConditionalBranch[]): MarkupPiece[];
  /** Writes a list: the body for each item of the source, in order. */
  list(list: ListParts): MarkupPiece[];
  /**
   * Writes a listener (ADR-0047): the handler runs, with the DOM event, each time the element's
   * event of that name fires, in the phase and with the option it asks for. A language without a
   * spelling for an option, or for the handler, throws: its target writes the listener itself
   * (`MarkupOptions.attribute` or `handler`), or declares the capability unsupported.
   */
  eventAttribute(event: PrintedEvent, context: AttributeContext): PrintedAttribute[];
  /** Writes a template ref (ADR-0049): the element is the ref's value while it is rendered. */
  refAttribute(ref: PrintedRef, context: AttributeContext): PrintedAttribute[];
  /**
   * Whether the language runs no code in the browser (Astro): it writes no listener and no
   * template ref, so a list's index that only a handler reads is left out too.
   */
  inert?: boolean;
  /** Orders an element's printed attributes, when the language's lint rules want an order. */
  orderAttributes?(attributes: readonly PrintedAttribute[]): PrintedAttribute[];
  /**
   * The tag a component element is written with (ADR-0053): its local name when absent
   * (`<Field>`), or the language's own (Angular's `<uf-field>`).
   */
  componentTag?(name: string): string;
  /** Writes a prop passed to a component (ADR-0053). */
  propAttribute?(prop: PrintedProp, context: ComponentContext): PrintedAttribute[];
  /**
   * Writes a listener of a child's event (ADR-0053): the handler runs with the event's payload
   * each time the child emits it.
   */
  componentEvent?(listener: PrintedListener, context: ComponentContext): PrintedAttribute[];
  /**
   * Writes a component element's content from its fills (ADR-0054): the default slot's
   * children, the named slots' templates, and the forwarded slots. None closes the tag.
   */
  fills?(fills: readonly PrintedFill[], context: ComponentContext): MarkupPiece[];
  /** Writes a slot outlet (ADR-0054): what the parent filled the slot with, or the fallback. */
  slotOutlet?(outlet: PrintedSlotOutlet): MarkupPiece[];
}

/**
 * A wrapper inside which a template language reads markup as written: no bindings and no
 * whitespace processing. The printer writes the element in it with the region's own dialect,
 * on the wrapper's line, breaking lines only inside tags.
 */
export interface LiteralRegion {
  /** The wrapper's opening tag. */
  open: string;
  /** The wrapper's closing tag. */
  close: string;
  /** How the element and its subtree are written inside the wrapper. */
  dialect: MarkupDialect;
}

/** Options for {@link printMarkup}. */
export interface MarkupOptions {
  /** One level of indentation. Defaults to two spaces. */
  indent?: string;
  /** The level the root starts at. */
  level?: number;
  /** The line length above which a tag with attributes puts one per line. Defaults to 100. */
  printWidth?: number;
  /**
   * Prints an attribute the target writes its own way, or returns `undefined`; `""` prints
   * nothing (an attribute another one of the element is written with, as Angular writes the
   * listeners of one event in one).
   */
  attribute?(attribute: Attribute, element: ElementNode): string | undefined;
  /**
   * The template statement a listener runs, when the target writes one its dialect needs
   * (Angular's `onSave($event)`, for a handler it hoisted to a method), or `undefined` to leave
   * the dialect the handler's code (`PrintedEvent.statement`).
   */
  handler?(attribute: EventAttribute, element: ElementNode): string | undefined;
  /**
   * The component the markup belongs to: its bindings resolve the references `rewrite`
   * spells.
   */
  component?: UfComponent;
  /**
   * How the target spells references (Angular's `label()`), for each site: `render` for the
   * template's expressions, `key` for a list's key, `client` for a handler. Code is printed as
   * written without it. Needs `component`.
   */
  rewrite?: RewriteRules;
}

/**
 * The branches of a conditional without its empty ones, for a language that has no idiomatic
 * empty branch (Vue, Svelte, Angular, whose linters reject `@if (c) {}`): each later branch
 * gets the negations of the empty conditions before it (`c ? null : d ? A : B` becomes
 * `!c && d` for A and `!c` for B), and a trailing empty branch, which renders nothing either
 * way, goes. Conditions test truthiness, so the conjunction renders the same branch.
 */
export function withoutEmptyBranches(branches: readonly ConditionalBranch[]): ConditionalBranch[] {
  const kept: ConditionalBranch[] = [];
  const negated: string[] = [];
  for (const each of branches) {
    if (each.branch.children.length === 0) {
      // Only a branch with a condition can be empty (the IR's invariants).
      if (each.condition !== undefined) negated.push(negate(each.condition));
      continue;
    }
    if (negated.length === 0) kept.push(each);
    else {
      const parts = each.condition === undefined ? negated : [...negated, each.condition];
      kept.push({ condition: conjoin(parts), branch: each.branch });
    }
  }
  return kept;
}

/** `!c`, with parentheses around code that a prefix operator would split. */
export function negate(code: string): string {
  const expression = parseExpression(code);
  return expression.type === "UnaryExpression" || !parenthesesNeeded(expression, code, "operand")
    ? `!${code}`
    : `!(${code})`;
}

/** Expressions that need parentheses as an operand of `&&`: lower precedence, or `??`. */
const LOOSER_THAN_AND: ReadonlySet<string> = new Set([
  "ConditionalExpression",
  "ArrowFunctionExpression",
  "AssignmentExpression",
  "SequenceExpression",
  "YieldExpression",
]);

/** `a && b && …`, with parentheses around the operands that need them. */
export function conjoin(parts: readonly string[]): string {
  return parts
    .map((part) => {
      const expression = parseExpression(part);
      const looser =
        LOOSER_THAN_AND.has(expression.type) ||
        (expression.type === "LogicalExpression" && expression.operator !== "&&");
      return looser ? wrapUnlessParenthesised(expression, part) : part;
    })
    .join(" && ");
}

/** `(code)`, unless the author's own parentheses already hold all of it. */
function wrapUnlessParenthesised(expression: { start: number; end: number }, code: string) {
  const wrapped = code.startsWith("(") && code.endsWith(")") && expression.start > 0;
  return wrapped && expression.end < code.length ? code : `(${code})`;
}

/**
 * Code as an operand (`(a ?? b).map`, `!(a && b)`), parenthesised when it would not bind
 * tightly enough there.
 */
export function operand(code: string): string {
  return needsParentheses(code, "operand") ? `(${code})` : code;
}

/** Code as the test of a conditional (`(a ? b : c) ? x : y`). */
export function test(code: string): string {
  return needsParentheses(code, "test") ? `(${code})` : code;
}

/**
 * The object of a spread read key by key (`attrs.id`, `attrs?.["data-x"]`, ADR-0039): through
 * `?.` when it may be nullish there, as the spread's `nullish` says.
 */
export function member(object: string, key: string, optional: boolean): string {
  const target = operand(object);
  if (isIdentifierName(key)) return `${target}${optional ? "?." : "."}${key}`;
  return `${target}${optional ? "?." : ""}[${JSON.stringify(key)}]`;
}

/**
 * Whether text sits where its compiler keeps whitespace as written: directly in a `<pre>` or a
 * `<textarea>`, or in a branch there. Deeper down (`<pre><b> a</b></pre>`), a dialect writes
 * whitespace as it does outside a `<pre>`, in a form every compiler keeps either way.
 */
export function keepsWhitespace(position: TextPosition): boolean {
  return position.element !== undefined && WHITESPACE_PRESERVING_ELEMENTS.has(position.element.tag);
}

/** Whether a container is the root fragment, whose edges a target pads with its own lines. */
export function isRoot(container: Container): container is FragmentNode {
  return "kind" in container && container.kind === "Fragment";
}

/** The static parts of a class, as one `class` value (`a b`). */
export function staticClassValue(parts: readonly ClassPart[]): string {
  return parts.flatMap((part) => (part.kind === "Static" ? [part.value] : [])).join(" ");
}

/** The static declarations of a style, as one `style` value (`color: red; margin: 0`). */
export function staticStyleValue(parts: readonly StylePart[]): string {
  return parts
    .flatMap((part) => (part.kind === "Static" ? [`${part.property}: ${part.value}`] : []))
    .join("; ");
}

/** An object literal of class toggles (`{ active: on, "is-big": big }`), shorthand where it can. */
export function toggleObject(parts: readonly ClassPart[]): string {
  const entries = parts.flatMap((part) => {
    if (part.kind !== "Toggle") return [];
    const { name, condition } = part;
    if (name === condition && isIdentifierName(name)) return [name];
    return [`${isIdentifierName(name) ? name : JSON.stringify(name)}: ${condition}`];
  });
  return `{ ${entries.join(", ")} }`;
}

/**
 * The parts of a class as the items of a clsx-style array (Vue's `:class`, Svelte's `class`,
 * Astro's `class:list`), in source order: static names as string literals unless `statics` is
 * false, dynamic values, and consecutive toggles in one object.
 */
export function classArrayItems(parts: readonly ClassPart[], statics: boolean): string[] {
  const items: string[] = [];
  let run: ClassPart[] = [];
  const flush = () => {
    if (run.length) items.push(toggleObject(run));
    run = [];
  };
  for (const part of parts) {
    if (part.kind === "Toggle") {
      run.push(part);
      continue;
    }
    flush();
    if (part.kind === "Dynamic") items.push(part.value);
    else if (statics) items.push(JSON.stringify(part.value));
  }
  flush();
  return items;
}

/** A laid-out node: what the printer arranges on lines. */
type Item = InlineItem | ElementItem | BlockItem;

/** Text, an interpolation or code: it hugs its neighbours, and no line ever breaks beside it. */
interface InlineItem {
  kind: "inline";
  text: string;
}

/**
 * An attribute as its dialect writes it, and whether its value is code, whose layout is not
 * content (`rebase`): a static value's is.
 */
interface AttributeText {
  text: string;
  code: boolean;
}

/** An element, a wrapper a dialect adds, or a fragment (`<>`, with an empty tag). */
interface ElementItem {
  kind: "element";
  tag: string;
  attributes: AttributeText[];
  /** `>`, or ` />` for a self-closing element. */
  end: string;
  children: Item[];
  /** `</tag>`, or nothing for a void or self-closing element. */
  close: string;
  /** Whether its content stays on its line: whitespace-preserving, or in a literal region. */
  inlineOnly: boolean;
  /** Whether it starts a line even where its compiler keeps whitespace (Svelte). */
  blockLevel: boolean;
  /** The literal region the element is written in (Angular's `ngNonBindable`). */
  region?: LiteralRegion;
}

/** A block of segments: each opens, holds content, and the last is followed by `close`. */
interface BlockItem {
  kind: "block";
  segments: { open: string; children: Item[]; parentheses: boolean }[];
  close: string;
}

/** What surrounds the nodes being turned into items. */
interface Scope {
  dialect: MarkupDialect;
  element: ElementNode | undefined;
  namespace: Namespace;
  preformatted: boolean;
}

/**
 * Prints a component's render root as markup. A line break goes only where the whitespace it
 * creates cannot reach the DOM: between sibling elements and blocks, and at the edges of an
 * element's or a block's content, where the dialect's compiler drops whitespace, or inside a
 * tag. Where the compiler keeps whitespace between siblings (Svelte), siblings break inside a
 * tag (`</li\n><li>`) or right after a block's closing, only next to a block-level element or a
 * block, or once their line is too long. Text and interpolations are never broken and hug their
 * neighbours, so content whose first or last child is either stays on its tag's line. A tag with
 * attributes whose line would pass `printWidth` puts one attribute per line, inline or not; text
 * and tags without attributes are never broken, so a line holding long text still passes it. An
 * element the dialect writes in a literal region (Angular's `{{` in an attribute) is printed
 * inside it, on one line but for its tags. The layout never relies on CSS: the DOM is the IR's
 * whatever the page's styles, and whatever whitespace a target puts around the markup (each
 * dialect protects text at the root's edges).
 */
export function printMarkup(
  root: ElementNode | FragmentNode,
  dialect: MarkupDialect,
  options: MarkupOptions = {},
): string {
  const { rewrite, component } = options;
  if (rewrite && !component) throw new Error("printMarkup: `rewrite` needs the `component`.");
  const code = (expression: Expression, site: RewriteSite = "render"): string =>
    rewrite && component
      ? rewriteExpression(expression, component, rewrite, site)
      : expression.code;
  const indent = options.indent ?? "  ";
  const printWidth = options.printWidth ?? 100;
  const scope: Scope = { dialect, element: undefined, namespace: "html", preformatted: false };
  const roots =
    root.kind === "Fragment" ? itemsOf(root.children, root, scope) : [elementItem(root, [], scope)];
  const level = indent.repeat(options.level ?? 0);
  const rootRuns = layout(roots, level, false);
  return rootRuns ? joinRuns(rootRuns, roots, level).join("\n") : "";

  /** A binding's name: from the component, or from its id (`name@offset`) without one. */
  function bindingName(id: string): string {
    return component ? bindingOf(component, id).name : id.slice(0, id.lastIndexOf("@"));
  }

  /** A handler's code for the `client` site, as written without a component to rewrite it. */
  function handlerCode(handler: Handler): string {
    if (component) return handlerText(handler, component, rewrite, "client");
    return handler.kind === "Function"
      ? bindingName(handler.binding)
      : functionSource(handler.function, handler.function.body.code);
  }

  /** The items of a container's children, each laid out as its kind and the dialect say. */
  function itemsOf(nodes: readonly RenderNode[], container: Container, at: Scope): Item[] {
    return nodes.flatMap((node, index): Item[] => {
      switch (node.kind) {
        case "Text":
          return [inline(at.dialect.escapeText(node.value, position(nodes, index, container, at)))];
        case "Interpolation":
          return [
            inline(
              at.dialect.interpolation(code(node.value), position(nodes, index, container, at)),
            ),
          ];
        case "Element":
          return [elementItem(node, [], at)];
        case "If":
          return node.branches.length === 0
            ? []
            : piecesItems(
                at.dialect.conditional(
                  node.branches.map((branch) =>
                    branch.condition === undefined
                      ? { branch }
                      : { condition: code(branch.condition), branch },
                  ),
                ),
                at,
              );
        case "For":
          return piecesItems(at.dialect.list(listParts(node)), at);
        case "Component":
          return [componentItem(node, [], at)];
        case "SlotOutlet":
          return piecesItems(hook(at.dialect, "slotOutlet")(slotOutletParts(node)), at);
        // `<component is>` is not printed yet (ADR-0055): each target's `emit` reports UF1002
        // for it before printing.
        case "Dynamic":
          return [];
        default:
          return unreachable(node);
      }
    });
  }

  function position(
    nodes: readonly RenderNode[],
    index: number,
    container: Container,
    at: Scope,
  ): TextPosition {
    return {
      element: at.element,
      container,
      ...(index > 0 ? { previous: nodes[index - 1]!.kind } : {}),
      ...(index < nodes.length - 1 ? { next: nodes[index + 1]!.kind } : {}),
      first: index === 0,
      last: index === nodes.length - 1,
    };
  }

  function listParts(node: ForNode): ListParts {
    // An index no printed expression or handler reads is left out, so linters see no unused
    // variable; one only a handler reads is kept where the language runs handlers.
    const read = referencedBindings(node, { includeClient: dialect.inert !== true });
    const index =
      node.index !== undefined && read.has(node.index) ? bindingName(node.index) : undefined;
    return {
      node,
      source: code(node.source),
      item: bindingName(node.item),
      ...(index === undefined ? {} : { index }),
      key: code(node.key, "key"),
    };
  }

  function piecesItems(pieces: readonly MarkupPiece[], at: Scope): Item[] {
    return pieces.flatMap((piece) => pieceItems(piece, at));
  }

  function pieceItems(piece: MarkupPiece, at: Scope): Item[] {
    switch (piece.kind) {
      case "nodes":
        return itemsOf(piece.nodes, piece.container, at);
      case "element":
        return [elementItem(piece.element, piece.directives, at)];
      case "wrapper": {
        const attributes = piece.attributes.map(({ text }) => ({ text, code: false }));
        return [
          {
            kind: "element",
            tag: piece.tag,
            attributes,
            end: ">",
            children: pieceItems(piece.content, at),
            close: `</${piece.tag}>`,
            inlineOnly: at.preformatted,
            blockLevel: true,
          },
        ];
      }
      case "block":
        return [
          {
            kind: "block",
            segments: piece.segments.map((segment) => ({
              open: segment.open,
              children: pieceItems(segment.content, at),
              parentheses: segment.parentheses ?? false,
            })),
            close: piece.close,
          },
        ];
      case "code":
        return [inline(piece.code)];
      case "component":
        return [componentItem(piece.component, piece.directives, at)];
      case "tag": {
        const children = (piece.content ?? []).flatMap((each) => pieceItems(each, at));
        const closes = piece.content === undefined;
        return [
          {
            kind: "element",
            tag: piece.tag,
            attributes: piece.attributes.map(({ text }) => ({ text, code: true })),
            end: closes ? " />" : ">",
            children,
            close: closes ? "" : `</${piece.tag}>`,
            inlineOnly: at.preformatted,
            blockLevel: false,
          },
        ];
      }
      default:
        return unreachable(piece);
    }
  }

  /**
   * A component element (ADR-0053), with directives before its own attributes: its props,
   * listeners, fallthrough `class` and `style` and ref through the dialect's hooks, then its
   * fills as its content. It closes itself without content.
   */
  function componentItem(
    node: ComponentNode,
    directives: readonly PrintedAttribute[],
    at: Scope,
  ): ElementItem {
    const tag = at.dialect.componentTag?.(node.component) ?? node.component;
    const context: ComponentContext = { component: node, tag, namespace: at.namespace };
    const content = hook(at.dialect, "fills")(node.fills.map(fillParts), context);
    const children = content.flatMap((piece) => pieceItems(piece, at));
    const empty = content.length === 0;
    return {
      kind: "element",
      tag,
      attributes: componentAttributesOf(node, directives, at.dialect, context),
      end: empty ? " />" : ">",
      children,
      close: empty ? "" : `</${tag}>`,
      inlineOnly: at.preformatted,
      blockLevel: false,
    };
  }

  /** A component's attributes as its dialect writes them, `class` parts merged as an element's. */
  function componentAttributesOf(
    node: ComponentNode,
    directives: readonly PrintedAttribute[],
    of: MarkupDialect,
    context: ComponentContext,
  ): AttributeText[] {
    // The element-shaped context the class, style and ref hooks take: the component's tag.
    const element: ElementNode = {
      kind: "Element",
      tag: context.tag,
      attributes: [],
      children: [],
      span: node.span,
    };
    const attributeContext: AttributeContext = { element, namespace: context.namespace };
    const printed: PrintedAttribute[] = [...directives];
    for (const attribute of node.attributes as readonly ComponentAttribute[]) {
      switch (attribute.kind) {
        case "Prop": {
          const value = code(attribute.value);
          const literal = stringLiteralValue(attribute.value.code);
          printed.push(
            ...hook(of, "propAttribute")(
              { name: attribute.name, code: value, ...(literal === undefined ? {} : { literal }) },
              context,
            ),
          );
          break;
        }
        case "Listener":
          printed.push(
            ...hook(of, "componentEvent")(
              {
                attribute,
                get handler() {
                  return handlerCode(attribute.handler);
                },
              },
              context,
            ),
          );
          break;
        case "Class":
          printed.push(
            ...of.classAttribute(
              attribute.items.map((item): ClassPart =>
                item.kind === "Static"
                  ? { kind: "Static", value: item.value }
                  : item.kind === "Toggle"
                    ? { kind: "Toggle", name: item.name, condition: code(item.condition) }
                    : { kind: "Dynamic", value: code(item.value) },
              ),
              attributeContext,
            ),
          );
          break;
        case "Style":
          printed.push(
            ...of.styleAttribute(
              attribute.declarations.map((declaration): StylePart =>
                declaration.kind === "Static"
                  ? { kind: "Static", property: declaration.property, value: declaration.value }
                  : {
                      kind: "Bound",
                      property: declaration.property,
                      value: code(declaration.value),
                    },
              ),
              attributeContext,
            ),
          );
          break;
        case "Ref":
          printed.push(
            ...of.refAttribute(
              { attribute, name: bindingName(attribute.binding) },
              attributeContext,
            ),
          );
          break;
        // A component model is not printed yet (ADR-0055): each target's `emit` reports UF1002
        // for it before printing.
        case "ModelBinding":
          break;
        default:
          unreachable(attribute);
      }
    }
    return (of.orderAttributes?.(printed) ?? printed).map((each) => ({
      text: each.text,
      code: true,
    }));
  }

  /** A fill, with its parameter as written and a forwarded slot's presence. */
  function fillParts(fill: SlotFill): PrintedFill {
    const parameter = fill.parameter?.name ?? fill.parameter?.pattern?.code;
    if (fill.forward === undefined) return { fill, ...(parameter ? { parameter } : {}) };
    const declared = component?.slots?.slots.find((each) => each.name === fill.forward);
    return {
      fill,
      forwardsProps: declared?.props !== undefined,
      presence: slotPresence(fill.forward),
    };
  }

  /** A slot's presence as the rules spell it: `slots.title` as written by default. */
  function slotPresence(slot: string): string {
    const slots = component?.slots;
    const written = `${slots ? bindingName(slots.binding) : "slots"}.${slot}`;
    const reference: SlotReference = {
      kind: "Slot",
      slot,
      span: slots?.span ?? { start: 0, end: 0 },
    };
    return rewrite?.slot?.(reference, "render") ?? written;
  }

  /** A slot outlet, with its props as code, key by key when they are an object literal. */
  function slotOutletParts(node: SlotOutletNode): PrintedSlotOutlet {
    if (!node.props) return { node };
    const entries = objectEntries(node.props)?.map(({ key, value }) => ({
      key,
      value: code(value),
    }));
    return { node, props: { code: code(node.props), ...(entries ? { entries } : {}) } };
  }

  function elementItem(
    element: ElementNode,
    directives: readonly PrintedAttribute[],
    at: Scope,
  ): ElementItem {
    const namespace = elementNamespace(element.tag, at.namespace);
    const region = at.dialect.literalRegion?.(element);
    const inner: Scope = {
      dialect: region?.dialect ?? at.dialect,
      element,
      namespace,
      preformatted: at.preformatted || WHITESPACE_PRESERVING_ELEMENTS.has(element.tag),
    };
    const children = itemsOf(element.children, element, inner);
    const isVoid = namespace === "html" && isVoidElement(element.tag);
    // A childless SVG element closes itself (ADR-0040): the HTML parser honours `/>` in foreign
    // content, and every template compiler reads it, though one may warn (`selfClosingSvg`).
    const selfClosing =
      (isVoid && inner.dialect.voidElement === "self-closing") ||
      (namespace === "svg" &&
        children.length === 0 &&
        (inner.dialect.selfClosingSvg?.(element.tag) ?? true));
    const name = inner.dialect.elementName?.(element.tag, namespace) ?? element.tag;
    return {
      kind: "element",
      tag: name,
      attributes: attributesOf(element, directives, inner.dialect, namespace),
      end: selfClosing ? " />" : ">",
      children,
      close: isVoid || selfClosing ? "" : `</${name}>`,
      // Astro keeps the whitespace in a `<title>`, whose content is text in every namespace.
      inlineOnly: inner.preformatted || region !== undefined || element.tag === "title",
      blockLevel: isBlockElement(element.tag),
      ...(region ? { region } : {}),
    };
  }

  /**
   * An element's attributes as its dialect writes them: spreads read key by key, and every
   * source of its class (a static `class`, a `class={…}`, a spread's `class` key) merged into
   * one part list at the first one's place (ADR-0039).
   */
  function attributesOf(
    element: ElementNode,
    directives: readonly PrintedAttribute[],
    of: MarkupDialect,
    namespace: Namespace,
  ): AttributeText[] {
    const context: AttributeContext = { element, namespace };
    const printed: PrintedAttribute[] = [...directives];
    // The attributes whose text is a static value, never code.
    const values = new Set<PrintedAttribute>();
    const custom = new Map<Attribute, string>();
    for (const attribute of element.attributes) {
      const text = options.attribute?.(attribute, element);
      if (text !== undefined) custom.set(attribute, text);
    }
    const spreadClass = element.attributes.some(
      (attribute) =>
        attribute.kind === "Spread" &&
        !custom.has(attribute) &&
        attribute.keys.some((key) => key.name === "class"),
    );
    const classParts: ClassPart[] = [];
    let classAt: number | undefined;
    const claimClass = () => {
      classAt ??= printed.length;
    };
    for (const attribute of element.attributes) {
      const text = custom.get(attribute);
      if (text !== undefined) {
        if (text !== "") printed.push({ name: attributeName(attribute), text });
        continue;
      }
      switch (attribute.kind) {
        case "Static":
          if (attribute.name === "class" && spreadClass && attribute.value !== true) {
            claimClass();
            classParts.push({ kind: "Static", value: attribute.value });
          } else {
            const value: PrintedAttribute = {
              name: attribute.name,
              text:
                attribute.value === true
                  ? attribute.name
                  : of.attribute(attribute.name, attribute.value, element.tag, context),
            };
            values.add(value);
            printed.push(value);
          }
          break;
        case "Bound":
          printed.push({
            name: attribute.name,
            text: of.boundAttribute(attribute.name, code(attribute.value), context),
          });
          break;
        case "Class":
          claimClass();
          for (const item of attribute.items) {
            classParts.push(
              item.kind === "Static"
                ? { kind: "Static", value: item.value }
                : item.kind === "Toggle"
                  ? { kind: "Toggle", name: item.name, condition: code(item.condition) }
                  : { kind: "Dynamic", value: code(item.value) },
            );
          }
          break;
        case "Style":
          printed.push(
            ...of.styleAttribute(
              attribute.declarations.map((declaration) =>
                declaration.kind === "Static"
                  ? { kind: "Static", property: declaration.property, value: declaration.value }
                  : {
                      kind: "Bound",
                      property: declaration.property,
                      value: code(declaration.value),
                    },
              ),
              context,
            ),
          );
          break;
        case "Spread": {
          const object = code(attribute.value);
          for (const key of attribute.keys) {
            const value = member(object, key.name, attribute.nullish);
            if (key.name === "class") {
              claimClass();
              classParts.push({ kind: "Dynamic", value });
            } else {
              printed.push({ name: key.name, text: of.boundAttribute(key.name, value, context) });
            }
          }
          break;
        }
        case "Event": {
          const statement = options.handler?.(attribute, element);
          const event: PrintedEvent = {
            attribute,
            get handler() {
              return handlerCode(attribute.handler);
            },
            ...(statement === undefined ? {} : { statement }),
          };
          printed.push(...of.eventAttribute(event, context));
          break;
        }
        case "Ref":
          printed.push(
            ...of.refAttribute({ attribute, name: bindingName(attribute.binding) }, context),
          );
          break;
        // Not printed yet, as composition's nodes.
        case "Model":
          break;
        default:
          unreachable(attribute);
      }
    }
    if (classAt !== undefined)
      printed.splice(classAt, 0, ...of.classAttribute(classParts, context));
    return (of.orderAttributes?.(printed) ?? printed).map((each) => ({
      text: each.text,
      code: !values.has(each),
    }));
  }

  /**
   * Splits items into runs of indices that may each start a line at `pad`, or returns
   * `undefined` when they must stay on the line they start on. `edges` says whether the items
   * are content between an opening and a closing, whose edges must allow a break.
   */
  function layout(items: readonly Item[], pad: string, edges: boolean): number[][] | undefined {
    if (!items.length) return undefined;
    if (
      edges &&
      (!dialect.stripsEdgeWhitespace || isInline(items[0]!) || isInline(items.at(-1)!))
    ) {
      return undefined;
    }
    const runs: number[][] = [[0]];
    // The width of the current run's line, for a dialect that keeps whitespace between
    // siblings: there a run of inline siblings breaks only when it is too long, and inside a
    // tag (`glue`), which puts the next run's first `>` before it.
    let width = pad.length + inlineText(items[0]!).length;
    for (let index = 1; index < items.length; index++) {
      const before = items[index - 1]!;
      const after = items[index]!;
      const next = inlineText(after).length;
      const breakable =
        !isInline(before) &&
        !isInline(after) &&
        (dialect.stripsWhitespaceBetweenElements ||
          isBlockLevel(before) ||
          isBlockLevel(after) ||
          width + next > printWidth);
      if (breakable) {
        runs.push([index]);
        width = pad.length + 1 + next;
      } else {
        runs.at(-1)!.push(index);
        width += next;
      }
    }
    return runs;
  }

  /** Each run on its lines at `pad`, joined where the compiler drops the line breaks, or glued. */
  function joinRuns(runs: readonly number[][], items: readonly Item[], pad: string): string[] {
    const body = runs.map((run) => {
      const only = items[run[0]!]!;
      if (run.length === 1 && !isInline(only)) return printItem(only, pad);
      const line = [pad];
      for (const index of run) writeItem(line, items[index]!);
      return line;
    });
    return dialect.stripsWhitespaceBetweenElements ? body.flat() : body.reduce(glue);
  }

  /** An item that starts a line at `pad`, with its content on its line or on lines of its own. */
  function printItem(item: Item, pad: string): string[] {
    const lines = [pad];
    switch (item.kind) {
      case "inline":
        writeItem(lines, item);
        return lines;
      case "element": {
        const runs =
          item.inlineOnly || item.region ? undefined : layout(item.children, pad + indent, true);
        if (!runs) {
          writeItem(lines, item);
          return lines;
        }
        writeOpenTag(lines, item, 0);
        return [...lines, ...joinRuns(runs, item.children, pad + indent), `${pad}${item.close}`];
      }
      case "block": {
        const runs = item.segments.map((segment) => layout(segment.children, pad + indent, true));
        if (runs.some((run) => run === undefined)) {
          writeItem(lines, item);
          return lines;
        }
        const out: string[] = [];
        let after = "";
        item.segments.forEach((segment, index) => {
          out.push(`${pad}${after}${segment.open}${segment.parentheses ? "(" : ""}`);
          out.push(...joinRuns(runs[index]!, segment.children, pad + indent));
          after = segment.parentheses ? ")" : "";
        });
        out.push(`${pad}${after}${item.close}`);
        return out;
      }
      default:
        return unreachable(item);
    }
  }

  /** Writes an item on one line from the end of the last line, breaking only inside tags. */
  function writeItem(lines: string[], item: Item): void {
    switch (item.kind) {
      case "inline":
        lines[lines.length - 1] += item.text;
        return;
      case "element": {
        if (item.region) lines[lines.length - 1] += item.region.open;
        const content = item.children.map(inlineText).join("");
        writeOpenTag(lines, item, content.length + item.close.length);
        for (const child of item.children) writeItem(lines, child);
        lines[lines.length - 1] += item.close;
        if (item.region) lines[lines.length - 1] += item.region.close;
        return;
      }
      case "block":
        for (const segment of item.segments) {
          lines[lines.length - 1] += segment.open;
          for (const child of segment.children) writeItem(lines, child);
        }
        lines[lines.length - 1] += item.close;
        return;
      default:
        unreachable(item);
    }
  }

  /**
   * Writes an opening tag from the end of the last line. Whitespace inside a tag is never
   * content, so a tag with attributes that would take its line past `printWidth`, with what
   * follows it on the line (`after` characters), or with an attribute whose code spans lines,
   * puts one attribute per line, indented from that line. Code that spans lines is moved to its
   * attribute's column (`rebase`).
   */
  function writeOpenTag(lines: string[], item: ElementItem, after: number): void {
    const items = item.attributes;
    const tag = `<${item.tag}${items.map(({ text }) => ` ${text}`).join("")}${item.end}`;
    const line = lines[lines.length - 1]!;
    const column = line.length - line.lastIndexOf("\n") - 1;
    const multiline = items.some(({ text, code }) => code && text.includes("\n"));
    if (!items.length || (!multiline && column + tag.length + after <= printWidth)) {
      lines[lines.length - 1] += tag;
      return;
    }
    const base = /^[\t ]*/.exec(line)![0];
    const pad = `${base}${indent}`;
    lines[lines.length - 1] += `<${item.tag}`;
    lines.push(
      ...items.map(({ text, code }) => `${pad}${code ? rebase(text, pad, indent) : text}`),
      `${base}${item.end.trim()}`,
    );
  }
}

/**
 * An attribute whose code spans lines, with its continuation lines moved to its own column,
 * `pad`, keeping their indentation relative to each other. Code from the source carries the
 * source's indentation, which is not the output's (the markup is laid out by the printer, never
 * by a formatter, ADR-0026). The source's own layout says where the attribute stood: a line that
 * closes a bracket the first line opened (a handler's closing brace) stood at its column and
 * goes to `pad`; without one, the continuation lines stood one level in (a conditional's `?`
 * and `:`), and go one `indent` past `pad`. A line that starts inside a string or template
 * literal stays as it is: its text is the literal's value. An attribute whose code cannot be
 * found or parsed keeps its lines as they are.
 */
function rebase(text: string, pad: string, indent: string): string {
  if (!text.includes("\n")) return text;
  const lines = attributeLines(text);
  if (!lines) return text;
  const texts = text.split("\n");
  const moved = lines.filter((line) => line.index > 0 && !line.fixed && !line.blank);
  if (!moved.length) return text;
  const width = (index: number) => /^[\t ]*/.exec(texts[index]!)![0].length;
  const common = Math.min(...moved.map(({ index }) => width(index)));
  const opened = lines[1]?.depth ?? 0;
  const closing = moved.find(({ closes, depth }) => closes > 0 && depth - closes < opened);
  const at = closing && width(closing.index) === common ? pad : `${pad}${indent}`;
  return texts
    .map((line, index) => {
      if (index === 0 || lines[index]!.fixed) return line;
      return lines[index]!.blank ? "" : `${at}${line.slice(common)}`;
    })
    .join("\n");
}

/** Where an attribute's code starts: after `name={`, `name="`, `{@attach `, `{...` or `{`. */
const ATTRIBUTE_CODE = /^[^"{]*?(?:\{@attach\s+|\{\.\.\.|\{|")/;

/** A line of an attribute's code, as {@link rebase} reads it. */
interface CodeLine {
  index: number;
  /** Whether it starts inside a string or template literal. */
  fixed: boolean;
  blank: boolean;
  /** The brackets open at its start. */
  depth: number;
  /** The closing brackets it starts with. */
  closes: number;
}

/**
 * Each line of an attribute's text, as its code reads it; `undefined` when the code cannot be
 * found or parsed. The code is read token by token (`codeTokens`), so a bracket or a line break
 * in a literal or a comment is no code.
 */
function attributeLines(text: string): CodeLine[] | undefined {
  const opening = ATTRIBUTE_CODE.exec(text)?.[0];
  const quoted = opening?.endsWith('"');
  if (opening === undefined || !text.endsWith(quoted ? '"' : "}")) return undefined;
  // References never span lines, so decoding them keeps every line where it is.
  const code = text.slice(opening.length, -1);
  const source = quoted ? decodeReferences(code) : code;
  let tokens: CodeToken[];
  try {
    tokens = codeTokens(source, "expression");
  } catch {
    try {
      tokens = codeTokens(source, "statements");
    } catch {
      return undefined;
    }
  }
  const literalAt = (offset: number) =>
    tokens.some(
      (token) =>
        (token.kind === "string" || token.kind === "template") &&
        token.start < offset &&
        offset <= token.end,
    );
  const inToken = (offset: number) =>
    tokens.some((token) => token.start <= offset && offset < token.end);
  const lines: CodeLine[] = [];
  let depth = 0;
  let offset = 0;
  source.split("\n").forEach((line, index) => {
    const indentation = /^[\t ]*/.exec(line)![0].length;
    const closes = /^[)\]}]*/.exec(line.slice(indentation))![0].length;
    lines.push({
      index,
      fixed: index > 0 && literalAt(offset),
      blank: line.trim() === "",
      depth,
      closes: inToken(offset + indentation) ? 0 : closes,
    });
    for (let at = 0; at < line.length; at++) {
      if (inToken(offset + at)) continue;
      const character = line[at]!;
      if (character === "(" || character === "[" || character === "{") depth++;
      else if (character === ")" || character === "]" || character === "}") depth--;
    }
    offset += line.length + 1;
  });
  return lines;
}

/** HTML's character references in a quoted attribute's code, decoded. */
function decodeReferences(code: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: "\u00a0",
    quot: '"',
  };
  return code.replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi, (reference, hex, decimal, name) =>
    hex !== undefined
      ? String.fromCodePoint(Number.parseInt(hex as string, 16))
      : decimal !== undefined
        ? String.fromCodePoint(Number(decimal))
        : (named[(name as string).toLowerCase()] ?? reference),
  );
}

/** A dialect's optional hook, which a dialect that meets its construct must have. */
function hook<K extends "propAttribute" | "componentEvent" | "fills" | "slotOutlet">(
  dialect: MarkupDialect,
  name: K,
): NonNullable<MarkupDialect[K]> {
  const found = dialect[name];
  if (!found) {
    throw new Error(`The ${dialect.name} dialect does not print composition yet (${name}).`);
  }
  return found.bind(dialect) as NonNullable<MarkupDialect[K]>;
}

/** The string a string literal's code holds, or `undefined` for any other code. */
function stringLiteralValue(code: string): string | undefined {
  const expression = parseExpression(code);
  return expression.type === "Literal" && typeof expression.value === "string"
    ? expression.value
    : undefined;
}

/**
 * The entries of an object literal's code, `{ item, count: count.value }`, each value an
 * expression of its own with the references inside it, or `undefined` for one with a spread, a
 * computed or a method member. A shorthand value is its name, read as the expression it is.
 */
export function objectEntries(
  expression: Expression,
): { key: string; value: Expression }[] | undefined {
  const parsed = parseExpression(expression.code);
  if (parsed.type !== "ObjectExpression") return undefined;
  const entries: { key: string; value: Expression }[] = [];
  for (const property of parsed.properties) {
    if (property.type !== "Property" || property.computed || property.kind !== "init") {
      return undefined;
    }
    if (property.method) return undefined;
    const key =
      property.key.type === "Identifier"
        ? property.key.name
        : property.key.type === "Literal" && typeof property.key.value === "string"
          ? property.key.value
          : undefined;
    if (key === undefined) return undefined;
    const start = expression.span.start + property.value.start;
    const end = expression.span.start + property.value.end;
    entries.push({
      key,
      value: {
        code: expression.code.slice(property.value.start, property.value.end),
        span: { start, end },
        refs: expression.refs
          .filter((ref) => ref.span.start >= start && ref.span.end <= end)
          .map((ref) => {
            if (ref.kind !== "Binding" || !ref.shorthand) return ref;
            const { shorthand: _shorthand, ...rest } = ref;
            return rest;
          }),
      },
    });
  }
  return entries;
}

/** An item's one-line form. */
function inlineText(item: Item): string {
  switch (item.kind) {
    case "inline":
      return item.text;
    case "element": {
      const open = `<${item.tag}${item.attributes.map(({ text }) => ` ${text}`).join("")}${item.end}`;
      const text = `${open}${item.children.map(inlineText).join("")}${item.close}`;
      return item.region ? `${item.region.open}${text}${item.region.close}` : text;
    }
    case "block":
      return `${item.segments
        .map((segment) => `${segment.open}${segment.children.map(inlineText).join("")}`)
        .join("")}${item.close}`;
    default:
      return unreachable(item);
  }
}

const inline = (text: string): InlineItem => ({ kind: "inline", text });

const isInline = (item: Item) => item.kind === "inline";

/** Elements of block level, wrappers and blocks start lines even where whitespace is kept. */
const isBlockLevel = (item: Item) =>
  item.kind === "block" || (item.kind === "element" && item.blockLevel);

/** The name an attribute is printed and ordered by. */
function attributeName(attribute: Attribute): string {
  switch (attribute.kind) {
    case "Static":
    case "Bound":
      return attribute.name;
    case "Class":
      return "class";
    case "Style":
      return "style";
    case "Spread":
      return "";
    // A listener orders as Vue's `@event`, which `vue/attributes-order` puts last.
    case "Event":
      return `@${attribute.event}`;
    case "Ref":
      return "ref";
    // Not printed yet, as composition's nodes.
    case "Model":
      return "v-model";
    default:
      return unreachable(attribute);
  }
}

/**
 * Joins two sibling runs with no whitespace between them, for a compiler that would keep it:
 * the line breaks inside the tag that ends the first run (`</li\n  ><li>`), as whitespace inside
 * a tag is never content. A closing `/>` alone on its line takes the next run after it, and so
 * does a block's closing (`{/if}`), which has no inside to break in.
 */
function glue(lines: string[], next: string[]): string[] {
  const last = lines.at(-1)!;
  const [first, ...more] = next;
  const start = first!.trimStart();
  if (!last.endsWith(">")) return [...lines.slice(0, -1), `${last}${start}`, ...more];
  const closer = last.endsWith("/>") ? "/>" : ">";
  const before = last.slice(0, -closer.length);
  const rest = before.trimEnd();
  if (rest === "") return [...lines.slice(0, -1), `${before}${closer}${start}`, ...more];
  const pad = first!.slice(0, first!.length - start.length);
  return [...lines.slice(0, -1), rest, `${pad}${closer}${start}`, ...more];
}

/** The `never` default of an exhaustive switch. */
export function unreachable(value: never): never {
  throw new Error(`Unexpected IR value: ${JSON.stringify(value)}`);
}
