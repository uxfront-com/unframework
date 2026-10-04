// The expression rewrite engine (plan §5.4, design §4.1). An IR expression keeps its source
// text exactly; a target prints it by splicing its own spelling of each reference into that
// text, never by re-printing a parsed AST: oxc-codegen prints numbers from their value
// (`1000` → `1e3`) and drops comments, while splicing keeps every literal, space and comment
// as the author wrote it.
import type * as AST from "@oxc-project/types";
import type {
  Binding,
  BindingId,
  BindingReference,
  Expression,
  GlobalReference,
  RenderNode,
  UfComponent,
} from "@unframework/ir";
import { parseModule } from "@unframework/parser";
import type { ParsedModule } from "@unframework/parser";
import { MagicString } from "magic-string";

/** How a target spells the references of an expression. */
export interface RewriteRules {
  /**
   * The code that replaces a reference to one of the component's bindings: the whole
   * reference span, so `props.label` in the object form as well as `label`. `written` is the
   * span's source text. A shorthand property (`{ label }`) is expanded around the result.
   */
  binding(reference: BindingReference, binding: Binding, written: string): string;
  /** The code that replaces a reference to an allowed global: its own name when absent. */
  global?(reference: GlobalReference): string;
}

/** A comment in parsed code. */
export type ExpressionComment = ParsedModule["comments"][number];

/** An expression parsed on its own: offsets are relative to its code. */
export interface ParsedExpression {
  expression: AST.Expression;
  /** The comments inside the code, in source order. */
  comments: ExpressionComment[];
}

/**
 * Where code is spliced, which decides whether it needs parentheses there:
 * - `operand`: an operand of an operator, the object of a member access or a callee
 *   (`(a ?? []).map`, `!(a && b)`);
 * - `test`: the test of a conditional (`(a ? b : c) ? x : y`);
 * - `argument`: a position that takes any expression but a sequence: a call argument, an
 *   array element, a property value, a JSX expression container or a conditional's branch.
 */
export type ParenthesesSlot = "operand" | "test" | "argument";

const bindingsByComponent = new WeakMap<UfComponent, ReadonlyMap<BindingId, Binding>>();

/** A component's bindings by id. */
function bindingsOf(component: UfComponent): ReadonlyMap<BindingId, Binding> {
  let bindings = bindingsByComponent.get(component);
  if (!bindings) {
    bindings = new Map(component.bindings.map((binding) => [binding.id, binding]));
    bindingsByComponent.set(component, bindings);
  }
  return bindings;
}

/** The binding a component declares under `id`. Throws when it declares none: invalid IR. */
export function bindingOf(component: UfComponent, id: BindingId): Binding {
  const binding = bindingsOf(component).get(id);
  if (!binding) throw new Error(`Component ${component.name} declares no binding ${id}.`);
  return binding;
}

/**
 * The expression's code with each reference spelled by `rules`, spliced at the reference's
 * span; everything between references stays as written. A shorthand property whose binding
 * changes spelling is expanded (`{ label }` → `{ label: props.label }`). Throws on a
 * reference outside the expression or overlapping another, which `checkInvariants` rules out.
 */
export function rewriteExpression(
  expression: Expression,
  component: UfComponent,
  rules: RewriteRules,
): string {
  if (expression.refs.length === 0) return expression.code;
  const { code } = expression;
  const offset = expression.span.start;
  const output = new MagicString(code);
  let shorthandGlobals: ReadonlySet<number> | undefined;
  let previousEnd = 0;
  for (const reference of expression.refs) {
    const start = reference.span.start - offset;
    const end = reference.span.end - offset;
    if (start < previousEnd || end > code.length || start >= end) {
      throw new Error(
        `A reference at ${reference.span.start}–${reference.span.end} is outside or overlaps the expression \`${code}\` at ${offset}.`,
      );
    }
    previousEnd = end;
    const written = code.slice(start, end);
    let spelling: string;
    let shorthand: boolean;
    if (reference.kind === "Binding") {
      spelling = rules.binding(reference, bindingOf(component, reference.binding), written);
      shorthand = reference.shorthand === true;
    } else {
      spelling = rules.global?.(reference) ?? written;
      // The IR marks shorthand properties on bindings only: find a global's from the AST, and
      // only when its spelling changes.
      shorthandGlobals ??= spelling === written ? undefined : shorthandStarts(code);
      shorthand = shorthandGlobals?.has(start) ?? false;
    }
    if (spelling === written) continue;
    output.overwrite(start, end, shorthand ? `${written}: ${spelling}` : spelling);
  }
  return output.toString();
}

