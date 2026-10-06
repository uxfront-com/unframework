// Qwik's rule for an SVG `<title>` (ADR-0040). Qwik's JSX types give `<title>`, in SVG as in
// HTML (one intrinsic element), `children` of type `string`: several children, a number, `null`
// or JSX fail L4, though Qwik renders them. So the Qwik output gives a title one child that types
// as `string | undefined`: the child as written where it does, and otherwise one string, a
// template literal or a ternary chain of strings, which renders the same text.
import {
  expressionCode,
  js,
  nullishText,
  Placeholders,
  printExpression,
  textTemplate,
} from "@unframework/codegen";
import type { JsxContext, TextPart } from "@unframework/codegen";
import type {
  ElementNode,
  Expression,
  FragmentNode,
  IfNode,
  RenderNode,
  TextNode,
  UfModule,
} from "@unframework/ir";

import { isTextValue, propReadKinds } from "./values.ts";

/** An expression in the AST (codegen's builders name the node types). */
type JsExpression = Exclude<TextPart, string>;

/** What a title's parts are printed with. */
interface TitleContext {
  readonly jsx: JsxContext;
  readonly module: UfModule;
  readonly placeholders: Placeholders;
}

/** The render tree with each `<title>`'s children as {@link titleChildren} writes them. */
export function qwikTitles(
  root: ElementNode | FragmentNode,
  jsx: JsxContext,
  module: UfModule,
): ElementNode | FragmentNode {
  const element = (node: ElementNode): ElementNode =>
    node.tag === "title"
      ? { ...node, children: titleChildren(node.children, { jsx, module }) }
      : { ...node, children: node.children.map(child) };
  const child = (node: RenderNode): RenderNode => {
    switch (node.kind) {
      case "Element":
        return element(node);
      case "If":
        return {
          ...node,
          branches: node.branches.map((branch) => ({
            ...branch,
            children: branch.children.map(child),
          })),
        };
      case "For":
        return { ...node, body: element(node.body) };
      case "Text":
      case "Interpolation":
        return node;
      default:
        return node satisfies never;
    }
  };
  return root.kind === "Element" ? element(root) : { ...root, children: root.children.map(child) };
}

/**
 * What a title holds in the Qwik output: a text, or an interpolation whose value is a string or
 * `undefined`, as it is; anything else as one value that is. The IR holds no HTML `<title>`
 * (UF3002), and no element or list in an SVG one (ADR-0040's amendment to ADR-0032): the target
 * throws on one rather than drop it (a target that throws is reported by the compiler).
 */
function titleChildren(
  children: readonly RenderNode[],
  options: Omit<TitleContext, "placeholders">,
): RenderNode[] {
  const [only] = children;
  if (!only) return [];
  const context: TitleContext = { ...options, placeholders: new Placeholders() };
  if (children.length === 1 && only.kind === "Text") return [only];
  if (children.length === 1 && only.kind === "Interpolation" && isText(only.value, context)) {
    return [only];
  }
  const value = children.length === 1 ? alone(only, context) : text(children, context, false);
  const span = { start: only.span.start, end: children.at(-1)!.span.end };
  if (typeof value === "string") return value ? [{ kind: "Text", value, span }] : [];
  const code = context.placeholders.print(() => printExpression(value));
  // Printed here, each part spelled by the context: the expression holds no reference for a
  // rewrite to spell again.
  return [{ kind: "Interpolation", value: { code, span, refs: [] }, span }];
}

/**
 * One node as the title's whole value, a string or `undefined`: a conditional as a ternary chain
 * ending in `undefined` (Qwik's `null`, which the title's type does not take), and an
 * interpolation as it is where it is text, as `value ?? ""` where it is text or `null`, and
 * otherwise in a template literal. Its text when nothing in it renders a value.
 */
