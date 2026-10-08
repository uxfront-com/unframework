// The returned JSX, lowered to the IR's render tree (ADR-0036): elements, text,
// expressions rendered as text, conditionals and lists. Children are read in order; text that
// ends up side by side (across comments, nothing-children and fragments) is one text, as the DOM
// has it. Constructs outside the subset, and markup the targets would render differently, are
// reported and left out, so one problem never hides the next.

import type { Fix } from "@unframework/diagnostics";
import {
  createElement,
  createIf,
  createInterpolation,
  createBranch,
  createText,
  elementNamespace,
  isVoidElement,
  isWhitespaceText,
  LEADING_LINE_FEED_ELEMENTS,
  RAW_TEXT_ELEMENTS,
  SVG_TEXT_ELEMENTS,
  SVG_WHITESPACE_KEEPING_ELEMENT,
  TEXTLESS_ELEMENTS,
  UNINTERPOLATED_ELEMENTS,
  WHITESPACE_DROPPING_ELEMENTS,
} from "@unframework/ir";
import type {
  ElementNode,
  IfBranch,
  IfNode,
  Namespace,
  RenderNode,
  Span,
  TextNode,
} from "@unframework/ir";
import type { AST } from "@unframework/parser";
import { visitorKeys } from "@unframework/parser";

import { lowerAttributes } from "./attributes.ts";
import { unportableCharacters } from "./characters.ts";
import { reportCharacter, reportDivergence, reportHtmlOnlyReference } from "./context.ts";
import { checkPlacement, checkTag } from "./elements.ts";
import type { OpenElement } from "./elements.ts";
import { checkExpression, span } from "./expressions.ts";
import { htmlOnlyReferences, readJsxText } from "./jsx/text.ts";
import { lowerList } from "./lists.ts";
import { isStaticString, reportCharacters, valueOf } from "./literals.ts";
import { referencePath } from "./narrowing.ts";
import type { RenderContext } from "./render.ts";
import { describe, has, mayBeNullish, outside } from "./types/kinds.ts";
import type { Kinds } from "./types/kinds.ts";

/** Where nodes are lowered: the open elements around them, the parent last. */
export interface Place {
  readonly ancestors: readonly OpenElement[];
  /** The namespace of the nodes here: an `<svg>` and everything inside it are SVG. */
  readonly namespace: Namespace;
  /** Whether the nodes here start a conditional's branch, which Solid creates on its own. */
  readonly branch?: boolean;
}

/** The place at a component's root. */
export const ROOT: Place = { ancestors: [], namespace: "html" };

/** An element lowered, and the `key` a list lifts off it. */
export interface LoweredElement {
  element: ElementNode | undefined;
  key: AST.JSXAttribute | undefined;
  /**
   * Whether the element or anything inside it binds (a binding, an expression, a conditional,
   * a list), as written: what Angular's static literal region cannot hold.
   */
  binds: boolean;
}

/**
 * Lowers a JSX element to an IR element, or reports why it cannot be. `listBody` marks the
 * element a list's `.map` renders, whose `key` the list lifts.
 */