/** The offsets of the shorthand properties' values in an expression's code (`{ NaN }`). */
function shorthandStarts(code: string): ReadonlySet<number> {
  const starts = new Set<number>();
  visitNodes(parseExpression(code), (node) => {
    if (node.type === "Property" && (node as AST.ObjectProperty).shorthand) {
      starts.add((node as AST.ObjectProperty).value.start);
    }
  });
  return starts;
}

// `(` and a line break before the code, and a line break before `)`: an object literal is
// not read as a block, and a trailing line comment cannot swallow the `)`.
const PREFIX = "(\n";
const SUFFIX = "\n);";

/**
 * Parses code that must be exactly one expression, with its comments, through
 * `@unframework/parser` (oxc). Offsets in the result are relative to `code`. Throws when the
 * code is not one complete expression: printers splice only code the analyser accepted, so
 * that is a compiler bug, reported as an internal error.
 */
export function parseExpressionSource(code: string): ParsedExpression {
  // `@unframework/parser` has no expression entry: wrap the code in parentheses and parse a
  // module. Code that closes the wrapper's parentheses itself (`a) + (b`) parses too, but
  // then the expression reaches past the code, which the span check rejects.
  const parsed = parseModule("expression.tsx", `${PREFIX}${code}${SUFFIX}`);
  const [statement, ...rest] = parsed.program.body;
  const expression = statement?.type === "ExpressionStatement" ? statement.expression : undefined;
  if (
    parsed.errors.length > 0 ||
    rest.length > 0 ||
    !expression ||
    expression.start < PREFIX.length ||
    expression.end > PREFIX.length + code.length
  ) {
    const reason = parsed.errors[0]?.message ?? "it is not one expression";
    throw new Error(`Cannot parse \`${code}\` as an expression: ${reason}.`);
  }
  visitNodes(expression, (node) => {
    node.start -= PREFIX.length;
    node.end -= PREFIX.length;
  });
  const comments = parsed.comments.map((comment) => ({
    ...comment,
    start: comment.start - PREFIX.length,
    end: comment.end - PREFIX.length,
  }));
  return { expression, comments };
}

/** Parses code that must be exactly one expression: see {@link parseExpressionSource}. */
export function parseExpression(code: string): AST.Expression {
  return parseExpressionSource(code).expression;
}

/**
 * Whether code needs parentheses where it is spliced (`operand` by default): see
 * {@link ParenthesesSlot}. Code the author parenthesised as a whole needs none. Conservative:
 * oxfmt removes parentheses that turn out redundant.
 */
export function needsParentheses(code: string, slot: ParenthesesSlot = "operand"): boolean {
  return parenthesesNeeded(parseExpression(code), code, slot);
}

/** {@link needsParentheses} for code already parsed. */
export function parenthesesNeeded(
  expression: AST.Expression,
  code: string,
  slot: ParenthesesSlot,
): boolean {
  // The parser drops parentheses: an expression that starts after the code's first character
  // and ends before its last sits inside the author's own.
  if (code.startsWith("(") && code.endsWith(")") && expression.start > 0) {
    if (expression.end < code.length) return false;
  }
  switch (slot) {
    case "argument":
      return expression.type === "SequenceExpression";
    case "test":
      return LOWER_THAN_CONDITIONAL.has(expression.type);
    case "operand":
      return !OPERAND_SAFE.has(expression.type) || isNumericLiteral(expression);
    default:
      return unreachable(slot);
  }
}

/** Expressions that bind no tighter than a conditional's test may hold. */
const LOWER_THAN_CONDITIONAL: ReadonlySet<string> = new Set([
  "ConditionalExpression",
  "ArrowFunctionExpression",
  "AssignmentExpression",
  "SequenceExpression",
  "YieldExpression",
]);

/**
 * Expressions that bind as tightly as a member access, so any operator, member access or call
 * can take them as written. An optional chain is not one: `(a?.b).c` throws where `a?.b.c`
 * short-circuits. A number literal is not one either (`1.toFixed` is a syntax error).
 */
const OPERAND_SAFE: ReadonlySet<string> = new Set([
  "Identifier",
  "Literal",
  "TemplateLiteral",
  "TaggedTemplateExpression",
  "ArrayExpression",
  "ObjectExpression",
  "MemberExpression",
  "CallExpression",
  "ThisExpression",
  "MetaProperty",
  "JSXElement",
  "JSXFragment",
]);