function alone(node: RenderNode, context: TitleContext): JsExpression | string {
  switch (node.kind) {
    case "If":
      return chain(node, (children) => branchValue(children, context), undefinedValue(), context);
    case "Interpolation": {
      if (isText(node.value, context)) return expression(node.value, context);
      const kinds = propReadKinds(node.value, context.jsx.component, context.module);
      if (kinds && [...kinds].every((kind) => ["string", "null", "undefined"].includes(kind))) {
        const value = expression(node.value, context, "operand");
        return js.logicalExpression("??", value, js.stringLiteral(""));
      }
      return text([node], context, false);
    }
    default:
      return text([node], context, false);
  }
}

/** A branch of a conditional that is the title's whole value: see {@link alone}. */
function branchValue(children: readonly RenderNode[], context: TitleContext): JsExpression {
  const [only] = children;
  if (!only) return undefinedValue();
  const value = children.length === 1 ? alone(only, context) : text(children, context, false);
  return typeof value === "string" ? js.stringLiteral(value) : value;
}

/**
 * Parts as one value: a template literal, which is a string, or their text when nothing in them
 * renders a value. Inside another template literal (`inner`), one part needs none of its own.
 */
function text(
  nodes: readonly RenderNode[],
  context: TitleContext,
  inner: boolean,
): JsExpression | string {
  const parts: TextPart[] = [];
  for (const node of nodes) {
    const value = node.kind === "Text" ? node.value : templatePart(node, context);
    if (value !== undefined) parts.push(value);
  }
  const [only] = parts;
  if (inner && parts.length === 1 && typeof only !== "string") return only!;
  return textTemplate(parts);
}

/**
 * A part of a title's text in a template literal, or `undefined` for an interpolation that
 * always renders nothing (`c ? null : undefined`).
 */
function templatePart(
  node: Exclude<RenderNode, TextNode>,
  context: TitleContext,
): JsExpression | undefined {
  switch (node.kind) {
    case "Interpolation":
      return interpolationPart(node.value, context);
    case "If":
      return chain(
        node,
        (children) => {
          const value = text(children, context, true);
          return typeof value === "string" ? js.stringLiteral(value) : value;
        },
        js.stringLiteral(""),
        context,
      );
    case "Element":
    case "For":
      throw new Error(
        `An SVG <title> holds only text, and the IR's invariants rule out an ${node.kind} in one.`,
      );
    default:
      return node satisfies never;
  }
}

/**
 * An interpolation in a template literal, where `null` and `undefined` must render nothing as
 * on every target (ADR-0037) and not `undefined`: `nullishText` guards it where TypeScript
 * allows. A prop whose declared type is never nullish needs no guard.
 */
function interpolationPart(value: Expression, context: TitleContext): JsExpression | undefined {
  const kinds = propReadKinds(value, context.jsx.component, context.module);
  if (kinds && !kinds.has("null") && !kinds.has("undefined") && !kinds.has("other")) {
    return expression(value, context);
  }
  return nullishText(expressionCode(value, context.jsx), context.placeholders);
}

/** A conditional as a ternary chain: each branch's value, then `otherwise` if none renders. */
function chain(
  node: IfNode,
  value: (children: readonly RenderNode[]) => JsExpression,
  otherwise: JsExpression,
  context: TitleContext,
): JsExpression {
  const branches = [...node.branches];
  const last = branches.at(-1);
  let result = otherwise;
  if (last && !last.condition) {
    result = value(last.children);
    branches.pop();
  }
  for (const each of branches.toReversed()) {
    result = js.conditionalExpression(
      expression(each.condition!, context, "test"),
      value(each.children),
      result,
    );
  }
  return result;
}

/** Whether a value types as `string | undefined`, as Qwik's `<title>` takes it. */
function isText(value: Expression, context: TitleContext): boolean {
  return isTextValue(value, context.jsx.component, context.module);
}

/** An expression's code in a placeholder, parenthesised where `slot` needs it. */
function expression(
  value: Expression,
  context: TitleContext,
  slot: "argument" | "operand" | "test" = "argument",
): JsExpression {
  return context.placeholders.expression(expressionCode(value, context.jsx), slot);
}

function undefinedValue(): JsExpression {
  return js.identifier("undefined");
}
