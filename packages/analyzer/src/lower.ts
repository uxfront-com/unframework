// The returned JSX, lowered to the IR's render tree (ADR-0036, design §1.3): elements, text,
// expressions rendered as text, conditionals and lists. Children are read in order; text that
// ends up side by side (across comments, nothing-children and fragments) is one text, as the DOM
// has it. Constructs outside the subset, and markup the targets would render differently, are
// reported and left out, so one problem never hides the next.

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
import type { RenderContext } from "./render.ts";
import { describe, outside } from "./types/kinds.ts";

/** Where nodes are lowered: the open elements around them, the parent last. */
export interface Place {
  readonly ancestors: readonly OpenElement[];
  /** The namespace of the nodes here: an `<svg>` and everything inside it are SVG. */
  readonly namespace: Namespace;
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
 * Each lowered child list with the children that were reported and left out in their places:
 * which text comes first is read from what the source writes, so a fix that lets a reported
 * child lower changes no other diagnostic.
 */
const SLOTS = new WeakMap<readonly RenderNode[], readonly (RenderNode | undefined)[]>();

/**
 * A child list being collected: texts side by side are joined into one when something else is
 * added, or the list ends, and checked where they sit then.
 */
class Children {
  readonly nodes: RenderNode[] = [];
  /** Whether a child binds anything, as written (`LoweredElement.binds`). */
  binds = false;
  /** The nodes, and `undefined` where a child was reported and left out. */
  readonly #slots: (RenderNode | undefined)[] = [];
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
    if (!placed || parts.some((part) => !part.lowered)) return;
    const text = createText(value, at);
    PARTS.set(text, parts);
    this.nodes.push(text);
    this.#slots.push(text);
  }

  /** Adds a node, or marks the place of one that was reported and left out. */
  node(node: RenderNode | undefined): void {
    this.flush();
    if (node) this.nodes.push(node);
    this.#slots.push(node);
  }

  /**
   * Adds what may render nothing at all (a conditional whose branches are all empty), which a
   * run of text then continues across. Its diagnostics stay after the text's before it.
   */
  maybe(lower: () => RenderNode | undefined): void {
    const { reporter } = this.#render;
    const mark = reporter.diagnostics.length;
    const node = lower();
    if (!node && !reporter.hasErrorsSince(mark)) return;
    const later = reporter.diagnostics.splice(mark);
    this.flush();
    reporter.diagnostics.push(...later);
    if (node) this.nodes.push(node);
    this.#slots.push(node);
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
 * Lowers an expression child (design §1.3): nothing, text, a conditional, a list, the children
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
        reporter.report(
          "UF3025",
          expression,
          `\`${expression.operator}\` renders its left side's value or the JSX on its right, which no template target can write as one conditional.`,
          { help: "Write the conditional with `?:`, such as `value ? value : <p>None</p>`." },
        );
        checkExpression(expression.left, render);
        lowerBranch(expression.right, place, render);
        children.node(undefined);
        return;
      }
      break;
    case "CallExpression":
      if (isList(expression)) {
        children.flush();
        children.binds = true;
        children.node(lowerList(expression, place, render));
        return;
      }
      break;
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

/** Whether a call is `source.map(callback)` whose callback holds JSX: a list (ADR-0036). */
function isList(node: AST.CallExpression): boolean {
  const { callee } = node;
  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.property.type === "Identifier" &&
    callee.property.name === "map" &&
    node.arguments.some((argument) => containsJsx(argument))
  );
}

/** Lowers what a branch of a conditional renders, as a child list of its own. */
function lowerBranch(
  expression: AST.Expression,
  place: Place,
  render: RenderContext,
): RenderNode[] {
  const children = new Children(place, render);
  lowerChild(expression, span(expression), children, place, render);
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
): IfNode | undefined {
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
  while (branches.length && !branches.at(-1)!.children.length) branches.pop();
  if (!branches.length) return undefined;
  const problem = textPlacementProblem(place, render);
  if (problem) {
    const textarea = place.namespace === "html" && place.ancestors.at(-1)?.tag === "textarea";
    const text = branches.some((branch) =>
      branch.children.some((child) => child.kind === "Text" && !isWhitespaceText(child.value)),
    );
    if (textarea || text) {
      problem("A conditional that renders text", span(node));
      return undefined;
    }
  }
  return createIf(branches, span(node));
}

/**
 * Where text that an expression renders cannot sit (design §1.3): a returned report function
 * that reports it there, or `undefined`. Text the parser moves (a table part) or drops (a
 * `<select>`) is UF3003; a `<textarea>`'s content is its value, form state that lands in M3
 * (UF1002); SVG renders text only in its text elements (UF3003).
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
        : "Render it in an <option>.",
      related,
    });
}

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
 * Checks where a text sits (design §1.3): in a table part the parser moves it out (UF3003);
 * whitespace that Svelte drops (in a `<select>`, a `<datalist>`, a table part, or SVG outside a
 * `<text>`) is UF3003 with a fix that removes it. Returns whether the text can be lowered there.
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
  // Whitespace there renders nothing, so removing it is safe, unless a fix for a divergence
  // in it (`&#9;`) edits it already.
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
    reporter.report(
      "UF3003",
      at,
      `Text that is only whitespace cannot be inside an SVG <${parent.tag}>: Svelte's compiler drops it outside a <text>, and the other targets keep it.`,
      removal("Remove it, or put the elements on lines of their own, where JSX drops it."),
    );
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
 * start the element directly or in the first branch of a conditional.
 */
function checkLeadingLineFeed(
  tag: string,
  children: readonly RenderNode[],
  render: RenderContext,
): void {
  for (const text of leadingTexts(children)) {
    if (!text.value.startsWith("\n")) continue;
    const first = PARTS.get(text)?.find((part) => part.value !== "") ?? { span: text.span };
    render.reporter.report(
      "UF3017",
      first.span,
      `This text starts with a line feed, which the HTML parser drops at the start of a <${tag}>, and React's server renderer writes twice.`,
      { help: "Start the text with something other than a line feed." },
    );
  }
}

/** The texts that can start a child list: its first child, or a branch's, through ifs. */
function leadingTexts(children: readonly RenderNode[]): TextNode[] {
  const first = (SLOTS.get(children) ?? children)[0];
  if (first?.kind === "Text") return [first];
  if (first?.kind !== "If") return [];
  return first.branches.flatMap((branch) => leadingTexts(branch.children));
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