function isNumericLiteral(expression: AST.Expression): boolean {
  return expression.type === "Literal" && typeof expression.value === "number";
}

/** Whether a For node's key counts in {@link referencedBindings}. */
export interface ReferencedOptions {
  /**
   * Whether the lists' keys count: `false` for a target that does not print keys (Solid's
   * `<For>`), so an index used only as a key is not declared. Default `true`.
   */
  includeKeys?: boolean;
}

/**
 * The bindings that the printed expressions of a component (or of one render node) reference:
 * a target omits a destructured prop or a list's index parameter outside this set, which
 * would otherwise be an unused variable (L5).
 */
export function referencedBindings(
  scope: UfComponent | RenderNode,
  options: ReferencedOptions = {},
): Set<BindingId> {
  const includeKeys = options.includeKeys ?? true;
  const found = new Set<BindingId>();
  const add = (expression: Expression | undefined) => {
    for (const reference of expression?.refs ?? []) {
      if (reference.kind === "Binding") found.add(reference.binding);
    }
  };
  if ("bindings" in scope) {
    for (const prop of scope.props) add(prop.default);
    visitRender(scope.render, add, includeKeys);
  } else {
    visitRender(scope, add, includeKeys);
  }
  return found;
}

/** Calls `add` on every expression of a render tree, with or without the lists' keys. */
function visitRender(
  node: UfComponent["render"] | RenderNode,
  add: (expression: Expression) => void,
  includeKeys: boolean,
): void {
  switch (node.kind) {
    case "Element":
      for (const attribute of node.attributes) {
        switch (attribute.kind) {
          case "Static":
            break;
          case "Bound":
          case "Spread":
            add(attribute.value);
            break;
          case "Class":
            for (const item of attribute.items) {
              if (item.kind === "Toggle") add(item.condition);
              else if (item.kind === "Dynamic") add(item.value);
            }
            break;
          case "Style":
            for (const declaration of attribute.declarations) {
              if (declaration.kind === "Bound") add(declaration.value);
            }
            break;
          default:
            unreachable(attribute);
        }
      }
      for (const child of node.children) visitRender(child, add, includeKeys);
      return;
    case "Fragment":
      for (const child of node.children) visitRender(child, add, includeKeys);
      return;
    case "Interpolation":
      add(node.value);
      return;
    case "If":
      for (const branch of node.branches) {
        if (branch.condition) add(branch.condition);
        for (const child of branch.children) visitRender(child, add, includeKeys);
      }
      return;
    case "For":
      add(node.source);
      if (includeKeys) add(node.key);
      visitRender(node.body, add, includeKeys);
      return;
    case "Text":
      return;
    default:
      unreachable(node);
  }
}

/**
 * The names an expression's code declares or reads as variables: identifiers, arrow
 * parameters included, but not member or property names (`a.b`, `{ b: 1 }`), which no
 * declaration can capture.
 */
export function expressionNames(code: string): Set<string> {
  const names = new Set<string>();
  const visit = (node: unknown, skip: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item, skip);
      return;
    }
    if (!isNode(node) || node === skip) return;
    if (node.type === "Identifier") names.add((node as AST.IdentifierName).name);
    // A member's property and a property's key are names, not variables, unless computed;
    // a shorthand property's key is its value, which is visited.
    const ignored =
      node.type === "MemberExpression" && !(node as AST.MemberExpression).computed
        ? (node as AST.StaticMemberExpression).property
        : node.type === "Property" && !(node as AST.ObjectProperty).computed
          ? (node as AST.ObjectProperty).key
          : undefined;
    for (const [key, value] of Object.entries(node)) {
      if (key !== "type" && typeof value === "object") visit(value, ignored);
    }
  };
  visit(parseExpression(code), undefined);
  return names;
}

interface Node {
  type: string;
  start: number;
  end: number;
}

function isNode(value: unknown): value is Node {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Node).type === "string" &&
    typeof (value as Node).start === "number"
  );
}

/** Calls `visit` on every node of an AST, depth-first. */
function visitNodes(root: unknown, visit: (node: Node) => void): void {
  if (Array.isArray(root)) {
    for (const item of root) visitNodes(item, visit);
    return;
  }
  if (!isNode(root)) return;
  visit(root);
  for (const [key, value] of Object.entries(root)) {
    if (key !== "type" && typeof value === "object") visitNodes(value, visit);
  }
}

function unreachable(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
