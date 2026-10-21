// The IR as Solid's JSX needs it printed, where that differs from the IR's own shape:
//
// - An interpolated conditional whose branch prints as a bare name (`{done ? title : "-"}`,
//   with `title` a list's item, a setup constant, a value a keyed branch's callback received, or a
//   global such as `undefined`; a prop prints as `props.title`, state as `count()` and a value an
//   accessor reads as `user()`) is a case of `<Show>` to eslint-plugin-solid
//   (`solid/prefer-show`, which L5 runs, ADR-0042): it reads it as content shown under a
//   condition, and so does the output, which keeps the same text.
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
  scopeRoots,
} from "@unframework/codegen";
import type { RewriteRules } from "@unframework/codegen";
import type {
  Attribute,
  ElementNode,
  Expression,
  FragmentNode,
  IfBranch,
  InterpolationNode,
  RenderNode,
  SlotFill,
  UfComponent,
} from "@unframework/ir";

import { carriedPaths, narrowsFurther, samePath, slice, wholePath } from "./narrowing.ts";
import type { BindingTypes } from "./narrowing.ts";
import type { ReferencePath } from "./narrowing.ts";

/**
 * A text child as a scope root prints it: one holding a character HTML reads there becomes a
 * string literal, `{"a < b"}`, which Solid's compiler escapes, as it doesn't JSX text inside a
 * spread element on the server.
 */
function escapedText(node: RenderNode): RenderNode {
  if (node.kind !== "Text" || !/[<>&]/.test(node.value)) return node;
  return {
    kind: "Interpolation",
    value: { code: JSON.stringify(node.value), span: node.span, refs: [] },
    span: node.span,
  };
}

/**
 * A component's render tree as Solid prints it, with references spelled by `rules`: see the
 * module comment.
 */
export function forSolid(
  component: UfComponent,
  rules: RewriteRules,
  types: BindingTypes,
): UfComponent["render"] {
  // A root that spreads its styled parents' scope attributes renders through Solid's
  // `ssrElement`, which writes its JSX text decoded and unescaped (ADR-0063).
  const roots = new Set(scopeRoots(component).map(({ start, end }) => `${start}:${end}`));
  const element = <T extends ElementNode | FragmentNode>(node: T): T => {
    const model =
      node.kind === "Element"
        ? node.attributes.find(
            (attribute) =>
              attribute.kind === "Model" &&
              (attribute.control === "select" || attribute.control === "select-multiple"),
          )
        : undefined;
    const printed = children(
      model?.kind === "Model"
        ? selectedOptions(node.children, model.value, model.control === "select-multiple")
        : node.children,
    );
    const content = roots.has(`${node.span.start}:${node.span.end}`)
      ? printed.map(escapedText)
      : printed;
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
  // The paths the branch callbacks around a node receive, and those a keyed one receives, which
  // print as plain names (src/narrowing.ts); an accessor's read is a call.
  const around: ReferencePath[][] = [];
  const keyed: ReferencePath[][] = [];
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
                const paths = carriedPaths(
                  branch.children,
                  branch.condition ? tests.slice(0, index + 1) : tests,
                  Boolean(branch.condition),
                  around.flat(),
                  types,
                );
                around.push(paths);
                keyed.push(narrowsFurther(branch.children, paths) ? paths : []);
                try {
                  return { ...branch, children: children(branch.children) };
                } finally {
                  around.pop();
                  keyed.pop();
                }
              }),
            },
          ];
        }
        case "For":
          return [
            {
              ...node,
              body:
                node.body.kind === "Element"
                  ? element(node.body)
                  : { ...node.body, fills: fills(node.body.fills) },
            },
          ];
        case "Interpolation":
          // The `<Show>` an interpolation may become renders it as a component's content,
          // which the server escapes whole; one left as text is escaped here.
          return interpolation(node, (part) => {
            const printed = parseExpression(rewriteExpression(part, component, rules));
            if (printed.type === "Identifier") return true;
            // A path a keyed callback receives prints as its plain name (src/narrowing.ts).
            const path = wholePath(part);
            return Boolean(path && keyed.flat().some((entry) => samePath(entry, path)));
          }).map((child) =>
            child.kind === "Interpolation"
              ? { ...child, value: escapedOnServer(child.value, "child") }
              : child,
          );
        case "Text":
          return [node];
        case "Component":
          return [{ ...node, fills: fills(node.fills) }];
        case "SlotOutlet":
          return [{ ...node, fallback: children(node.fallback) }];
        case "Dynamic":
          return [
            {
              ...node,
              children: children(node.children),
              ...(node.fills ? { fills: fills(node.fills) } : {}),
            },
          ];
        default:
          return node satisfies never;
      }
    });
  const fills = (list: readonly SlotFill[]): SlotFill[] =>
    list.map((fill) => ({ ...fill, children: children(fill.children) }));
  return element(component.render);
}