export function lowerElement(
  node: AST.JSXElement,
  place: Place,
  render: RenderContext,
  listBody = false,
): LoweredElement {
  const { reporter } = render;
  const name = node.openingElement.name;
  if (name.type !== "JSXIdentifier") {
    reporter.unsupported(
      name,
      name.type === "JSXNamespacedName"
        ? "Namespaced elements are not supported yet."
        : "Member-expression components are not supported yet.",
    );
    return { element: undefined, key: undefined, binds: true };
  }
  if (/^[A-Z]/.test(name.name)) {
    reporter.unsupported(name, `Child components such as <${name.name}> are not supported yet.`);
    return { element: undefined, key: undefined, binds: true };
  }
  const check = checkTag(node, name, place.namespace, place.ancestors.length === 0, reporter);
  if (!check.as) {
    // Nothing to check the element as; its children are still checked, inside it, unless they
    // are in a language the analyser does not check.
    if (!check.foreign) {
      lowerChildren(node.children, inside(place, name.name, name, place.namespace), render);
    }
    return { element: undefined, key: undefined, binds: true };
  }
  const tag = check.as;
  const namespace = elementNamespace(tag, place.namespace);
  checkPlacement(tag, name, place.ancestors, reporter);
  if (namespace === "svg" && tag === "title" && (listBody || place.branch)) {
    // dom-expressions creates a branch's or a list's element from a template of its own, in SVG
    // only for the tags it knows as SVG's, and leaves out `title`, which HTML has too.
    reporter.unsupported(
      name,
      `An SVG <title> that starts ${listBody ? "a list's element" : "a conditional's branch"} is not supported yet: Solid creates it in HTML's namespace, where it titles nothing.`,
      {
        help: "Wrap it in a <g>, which Solid creates in SVG with what it holds, or render it always.",
      },
    );
  }
  const content = hasContent(node.children);
  const { attributes, key, binds, braces } = lowerAttributes(node.openingElement, {
    tag,
    namespace,
    hasChildren: content,
    listBody,
    render,
  });
  let children: RenderNode[] = [];
  let childrenBind = false;
  if (namespace === "svg" || !isVoidElement(tag)) {
    const list = new Children(inside(place, tag, name, namespace), render);
    collect(node.children, list, inside(place, tag, name, namespace), render);
    children = list.finish();
    childrenBind = list.binds;
    if (namespace === "html" && LEADING_LINE_FEED_ELEMENTS.has(tag)) {
      checkLeadingLineFeed(tag, children, render);
    }
  } else if (content) {
    reporter.report("UF3003", name, `<${tag}> is a void element, so it cannot have children.`, {
      help: `Write it as \`<${tag} />\`, and move the children after it.`,
    });
  }
  // Angular writes an attribute holding `{{` in an `ngNonBindable` region, where nothing binds.
  if (braces && (binds || childrenBind)) {
    reporter.unsupported(
      braces.name,
      "An element whose static attribute holds `{{` cannot bind anything yet, in itself or inside it: Angular writes it in an `ngNonBindable` region, which binds nothing (ADR-0037).",
      { help: "Move the bindings out of the element, or the `{{` out of the attribute." },
    );
  }
  const result = { key, binds: binds || childrenBind };
  if (!check.accepted) return { element: undefined, ...result };
  return { element: createElement(tag, attributes, children, span(node)), ...result };
}

/** The place inside an element. */
function inside(place: Place, tag: string, name: Span, namespace: Namespace): Place {
  return { ancestors: [...place.ancestors, { tag, name: span(name), namespace }], namespace };
}

/** A text being collected: the readings of the JSX texts and string literals it joins. */
interface TextPart {
  value: string;
  /** Where the text is written: the JSX text, or the string literal. */
  span: Span;
  /** What removing it removes: the JSX text, or the braces around the string. */
  container: Span;
  /** Whether it can be lowered: every JSX implementation reads it alike, HTML keeps it. */
  lowered: boolean;
  /** Whether a fix of a divergence edits it already. */
  edited: boolean;
}

/** The pieces each lowered text was joined from, for the checks that point into them. */
const PARTS = new WeakMap<TextNode, readonly TextPart[]>();

/**
 * A child that was reported and left out, in its place: whether it can render nothing, as what
 * it would lower to once fixed can (a list, a conditional without an else).
 */
interface LeftOut {
  readonly kind: "LeftOut";
  readonly empty: boolean;
}

/** A place in a child list: a lowered node, or a child left out there. */
type Slot = RenderNode | LeftOut;

/**
 * Each lowered child list with the children that were reported and left out in their places:
 * which text can come first is read from what the source writes, so a fix that lets a reported
 * child lower changes no other diagnostic.
 */
const SLOTS = new WeakMap<readonly RenderNode[], readonly Slot[]>();

/**
 * Whether each conditional can render nothing, as the source writes it: the branches whose
 * content was all reported, and the empty ones at its end, are dropped from the If, and would
 * not be once fixed.
 */
