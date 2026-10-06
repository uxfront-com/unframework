// React's rule for an SVG `<title>` (ADR-0040). React DOM's server renderer writes a title's text
// only when its `children` is one value, in SVG as in HTML: for an array it writes an empty
// `<title></title>` and warns, and the client's text then fails hydration. So wherever a title's
// content has several parts, the React output gives it one string, a template literal, as React's
// own warning suggests (`<title>{`Status: ${status}`}</title>`).
import {
  expressionCode,
  js,
  nullishText,
  Placeholders,
  printExpression,
  textTemplate,
} from "@unframework/codegen";
import type { JsxContext, TextPart } from "@unframework/codegen";
import type { Expression, IfNode, RenderNode, TextNode, UfComponent } from "@unframework/ir";

/** An expression in the AST (codegen's builders name the node types). */
type JsExpression = Exclude<TextPart, string>;

/**
 * What an SVG `<title>` holds in the React output: content that renders as one value (a text,
 * an interpolation, or a conditional whose branches each render one) as it is, and anything
 * else as one string. The IR holds no element or list in a title (ADR-0040's amendment to
 * ADR-0032); the target throws on one rather than drop it (a target that throws is reported by
 * the compiler).
 */
export function titleChildren(children: readonly RenderNode[], context: JsxContext): RenderNode[] {
  const [only] = children;
  if (!only || children.length > 1 || only.kind === "Element" || only.kind === "For") {
    return joined(children, context);
  }
  if (only.kind !== "If") return [only];
  const branches = only.branches.map((branch) => ({
    ...branch,
    children: titleChildren(branch.children, context),
  }));
  return [{ ...only, branches }];
}

/**
 * Several parts as one node: their text when nothing in them renders a value, or else an
 * interpolation of one string expression. Its code is printed here, each part's spelled by the
 * context, so the expression holds no reference for a rewrite to spell again.
 */
function joined(children: readonly RenderNode[], context: JsxContext): RenderNode[] {
  if (children.length === 0) return [];
  const span = { start: children[0]!.span.start, end: children.at(-1)!.span.end };
  const placeholders = new Placeholders();
  const parts = template(children, context, placeholders);
  if (typeof parts === "string") return parts ? [{ kind: "Text", value: parts, span }] : [];
  const code = placeholders.print(() => printExpression(parts));
  return [{ kind: "Interpolation", value: { code, span, refs: [] }, span }];
}

/**
 * Parts as one string expression: a template literal, or the one expression it would hold
 * alone; or, when nothing in them renders a value, their text.
 */
function template(
  nodes: readonly RenderNode[],
  context: JsxContext,
  placeholders: Placeholders,
): JsExpression | string {
  const parts: TextPart[] = [];
  for (const node of nodes) {
    const value = node.kind === "Text" ? node.value : part(node, context, placeholders);
    if (value !== undefined) parts.push(value);
  }
  const [only] = parts;
  if (parts.length === 1 && typeof only !== "string") return only!;
  return textTemplate(parts);
}

/**
 * A part of a title's text in a template literal, or `undefined` for an interpolation that
 * always renders nothing (`c ? null : undefined`).
 */
function part(
  node: Exclude<RenderNode, TextNode>,
  context: JsxContext,
  placeholders: Placeholders,
): JsExpression | undefined {
  switch (node.kind) {
    case "Interpolation":
      return interpolationText(node.value, context, placeholders);
    case "If":
      return conditional(node, context, placeholders);
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
 * An interpolation as text in a template literal, where `null` and `undefined` must render
 * nothing as on every target (ADR-0037) and not `undefined`: `nullishText` guards it where
 * TypeScript allows. A prop that is never nullish needs no guard.
 */
function interpolationText(
  value: Expression,
  context: JsxContext,
  placeholders: Placeholders,
): JsExpression | undefined {
  const code = expressionCode(value, context);
  if (isTextProp(value, context.component)) return placeholders.expression(code);
  return nullishText(code, placeholders);
}

/** A conditional as a ternary chain of strings, ending in `""` when no branch renders. */
function conditional(node: IfNode, context: JsxContext, placeholders: Placeholders): JsExpression {
  const branches = [...node.branches];
  const last = branches.at(-1);
  let chain: JsExpression = js.stringLiteral("");
  if (last && !last.condition) {
    chain = branchText(last.children, context, placeholders);
    branches.pop();
  }
  for (const branch of branches.toReversed()) {
    chain = js.conditionalExpression(
      placeholders.expression(expressionCode(branch.condition!, context), "test"),
      branchText(branch.children, context, placeholders),
      chain,
    );
  }
  return chain;
}

/** What a branch renders, as one string expression. */
function branchText(
  children: readonly RenderNode[],
  context: JsxContext,
  placeholders: Placeholders,
): JsExpression {
  const parts = template(children, context, placeholders);
  return typeof parts === "string" ? js.stringLiteral(parts) : parts;
}

/**
 * Whether a value is exactly the read of a prop that is never nullish: a `string` or a `number`
 * the consumer must pass, or one with a default (a static value, never `undefined`). Its text
 * needs no `?? ""`, which a React developer would not write there.
 */
function isTextProp(value: Expression, component: UfComponent): boolean {
  const [only] = value.refs;
  if (value.refs.length !== 1 || only?.kind !== "Binding") return false;
  if (only.span.start !== value.span.start || only.span.end !== value.span.end) return false;
  const prop = component.props.find((candidate) => candidate.binding === only.binding);
  if (!prop || !["string", "number"].includes(prop.type.code)) return false;
  return !prop.optional || prop.default !== undefined;
}