/**
 * A `<select>`'s options, each `selected` where it holds the model's value, or where the model's
 * array holds it for a `<select multiple>` (ADR-0054), as Vue's `vModelSelect` sets them: Solid's
 * server writes a `<select>`'s `value` as an attribute, and its `value` takes one value. Options
 * are found in groups, lists and conditionals; one without a `value` holds its text, as the DOM
 * reads it.
 */
function selectedOptions(
  nodes: readonly RenderNode[],
  model: Expression,
  multiple: boolean,
): RenderNode[] {
  return nodes.map((node): RenderNode => {
    switch (node.kind) {
      case "For":
        return node.body.kind === "Element" && node.body.tag === "option"
          ? { ...node, body: selectedOption(node.body, model, multiple) }
          : node;
      case "If":
        return {
          ...node,
          branches: node.branches.map((branch) => ({
            ...branch,
            children: selectedOptions(branch.children, model, multiple),
          })),
        };
      case "Element":
        if (node.tag === "optgroup") {
          return { ...node, children: selectedOptions(node.children, model, multiple) };
        }
        return node.tag === "option" ? selectedOption(node, model, multiple) : node;
      default:
        return node;
    }
  });
}

/**
 * Whether some of a `<select>`'s options are not its own to mark: a component, a slot, an
 * interpolation or a `<component is>` renders them, or a list's row that is no `<option>`.
 */
export function unmarkedOptions(nodes: readonly RenderNode[]): boolean {
  return nodes.some((node) => {
    switch (node.kind) {
      case "Text":
        return false;
      case "Element":
        return node.tag === "optgroup" ? unmarkedOptions(node.children) : node.tag !== "option";
      case "If":
        return node.branches.some((branch) => unmarkedOptions(branch.children));
      case "For":
        return node.body.kind !== "Element" || node.body.tag !== "option";
      default:
        return true;
    }
  });
}

function selectedOption(option: ElementNode, model: Expression, multiple: boolean): ElementNode {
  const value = option.attributes.find(
    (attribute) =>
      (attribute.kind === "Static" || attribute.kind === "Bound") && attribute.name === "value",
  );
  const own =
    value?.kind === "Static"
      ? JSON.stringify(value.value === true ? "" : value.value)
      : value?.kind === "Bound"
        ? value.value
        : optionText(option);
  const selected: Attribute = {
    kind: "Bound",
    name: "selected",
    value: selects(model, own, multiple),
    span: value?.span ?? option.span,
  };
  return { ...option, attributes: [...option.attributes, selected] };
}

/**
 * The value of an option without a `value`: its text, the static text as a string and each
 * interpolation as written, joined with `+`, the whitespace at its ends trimmed as the DOM's
 * `value` strips and collapses it (a static text's own).
 */
function optionText(option: ElementNode): Expression | string {
  const parts = option.children.flatMap((child): (Expression | string)[] => {
    if (child.kind === "Text") return [child.value];
    if (child.kind === "Interpolation") return [child.value];
    return [];
  });
  if (parts.every((part) => typeof part === "string")) {
    return JSON.stringify(
      parts
        .join("")
        .replace(/[\t\n\f\r ]+/g, " ")
        .trim(),
    );
  }
  return joined(parts.map((part) => (typeof part === "string" ? JSON.stringify(part) : part)));
}

/**
 * Expressions and string literals joined with `+` into an option's value, its ASCII whitespace
 * collapsed as the DOM's (`String("a " + (x)).replace(…)`), each reference at its place in the
 * new code.
 */
function joined(parts: readonly (Expression | string)[]): Expression {
  const start = parts.find((part): part is Expression => typeof part !== "string")!.span.start;
  let code = "String(";
  const refs: Expression["refs"] = [];
  for (const [index, part] of parts.entries()) {
    if (index) code += " + ";
    if (typeof part === "string") {
      code += part;
      continue;
    }
    code += "(";
    const by = start + code.length - part.span.start;
    code += `${part.code})`;
    refs.push(...part.refs.map((reference) => shifted(reference, by)));
  }
  // The DOM strips and collapses an option's text into its value.
  code += ').replace(/[\\t\\n\\f\\r ]+/g, " ").replace(/^ | $/g, "")';
  return { code, span: { start, end: start + code.length }, refs };
}

/** A reference moved by `by` characters. */
function shifted<T extends { span: { start: number; end: number } }>(reference: T, by: number): T {
  return { ...reference, span: { start: reference.span.start + by, end: reference.span.end + by } };
}

/**
 * `model === value`, or `model.includes(value)`, with each reference at its place in the new
 * code.
 */
function selects(model: Expression, value: Expression | string, multiple: boolean): Expression {
  const prefix = multiple ? `${model.code}.includes(` : `${model.code} === `;
  const own = typeof value === "string" ? value : value.code;
  const code = `${prefix}${own}${multiple ? ")" : ""}`;
  const start = model.span.start;
  const by = start + prefix.length - (typeof value === "string" ? 0 : value.span.start);
  const ownRefs =
    typeof value === "string" ? [] : value.refs.map((reference) => shifted(reference, by));
  return { code, span: { start, end: start + code.length }, refs: [...model.refs, ...ownRefs] };
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