const CAN_BE_EMPTY = new WeakMap<IfNode, boolean>();

/**
 * A child list being collected: texts side by side are joined into one when something else is
 * added, or the list ends, and checked where they sit then.
 */
class Children {
  readonly nodes: RenderNode[] = [];
  /** Whether a child binds anything, as written (`LoweredElement.binds`). */
  binds = false;
  /** The nodes, and where each child that was reported and left out sits. */
  readonly #slots: Slot[] = [];
  #pending: TextPart[] = [];
  readonly #place: Place;
  readonly #render: RenderContext;

  constructor(place: Place, render: RenderContext) {
    this.#place = place;
    this.#render = render;
  }

  text(part: TextPart): void {
    this.#pending.push(part);
  }

  /** Ends the text being collected: what comes next is not text. */
  flush(): void {
    const parts = this.#pending;
    this.#pending = [];
    if (!parts.length) return;
    const value = parts.map((part) => part.value).join("");
    if (!value) return;
    const at = { start: parts[0]!.container.start, end: parts.at(-1)!.container.end };
    const placed = checkTextPlacement(value, at, parts, this.#place, this.#render);
    if (!placed || parts.some((part) => !part.lowered)) {
      this.#slots.push({ kind: "LeftOut", empty: false });
      return;
    }
    const text = createText(value, at);
    PARTS.set(text, parts);
    this.nodes.push(text);
    this.#slots.push(text);
  }

  /**
   * Adds a node, or marks the place of one that was reported and left out, which `empty` says
   * can render nothing once lowered.
   */
  node(node: RenderNode | undefined, empty = false): void {
    this.flush();
    if (node) this.nodes.push(node);
    this.#slots.push(node ?? { kind: "LeftOut", empty });
  }

  /**
   * Adds what may render nothing at all (a conditional whose branches are all empty), which a
   * run of text then continues across. Its diagnostics stay after the text's before it.
   */
  maybe(lower: () => { node: RenderNode | undefined; empty: boolean }): void {
    const { reporter } = this.#render;
    const mark = reporter.diagnostics.length;
    const { node, empty } = lower();
    if (!node && !reporter.hasErrorsSince(mark)) return;
    const later = reporter.diagnostics.splice(mark);
    this.flush();
    reporter.diagnostics.push(...later);
    if (node) this.nodes.push(node);
    this.#slots.push(node ?? { kind: "LeftOut", empty });
  }

  finish(): RenderNode[] {
    this.flush();
    SLOTS.set(this.nodes, this.#slots);
    return this.nodes;
  }
}

/** Lowers JSX children in a place. */
export function lowerChildren(
  items: readonly AST.JSXChild[],
  place: Place,
  render: RenderContext,
): RenderNode[] {
  const children = new Children(place, render);
  collect(items, children, place, render);
  return children.finish();
}

function collect(
  items: readonly AST.JSXChild[],
  children: Children,
  place: Place,
  render: RenderContext,
): void {
  const { reporter } = render;
  for (const item of items) {
    switch (item.type) {
      case "JSXText": {
        const reading = readJsxText(item.value);
        const checked = checkJsxText(item, reading, render);
        if (reading.value) {
          children.text({
            value: reading.value,
            span: span(item),
            container: span(item),
            lowered: checked.lowered,
            edited: checked.edited,
          });
        }
        break;
      }
      case "JSXExpressionContainer":
        if (item.expression.type !== "JSXEmptyExpression") {
          lowerChild(item.expression, span(item), children, place, render);
        }
        break;
      case "JSXElement": {
        children.flush();
        const lowered = lowerElement(item, place, render);
        if (lowered.binds) children.binds = true;
        children.node(lowered.element);
        break;
      }
      case "JSXFragment":
        collect(item.children, children, place, render);
        break;
      case "JSXSpreadChild":
        children.flush();
        children.binds = true;
        reporter.unsupported(item, "Spread children (`{...children}`) are not supported yet.");
        children.node(undefined);
        break;
    }
  }
}

/**
 * Lowers an expression child (ADR-0036): nothing, text, a conditional, a list, the children
 * of a fragment or an element, or an expression rendered as text. `at` is where it is written:
 * the braces around a child, or the branch itself.
 */
function lowerChild(
  expression: AST.Expression,
  at: Span,
  children: Children,
  place: Place,
  render: RenderContext,
): void {
  const { reporter, source } = render;
  if (isStaticString(expression)) {
    const value = valueOf(expression);
    const reported = reportCharacters(expression, source, reporter);
    if (value) {
      children.text({
        value,
        span: span(expression),
        container: at,
        lowered: !reported,
        edited: false,
      });
    }
    return;
  }
  if (
    (expression.type === "Literal" && expression.value === null) ||
    (expression.type === "Identifier" && expression.name === "undefined")
  ) {
    return;
  }
  if (expression.type === "Literal" && typeof expression.value === "boolean") {
    reporter.report(
      "UF3016",
      expression,
      `\`{${expression.value}}\` renders nothing in JSX, and \`${expression.value}\` in Vue's, Svelte's and Angular's templates.`,
      { help: "Remove it." },
    );
    return;
  }
  switch (expression.type) {
    case "JSXElement": {
      children.flush();
      const lowered = lowerElement(expression, place, render);
      if (lowered.binds) children.binds = true;
      children.node(lowered.element);
      return;
    }
    case "JSXFragment":
      collect(expression.children, children, place, render);
      return;
    case "ConditionalExpression":
      if (containsJsx(expression.consequent) || containsJsx(expression.alternate)) {
        children.binds = true;
        children.maybe(() => lowerIf(expression, place, render));
        return;
      }
      break;
    case "LogicalExpression":
      if (expression.operator === "&&") {
        children.binds = true;
        children.maybe(() => lowerIf(expression, place, render));
        return;
      }
      if (containsJsx(expression.right) || containsJsx(expression.left)) {
        children.flush();
        children.binds = true;
        const mark = reporter.diagnostics.length;
        const left = checkExpression(expression.left, render);
        const checks = reporter.diagnostics.splice(mark);
        const nullish = expression.operator === "??";
        reporter.report(
          "UF3025",
          expression,
          `\`${expression.operator}\` renders its left side's value or the JSX on its right, which no template target can write as one conditional.`,
          {
            help: nullish
              ? 'Write the conditional with `?:` and `!= null`, such as `value != null ? value : <p>None</p>`, which renders `0` and `""` as `??` does.'
              : "Write the conditional with `?:`, such as `value ? value : <p>None</p>`.",
            ...(left.clean && !textPlacementProblem(place, render)
              ? { fixes: conditionalFix(expression, left.kinds, render) }
              : {}),
          },
        );
        reporter.diagnostics.push(...checks);
        lowerBranch(expression.right, place, render);
        children.node(undefined);
        return;
      }
      break;
    case "CallExpression":
    case "ChainExpression": {
      const list = listCall(expression);
      if (list) {
        children.flush();
        children.binds = true;
        // A list renders elements or nothing, as it would once a fix lets it lower.
        children.node(lowerList(list, place, render), true);
        return;
      }
      break;
    }
  }
  children.flush();
  children.binds = true;
  const checked = checkExpression(expression, render);
  let node: RenderNode | undefined;
  const problem = textPlacementProblem(place, render);
  const kinds = outside(checked.kinds, ["string", "number", "null", "undefined"]);
  if (kinds.length) {
    reporter.report(
      "UF3016",
      expression,
      `An expression child renders text, and this one can be ${describe(kinds)}, which the targets render differently.`,
      {
        help: kinds.includes("boolean")
          ? 'Turn it into text: `value ? "Yes" : "No"`, or render an element with `value && <span>…</span>`.'
          : kinds.includes("array")
            ? 'Join it into text (`items.join(", ")`), or render each item with `.map`.'
            : "Render one of its members, or turn it into text.",
      },
    );
  }
  if (problem) problem("An expression", at);
  if (!kinds.length && !problem && checked.clean)
    node = createInterpolation(checked.expression, at);
  children.node(node);
}

/**
 * The fix of `x || <B />` and `x ?? <B />` (UF3025): the conditional `x ? x : <B />`, or
 * `x != null ? x : <B />`, which renders as they do where `x` is a reference, read twice alike,
 * that renders as text (a string or a number) where it is there. None otherwise.
 */
function conditionalFix(
  expression: AST.LogicalExpression,
  kinds: Kinds,
  render: RenderContext,
): Fix[] {
  const { left, right, operator } = expression;
  const { source } = render;
  const between = { start: left.end, end: right.start };
  const reference =
    (left.type === "Identifier" || left.type === "MemberExpression") &&
    referencePath(left, render) !== undefined;
  const text =
    mayBeNullish(kinds) &&
    outside(kinds, ["string", "number", "null", "undefined"]).length === 0 &&
    (has(kinds, "string") || has(kinds, "number"));
  if (
    !reference ||
    !text ||
    source.slice(between.start, between.end).trim() !== operator ||
    render.comments.some((comment) => comment.start >= between.start && comment.end <= between.end)
  ) {
    return [];
  }
  const value = source.slice(left.start, left.end);
  const test = operator === "??" ? " != null ?" : " ?";
  return [
    {
      title: `Write \`${value}${test} ${value} : …\``,
      confidence: "safe",
      edits: [{ span: between, text: `${test} ${value} : ` }],
    },
  ];
}

/** Whether an expression holds JSX anywhere in it. */
export function containsJsx(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  if (Array.isArray(node)) return node.some(containsJsx);
  const type = (node as { type?: string }).type ?? "";
  if (type === "JSXElement" || type === "JSXFragment") return true;
  return (visitorKeys[type] ?? []).some((key) =>
    containsJsx((node as Record<string, unknown>)[key]),
  );
}

/**
 * The call of a list (ADR-0036), `source.map(callback)` whose callback holds JSX, or
 * `undefined`. `source?.map(…)` is one too, which oxc wraps in a ChainExpression: the list
 * reports its `?.`, which only a nullable source needs, and a list cannot render.
 */
function listCall(node: AST.CallExpression | AST.ChainExpression): AST.CallExpression | undefined {
  const call = node.type === "ChainExpression" ? node.expression : node;
  if (call.type !== "CallExpression") return undefined;
  const { callee } = call;
  return callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.property.type === "Identifier" &&
    callee.property.name === "map" &&
    call.arguments.some((argument) => containsJsx(argument))
    ? call
    : undefined;
}

/** Lowers what a branch of a conditional renders, as a child list of its own. */
function lowerBranch(
  expression: AST.Expression,
  place: Place,
  render: RenderContext,
): RenderNode[] {
  const at: Place = { ...place, branch: true };
  const children = new Children(at, render);
  lowerChild(expression, span(expression), children, at, render);
  return children.finish();
}

/**
 * Lowers a conditional child to an If (ADR-0036): `c && X`, or a `?:` chain whose branches hold
 * JSX, with every `d ? … : …` or `d && …` holding JSX in the last branch extending it as an else
 * if. Empty branches at the end render nothing and are dropped; an If with nothing in any
 * branch is dropped whole.
 */
function lowerIf(
  node: AST.ConditionalExpression | AST.LogicalExpression,
  place: Place,
  render: RenderContext,
): { node: IfNode | undefined; empty: boolean } {
  const branches: IfBranch[] = [];
  let current: AST.Expression = node;
  for (;;) {
    if (current.type === "LogicalExpression" && current.operator === "&&") {
      const condition = checkExpression(current.left, render);
      const children = lowerBranch(current.right, place, render);
      branches.push(createBranch(condition.expression, children, span(current)));
      break;
    }
    if (current.type !== "ConditionalExpression") break;
    const condition = checkExpression(current.test, render);
    const children = lowerBranch(current.consequent, place, render);
    branches.push(
      createBranch(condition.expression, children, {
        start: current.start,
        end: current.consequent.end,
      }),
    );
    const next: AST.Expression = current.alternate;
    if (
      (next.type === "ConditionalExpression" ||
        (next.type === "LogicalExpression" && next.operator === "&&")) &&
      containsJsx(next)
    ) {
      current = next;
      continue;
    }
    branches.push(createBranch(undefined, lowerBranch(next, place, render), span(next)));
    break;
  }
  // Without an else, or with a branch that can render nothing, it can render nothing, read
  // before the empty branches at its end are dropped.
  const empty =
    branches.at(-1)!.condition !== undefined ||
    branches.some((branch) => leading(branch.children).empty);
  while (branches.length && !branches.at(-1)!.children.length) branches.pop();
  if (!branches.length) return { node: undefined, empty };
  const problem = textPlacementProblem(place, render);
  if (problem) {
    // A <textarea>'s and a raw-text element's content is text, where the comments that mark a
    // conditional render as text too.
    const parent = place.namespace === "html" ? place.ancestors.at(-1)?.tag : undefined;
    const textContent = parent === "textarea" || RAW_TEXT_ELEMENTS.has(parent ?? "");
    const text = branches.some((branch) =>
      branch.children.some((child) => child.kind === "Text" && !isWhitespaceText(child.value)),
    );
    if (textContent || text) {
      problem(text ? "A conditional that renders text" : "A conditional", span(node));
      return { node: undefined, empty };
    }
  }
  const lowered = createIf(branches, span(node));
  CAN_BE_EMPTY.set(lowered, empty);
  return { node: lowered, empty };
}

/**
 * Where text that an expression renders cannot sit (ADR-0036): a returned report function
 * that reports it there, or `undefined`. Text the parser moves (a table part), drops (a
 * `<select>`) or reads as raw text (an `<iframe>`) is UF3003; a `<textarea>`'s content is its
 * value, form state that lands in M3 (UF1002); SVG renders text only in its text elements
 * (UF3003).
 */
export function textPlacementProblem(
  place: Place,
  render: RenderContext,
): ((what: string, at: Span) => void) | undefined {
  const parent = place.ancestors.at(-1);
  if (!parent) return undefined;
  const { reporter } = render;
  const related = [{ span: parent.name, message: `The <${parent.tag}>` }];
  if (place.namespace === "svg") {
    if (SVG_TEXT_ELEMENTS.has(parent.tag)) return undefined;
    return (what, at) =>
      reporter.report(
        "UF3003",
        at,
        `${what} cannot be inside an SVG <${parent.tag}>: SVG renders text only in <text>, <tspan>, <textPath>, <title> and <desc>.`,
        { help: "Render the text in a <text> element.", related },
      );
  }
  const reason = UNINTERPOLATED_ELEMENTS.get(parent.tag);
  if (!reason) return undefined;
  if (parent.tag === "textarea") {
    return (what, at) =>
      reporter.unsupported(at, `${what} cannot be inside a <textarea> yet: ${reason}`);
  }
  return (what, at) =>
    reporter.report("UF3003", at, `${what} cannot be inside <${parent.tag}>: ${reason}`, {
      help: TEXTLESS_ELEMENTS.has(parent.tag)
        ? "Put it in a cell, or in a <caption>."
        : RAW_TEXT_ELEMENTS.has(parent.tag)
          ? RAW_TEXT_HELP
          : "Render it in an <option>.",
      related,
    });
}

/** What to do with the content of a raw-text element, which a browser never shows. */
const RAW_TEXT_HELP = "Remove it: a browser shows an <iframe>'s document, never its content.";

/**
 * Checks a JSX text: every JSX implementation must read it the same way (UF3009), and HTML must
 * keep its characters (UF3010). Babel's reading is checked even where the implementations
 * disagree, so the fixes for the disagreement reveal no new problem. A reference only HTML
 * decodes is a warning (UF3011): the text is lowered as JSX reads it.
 */
function checkJsxText(
  item: AST.JSXText,
  reading: ReturnType<typeof readJsxText>,
  render: RenderContext,
): { lowered: boolean; edited: boolean } {
  const { reporter } = render;
  const at = (range: { start: number; end: number }) => ({
    start: item.start + range.start,
    end: item.start + range.end,
  });
  for (const divergence of reading.divergences) reportDivergence(divergence, at, reporter);
  for (const reference of htmlOnlyReferences(item.value)) {
    // Its numeric reference reads alike everywhere, except as a tab or a line break, which
    // Babel reads as whitespace (UF3009); and where the text is read differently already, the
    // divergence's message would change with it.
    const fixable =
      !reading.divergences.length && reference.value !== "\t" && reference.value !== "\n";
    reportHtmlOnlyReference(reference, at, fixable, reporter);
  }
  const characters = unportableCharacters(item.value, reading.kept, reading.divergences);
  for (const character of characters) reportCharacter(character, at, reporter);
  return {
    lowered: !reading.divergences.length && !characters.length,
    edited: reading.divergences.length > 0,
  };
}

/**
 * Checks where a text sits (ADR-0036): in a table part the parser moves it out, and in an
 * `<iframe>` it reads it as raw text (UF3003); whitespace that Svelte drops (in a `<select>`, a
 * `<datalist>`, a table part, or SVG outside a `<text>`) is UF3003 with a fix that removes it.
 * Returns whether the text can be lowered there.
 */
function checkTextPlacement(
  value: string,
  at: Span,
  parts: readonly TextPart[],
  place: Place,
  render: RenderContext,
): boolean {
  const parent = place.ancestors.at(-1);
  if (!parent) return true;
  const { reporter } = render;
  const related = [{ span: parent.name, message: `The <${parent.tag}>` }];
  const whitespace = isWhitespaceText(value);
  // Whitespace between elements renders nothing, so removing it is safe, unless a fix for a
  // divergence in it (`&#9;`) edits it already. In an SVG `<title>` or `<desc>`, whose text is
  // an accessible name or description, it may separate two values, and stays.
  const removal = (help: string) => ({
    help,
    fixes: parts.some((part) => part.edited)
      ? []
      : [
          {
            title: "Remove the whitespace",
            confidence: "safe" as const,
            edits: parts.map((part) => ({ span: part.container, text: "" })),
          },
        ],
    related,
  });
  if (place.namespace === "svg") {
    if (
      !whitespace ||
      place.ancestors.some(
        (ancestor) =>
          ancestor.tag === SVG_WHITESPACE_KEEPING_ELEMENT && ancestor.namespace === "svg",
      )
    ) {
      return true;
    }
    const message = `Text that is only whitespace cannot be inside an SVG <${parent.tag}>: Svelte's compiler drops it outside a <text>, and the other targets keep it.`;
    if (SVG_TEXT_ELEMENTS.has(parent.tag)) {
      reporter.report("UF3003", at, message, {
        help: "Write the values and the space between them as one expression, as in {`${name} ${status}`}, whose text Svelte keeps.",
        related,
      });
    } else {
      reporter.report(
        "UF3003",
        at,
        message,
        removal("Remove it, or put the elements on lines of their own, where JSX drops it."),
      );
    }
    return false;
  }
  if (TEXTLESS_ELEMENTS.has(parent.tag)) {
    // The parser keeps whitespace in a table where it is, and moves any other text before it.
    if (whitespace) {
      reporter.report(
        "UF3003",
        at,
        `Text cannot be inside <${parent.tag}>, not even whitespace: React reports it as a hydration error, and Svelte's compiler drops it.`,
        removal("Remove it, or put the children on lines of their own, where JSX drops it."),
      );
    } else {
      reporter.report(
        "UF3003",
        at,
        `Text cannot be inside <${parent.tag}>: the browser moves it out of the table.`,
        { help: "Put it in a cell, or in a <caption>.", related },
      );
    }
    return false;
  }
  // The servers' escapes stay as written in raw text, and React's `<!-- -->` between texts
  // (`checkInvariants` rejects it too). Whitespace reads alike.
  if (RAW_TEXT_ELEMENTS.has(parent.tag) && !whitespace) {
    reporter.report(
      "UF3003",
      at,
      `Text cannot be inside <${parent.tag}>: ${UNINTERPOLATED_ELEMENTS.get(parent.tag)!}`,
      { help: RAW_TEXT_HELP, related },
    );
    return false;
  }
  // Svelte's compiler drops it (`checkInvariants` rejects it too).
  if (WHITESPACE_DROPPING_ELEMENTS.has(parent.tag) && whitespace) {
    reporter.report(
      "UF3003",
      at,
      `Text that is only whitespace cannot be inside <${parent.tag}>: Svelte's compiler drops it, and the other targets keep it.`,
      removal("Remove it, or put the options on lines of their own, where JSX drops it."),
    );
    return false;
  }
  return true;
}

/**
 * A line feed that starts the text of a `<pre>`, a `<textarea>` or a `<listing>` (UF3017): the
 * HTML parser drops it, and React's server renderer writes another to keep it. The text can
 * start the element directly, in a branch of a conditional, or after a conditional or a list
 * that renders nothing, where React's and Astro's servers write nothing before it (the other
 * targets write a comment, which keeps it).
 */
function checkLeadingLineFeed(
  tag: string,
  children: readonly RenderNode[],
  render: RenderContext,
): void {
  for (const { text, after } of leading(children).texts) {
    if (!text.value.startsWith("\n")) continue;
    const first = PARTS.get(text)?.find((part) => part.value !== "") ?? { span: text.span };
    render.reporter.report(
      "UF3017",
      first.span,
      after
        ? `This text starts with a line feed, which the HTML parser drops at the start of a <${tag}>: when what comes before it renders nothing, React's and Astro's servers write nothing before it, and the other targets a comment.`
        : `This text starts with a line feed, which the HTML parser drops at the start of a <${tag}>, and React's server renderer writes twice.`,
      { help: "Start the text with something other than a line feed." },
    );
  }
}

/**
 * The texts that can start a child list, read through conditionals and past what can render
 * nothing (a list, a conditional without an else), each with whether it comes after such a
 * node; and whether the list can render nothing.
 */
function leading(
  children: readonly RenderNode[],
  after = false,
): { texts: { text: TextNode; after: boolean }[]; empty: boolean } {
  const texts: { text: TextNode; after: boolean }[] = [];
  for (const slot of SLOTS.get(children) ?? children) {
    if (slot.kind === "Text") {
      texts.push({ text: slot, after });
      return { texts, empty: false };
    }
    // A list's body is an element: it renders elements, or nothing.
    if (slot.kind === "For" || (slot.kind === "LeftOut" && slot.empty)) {
      after = true;
      continue;
    }
    if (slot.kind !== "If") return { texts, empty: false };
    let empty = CAN_BE_EMPTY.get(slot) ?? slot.branches.at(-1)?.condition !== undefined;
    for (const branch of slot.branches) {
      const inner = leading(branch.children, after);
      texts.push(...inner.texts);
      empty ||= inner.empty;
    }
    if (!empty) return { texts, empty: false };
    after = true;
  }
  return { texts, empty: true };
}

/** Whether JSX children have content: an element, an expression, or text some JSX reads. */
export function hasContent(items: readonly AST.JSXChild[]): boolean {
  return items.some((item) => {
    if (item.type !== "JSXText") {
      return (
        item.type !== "JSXExpressionContainer" || item.expression.type !== "JSXEmptyExpression"
      );
    }
    const reading = readJsxText(item.value);
    return reading.value !== "" || reading.divergences.length > 0;
  });
}

/** Lowers a component's returned fragment: its children are the component's roots. */
export function lowerRootChildren(
  node: AST.JSXFragment | AST.Expression,
  render: RenderContext,
): RenderNode[] {
  const children = new Children(ROOT, render);
  if (node.type === "JSXFragment") collect(node.children, children, ROOT, render);
  else lowerChild(node, span(node), children, ROOT, render);
  return children.finish();
}
