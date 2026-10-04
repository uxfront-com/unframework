// The IR as Solid's JSX needs it printed, where that differs from the IR's own shape:
//
// - An interpolated conditional whose branch prints as a bare name (`{done ? title : "-"}`,
//   with `title` a list's item, or a global such as `undefined`; a prop prints as
//   `props.title`) is a case of `<Show>` to eslint-plugin-solid (`solid/prefer-show`, which L5
//   runs, ADR-0042): it reads it as content shown under a condition, and so does the output,
//   which keeps the same text.
// - Solid compiles an element's static content into an HTML template, which the browser
//   parses: a line feed that the template puts right after `<pre>` (static text that follows
//   only expressions, `<pre>{name}{"\n"}{street}</pre>`) is dropped there, as HTML drops a
//   leading line feed, though the server renders it. That line feed is inserted instead.
import { LEADING_LINE_FEED_ELEMENTS, parseExpression, rewriteExpression } from "@unframework/codegen";
import type { RewriteRules } from "@unframework/codegen";
import type {
  ElementNode,
  Expression,
  FragmentNode,
  IfBranch,
  InterpolationNode,
  RenderNode,
  UfComponent,
} from "@unframework/ir";

/**
 * A component's render tree as Solid prints it, with references spelled by `rules`: see the
 * module comment.
 */
export function forSolid(
  component: UfComponent,
  rules: RewriteRules,
): UfComponent["render"] {
  const element = <T extends ElementNode | FragmentNode>(node: T): T => {
    const content = children(node.children);
    return {
      ...node,
      children:
        node.kind === "Element" && LEADING_LINE_FEED_ELEMENTS.has(node.tag)
          ? insertedLineFeed(content)
          : content,
    };
  };
  const children = (nodes: readonly RenderNode[]): RenderNode[] =>
    nodes.flatMap((node): RenderNode[] => {
      switch (node.kind) {
        case "Element":
          return [element(node)];
        case "If":
          return [
            {
              ...node,
              branches: node.branches.map((branch) => ({
                ...branch,
                children: children(branch.children),
              })),
            },
          ];
        case "For":
          return [{ ...node, body: element(node.body) }];
        case "Interpolation":
          return interpolation(node, (part) => {
            const printed = parseExpression(rewriteExpression(part, component, rules));
            return printed.type === "Identifier";
          });
        case "Text":
          return [node];
        default:
          return node satisfies never;
      }
    });
  return element(component.render);
}

/**
 * An element's children with no line feed starting its template: while its first static child
 * is text that starts with line feeds and comes after expressions or control flow, those line
 * feeds move into an expression of their own, `{["\n"]}`, an array, which Solid inserts as text
 * rather than compiling into the template (a string would be compiled in). Once moved, the
 * next static child may start the template in turn. The DOM text is the same.
 */
function insertedLineFeed(nodes: readonly RenderNode[]): RenderNode[] {
  let children = [...nodes];
  for (;;) {
    const first = children.findIndex((node) => node.kind === "Text" || node.kind === "Element");
    const text = children[first];
    if (first <= 0 || text?.kind !== "Text") return children;
    const feeds = /^\n+/.exec(text.value)?.[0];
    if (!feeds) return children;
    const at = { start: text.span.start, end: text.span.start };
    const inserted: InterpolationNode = {
      kind: "Interpolation",
      value: { code: `[${JSON.stringify(feeds)}]`, span: at, refs: [] },
      span: at,
    };
    const rest = text.value.slice(feeds.length);
    children = [
      ...children.slice(0, first),
      inserted,
      ...(rest ? [{ ...text, value: rest }] : []),
      ...children.slice(first + 1),
    ];
  }
}

/**
 * An interpolated conditional with a branch that prints as a bare name, as an If whose
 * branches interpolate each side (nothing for `null`, `undefined` or `""`); any other
 * interpolation as it is. Only the outermost conditional counts: the rule reads nothing nested.
 */
function interpolation(
  node: InterpolationNode,
  bare: (part: Expression) => boolean,
): RenderNode[] {
  const parsed = parseExpression(node.value.code);
  if (parsed.type !== "ConditionalExpression") return [node];
  if (!bare(slice(node.value, parsed.consequent)) && !bare(slice(node.value, parsed.alternate))) {
    return [node];
  }
  const branch = (part: typeof parsed.test, condition?: Expression): IfBranch => {
    const value = slice(node.value, part);
    const content: InterpolationNode[] = isNothing(part)
      ? []
      : [{ kind: "Interpolation", value, span: value.span }];
    return condition
      ? { condition, children: content, span: node.span }
      : { children: content, span: node.span };
  };
  const then = branch(parsed.consequent, slice(node.value, parsed.test));
  const otherwise = branch(parsed.alternate);
  if (then.children.length === 0 && otherwise.children.length === 0) return [];
  const branches = otherwise.children.length ? [then, otherwise] : [then];
  return [{ kind: "If", branches, span: node.span }];
}

/** Whether a branch renders nothing: `null`, `undefined` or an empty string. */
function isNothing(part: ReturnType<typeof parseExpression>): boolean {
  if (part.type === "Identifier") return part.name === "undefined";
  return part.type === "Literal" && (part.value === null || part.value === "");
}

/** The part of an expression that a node of its parsed code spans, with its references. */
function slice(expression: Expression, part: { start: number; end: number }): Expression {
  const start = expression.span.start + part.start;
  const end = expression.span.start + part.end;
  return {
    code: expression.code.slice(part.start, part.end),
    span: { start, end },
    refs: expression.refs.filter(
      (reference) => reference.span.start >= start && reference.span.end <= end,
    ),
  };
}
