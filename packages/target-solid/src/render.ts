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
// - Solid's server compiler escapes an expression's value at run time, but not the string
//   literals it finds by looking into a conditional, a `+`, the right of `&&`, or a child's
//   template literal: `{done ? "<b>" : name}` reaches the HTML as `<b>`, where the client renders
//   text. Such a literal holding a character HTML reads there is wrapped in `String(…)`, the same
//   string, which the compiler leaves to the run-time escape (see {@link escapedOnServer}).
import {
  LEADING_LINE_FEED_ELEMENTS,
  parseExpression,
  rewriteExpression,
} from "@unframework/codegen";
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

import { carriedPaths, samePath, slice, wholePath } from "./narrowing.ts";
import type { ReferencePath } from "./narrowing.ts";

/**
 * A component's render tree as Solid prints it, with references spelled by `rules`: see the
 * module comment.
 */
export function forSolid(component: UfComponent, rules: RewriteRules): UfComponent["render"] {
  const element = <T extends ElementNode | FragmentNode>(node: T): T => {
    const content = children(node.children);
    return {
      ...node,
      ...(node.kind === "Element"
        ? {
            attributes: node.attributes.map((attribute) =>
              attribute.kind === "Bound"
                ? { ...attribute, value: escapedOnServer(attribute.value, "attribute") }
                : attribute,
            ),
          }
        : {}),
      children:
        node.kind === "Element" && LEADING_LINE_FEED_ELEMENTS.has(node.tag)
          ? insertedLineFeed(content)
          : content,
    };
  };
  // The paths the keyed callbacks around a node receive, which print as plain names.
  const carried: ReferencePath[][] = [];
  const children = (nodes: readonly RenderNode[]): RenderNode[] =>
    nodes.flatMap((node): RenderNode[] => {
      switch (node.kind) {
        case "Element":
          return [element(node)];
        case "If": {
          const tests = node.branches.flatMap((branch) =>
            branch.condition ? [branch.condition] : [],
          );
          return [
            {
              ...node,
              branches: node.branches.map((branch, index) => {
                carried.push(
                  carriedPaths(
                    branch.children,
                    branch.condition ? tests.slice(0, index + 1) : tests,
                    Boolean(branch.condition),
                    carried.flat(),
                  ),
                );
                try {
                  return { ...branch, children: children(branch.children) };
                } finally {
                  carried.pop();
                }
              }),
            },
          ];
        }
        case "For":
          return [{ ...node, body: element(node.body) }];
        case "Interpolation":
          // The `<Show>` an interpolation may become renders it as a component's content,
          // which the server escapes whole; one left as text is escaped here.
          return interpolation(node, (part) => {
            const printed = parseExpression(rewriteExpression(part, component, rules));
            if (printed.type === "Identifier") return true;
            // A path a keyed callback receives prints as its plain name (src/narrowing.ts).
            const path = wholePath(part);
            return Boolean(path && carried.flat().some((entry) => samePath(entry, path)));
          }).map((child) =>
            child.kind === "Interpolation"
              ? { ...child, value: escapedOnServer(child.value, "child") }
              : child,
          );
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
function interpolation(node: InterpolationNode, bare: (part: Expression) => boolean): RenderNode[] {
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

/** The characters HTML reads in text (`<`, `&`) and in a quoted attribute value (`"`, `&`). */
const SIGNIFICANT = { child: /[<&]/, attribute: /["&]/ } as const;

/** A parsed node with its offsets in the expression's code. */
type Parsed = ReturnType<typeof parseExpression>;

/**
 * An expression whose string literals Solid's server compiler would write into the HTML
 * unescaped, with each such literal that holds a character HTML reads in `position` wrapped
 * in `String(…)`: a call, which the compiler escapes at run time. The value is the same, on
 * the server and in the browser. It follows babel-plugin-jsx-dom-expressions' own walk
 * (`escapeExpression`, 0.40): into a conditional's branches, both sides of a binary operator,
 * the right of `&&`, and a template literal's expressions, whose text it escapes in an
 * attribute but not in a child, where the whole template is wrapped instead. Anything else it
 * escapes whole.
 */
export function escapedOnServer(
  expression: Expression,
  position: "child" | "attribute",
): Expression {
  const significant = SIGNIFICANT[position];
  const wrapped: Parsed[] = [];
  const visit = (node: Parsed, top: boolean): void => {
    switch (node.type) {
      case "Literal":
        // A literal on its own is static: compiled into the escaped template.
        if (!top && typeof node.value === "string" && significant.test(node.value)) {
          wrapped.push(node);
        }
        return;
      case "TemplateLiteral": {
        const text = node.quasis.map((quasi) => quasi.value.cooked ?? quasi.value.raw).join("");
        if (node.expressions.length === 0) {
          if (!top && significant.test(text)) wrapped.push(node);
          return;
        }
        if (position === "child" && significant.test(text)) {
          wrapped.push(node);
          return;
        }
        for (const part of node.expressions) visit(part, false);
        return;
      }
      case "ConditionalExpression":
        visit(node.consequent, false);
        visit(node.alternate, false);
        return;
      case "BinaryExpression":
        if (node.left.type !== "PrivateIdentifier") visit(node.left, false);
        visit(node.right, false);
        return;
      case "LogicalExpression":
        if (node.operator === "&&") visit(node.right, false);
        return;
      default:
    }
  };
  visit(parseExpression(expression.code), true);
  if (!wrapped.length) return expression;
  const inserts = wrapped
    .flatMap((node) => [
      { at: node.start, text: "String(" },
      { at: node.end, text: ")" },
    ])
    .toSorted((a, b) => a.at - b.at);
  let code = "";
  let last = 0;
  for (const { at, text } of inserts) {
    code += expression.code.slice(last, at) + text;
    last = at;
  }
  code += expression.code.slice(last);
  // A reference after an insertion moves by the text inserted before it.
  const shift = (offset: number) =>
    inserts.filter(({ at }) => at <= offset).reduce((sum, { text }) => sum + text.length, 0);
  const start = expression.span.start;
  return {
    code,
    span: { start, end: start + code.length },
    refs: expression.refs.map((reference) => {
      const offset = reference.span.start - start;
      const moved = shift(offset);
      return {
        ...reference,
        span: { start: reference.span.start + moved, end: reference.span.end + moved },
      };
    }),
  };
}
