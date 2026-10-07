// What the walks of setup code share that reads only the syntax (ADR-0045): where a function's
// parts are written, the names a pattern declares, the kinds TypeScript infers for a value it
// widens (ADR-0046), and the `preventDefault()` and `stopPropagation()` calls a handler makes
// while its event is dispatched (ADR-0047).

import type { Span } from "@unframework/ir";
import type { AST } from "@unframework/parser";
import { visitorKeys } from "@unframework/parser";

import {
  arrayOf,
  BOOLEAN,
  elementsOf,
  falsyPart,
  kinds,
  NOTHING,
  NULL,
  NUMBER,
  objectOf,
  STRING,
  UNDEFINED,
  union,
  UNKNOWN,
  without,
} from "./types/kinds.ts";
import type { Kinds, Member } from "./types/kinds.ts";

/** The index after the whitespace and comments at `from`. */
export function skipTrivia(source: string, from: number): number {
  let index = from;
  for (;;) {
    while (index < source.length && /\s/.test(source[index]!)) index++;
    if (source.startsWith("//", index)) {
      const end = source.indexOf("\n", index);
      index = end === -1 ? source.length : end;
    } else if (source.startsWith("/*", index)) {
      const end = source.indexOf("*/", index + 2);
      index = end === -1 ? source.length : end + 2;
    } else {
      return index;
    }
  }
}

/** The first `token` at or after `from`, past whitespace, comments and anything else. */
function nextToken(source: string, from: number, token: string, to: number): number | undefined {
  for (let index = from; index < to;) {
    const next = skipTrivia(source, index);
    if (source.startsWith(token, next)) return next;
    index = next + 1;
  }
  return undefined;
}

/**
 * Where an arrow function's expression body is written: from its first token after `=>`, its
 * parentheses included (`() => (open.value = !open.value)`), to the arrow's end. The parser keeps
 * no parentheses as nodes, so the body's own node starts inside them.
 */
export function arrowBodySpan(fn: AST.ArrowFunctionExpression, source: string): Span {
  const from = fn.returnType?.end ?? fn.params.at(-1)?.end ?? fn.start;
  const arrow = nextToken(source, from, "=>", fn.body.start) ?? fn.body.start - 2;
  return { start: skipTrivia(source, arrow + 2), end: fn.end };
}

/**
 * Where a function the source writes is written, for its IR (ADR-0045): an arrow function whole,
 * from `async` or its first parameter; a function declaration from its parameters' parenthesis,
 * after its name, to the end of its body.
 */
export function functionSpan(fn: AST.Function | AST.ArrowFunctionExpression, source: string): Span {
  if (fn.type === "ArrowFunctionExpression") return { start: fn.start, end: fn.end };
  const from = fn.typeParameters?.end ?? fn.id?.end ?? fn.start;
  const open = nextToken(source, from, "(", fn.end) ?? fn.start;
  return { start: open, end: fn.end };
}

/** The identifiers a binding pattern declares, in source order. */
export function patternNames(
  pattern: AST.ParamPattern | AST.BindingPattern | AST.BindingRestElement,
): AST.BindingIdentifier[] {
  switch (pattern.type) {
    case "Identifier":
      return [pattern];
    case "AssignmentPattern":
      return patternNames(pattern.left);
    case "RestElement":
      return patternNames(pattern.argument);
    case "ArrayPattern":
      return pattern.elements.flatMap((element) => (element ? patternNames(element) : []));
    case "ObjectPattern":
      return pattern.properties.flatMap((property) =>
        property.type === "RestElement" ? patternNames(property) : patternNames(property.value),
      );
    default:
      return [];
  }
}

/** The defaults written inside a pattern (`{ size = 1 }`, `[first = ""]`), in source order. */
export function patternDefaults(
  pattern: AST.ParamPattern | AST.BindingPattern | AST.BindingRestElement,
): AST.Expression[] {
  switch (pattern.type) {
    case "AssignmentPattern":
      return [...patternDefaults(pattern.left), pattern.right];
    case "RestElement":
      return patternDefaults(pattern.argument);
    case "ArrayPattern":
      return pattern.elements.flatMap((element) => (element ? patternDefaults(element) : []));
    case "ObjectPattern":
      return pattern.properties.flatMap((property) =>
        property.type === "RestElement"
          ? patternDefaults(property)
          : patternDefaults(property.value),
      );
    default:
      return [];
  }
}

/**
 * The kinds TypeScript infers for a value it widens (ADR-0046): the type argument `ref`
 * infers from its initial value, and a `const`'s object or array literal. A literal written in
 * the source is fresh, and widens to its primitive (`0` to `number`), in an object's members and
 * an array's elements too; a value read from somewhere (a prop, a ref's value, a member of a
 * declared type) keeps its kinds, as do the types an `as` names. `known` gives the kinds the
 * walk read for a node.
 */
export function widened(node: AST.Expression, known: (node: AST.Node) => Kinds): Kinds {
  switch (node.type) {
    case "Literal": {
      const { value } = node;
      if ("regex" in node && node.regex) return kinds("object");
      if ("bigint" in node && node.bigint !== undefined) return kinds("bigint");
      if (value === null) return NULL;
      if (typeof value === "string") return STRING;
      if (typeof value === "number") return NUMBER;
      if (typeof value === "boolean") return BOOLEAN;
      return UNKNOWN;
    }
    case "TemplateLiteral":
      return STRING;
    case "UnaryExpression":
      return node.operator === "-" || node.operator === "+"
        ? NUMBER
        : node.operator === "!"
          ? BOOLEAN
          : known(node);
    case "ConditionalExpression":
      return union(widened(node.consequent, known), widened(node.alternate, known));
    case "LogicalExpression": {
      const left = known(node.left);
      const right = widened(node.right, known);
      if (node.operator === "&&") return union(falsyPart(left), right);
      return union(without(left, "null", "undefined"), right);
    }
    case "ArrayExpression": {
      const elements = node.elements.map((element) =>
        element === null
          ? UNDEFINED
          : element.type === "SpreadElement"
            ? elementsOf(widened(element.argument, known))
            : widened(element, known),
      );
      const element = elements.length ? union(...elements) : NOTHING;
      return arrayOf(() => element);
    }
    case "ObjectExpression": {
      const members = new Map<string, Member>();
      let spread = false;
      for (const property of node.properties) {
        if (property.type === "SpreadElement" || property.computed) {
          spread = true;
          continue;
        }
        const { key } = property;
        const name =
          key.type === "Identifier"
            ? key.name
            : key.type === "Literal" && typeof key.value === "string"
              ? key.value
              : undefined;
        if (name === undefined) continue;
        const value = property.method ? kinds("function") : widened(property.value, known);
        members.set(name, {
          kinds: () => value,
          optional: false,
          key: { start: key.start, end: key.end },
        });
      }
      return objectOf({ declared: false, members: () => (spread ? new Map() : members) });
    }
    case "TSSatisfiesExpression":
      return widened(node.expression, known);
    case "TSNonNullExpression":
      return without(widened(node.expression, known), "null", "undefined");
    default:
      return known(node);
  }
}

/**
 * The kinds TypeScript infers where it keeps a value's literals but widens the members of the
 * object and array literals in it: a `const`'s (`const step = 2` is `2`, `const tags = ["a"]` is
 * `string[]`) and a function's result.
 */
export function literalKinds(node: AST.Expression, known: (node: AST.Node) => Kinds): Kinds {
  switch (node.type) {
    case "ObjectExpression":
    case "ArrayExpression":
      return widened(node, known);
    case "ConditionalExpression":
      return union(literalKinds(node.consequent, known), literalKinds(node.alternate, known));
    default:
      return known(node);
  }
}

/** Whether an expression is a literal written in the source, which TypeScript reads as fresh. */
function fresh(node: AST.Expression): boolean {
  return (
    (node.type === "Literal" && typeof node.value !== "object") ||
    (node.type === "TemplateLiteral" && !node.expressions.length)
  );
}

/**
 * The kinds a function returns, as TypeScript infers its return type with no annotation
 * (ADR-0046): the union of what each `return` gives, where a single literal written in the source
 * widens (`() => "x"` returns `string`) and a union of literals stays (`c ? "a" : "b"`).
 */
export function returnedKinds(
  returned: readonly AST.Expression[],
  known: (node: AST.Node) => Kinds,
): Kinds {
  if (!returned.length) return UNDEFINED;
  const all = union(...returned.map((node) => literalKinds(node, known)));
  const unit =
    all.primitives.size === 1 &&
    (all.strings?.size ?? 0) + (all.numbers?.size ?? 0) + (all.booleans?.size ?? 0) === 1;
  return unit && returned.every(fresh) ? widened(returned[0]!, known) : all;
}

/** A `preventDefault()` or `stopPropagation()` call on a handler's event. */
export interface ControlCall {
  readonly call: AST.CallExpression;
  readonly method: "preventDefault" | "stopPropagation";
}

/** A control a function makes while its event is dispatched, and the statement that makes it. */
export interface ControlStatement extends ControlCall {
  /** The statement: an expression statement, the whole `if`, or an arrow's expression body. */
  readonly statement: Span;
  /** The `if`'s test, when the call is conditional. */
  readonly test?: AST.Expression;
}

/** A control that does not run as its event is dispatched, with why (UF3033). */
export interface DeferredControl extends ControlCall {
  readonly reason: string;
  /** Set where the control is in a function inside the handler, rather than after an `await`. */
  readonly inFunction?: true;
}

/**
 * What a statement at the top of a handler's body is to the statements after it (ADR-0047): a
 * guard clause (`if (test) return;`, or `throw`, with no `else`), after which they run only where
 * its test fails; another statement that may leave the body (a `return` or a `throw` in an `if`,
 * a `switch`, a `try` or a loop); or neither.
 */
type StatementExit =
  | { readonly kind: "none" }
  | { readonly kind: "guard"; readonly test: AST.Expression }
  | { readonly kind: "exit" };

/** What a statement at the top of a function's body is to the statements after it. */
function statementExit(statement: AST.Statement): StatementExit {
  if (
    statement.type === "IfStatement" &&
    !statement.alternate &&
    alwaysLeaves(statement.consequent)
  ) {
    return { kind: "guard", test: statement.test };
  }
  return mayLeave(statement) ? { kind: "exit" } : { kind: "none" };
}

/** Whether a statement always leaves the function: a `return`, a `throw`, or a block ending so. */
function alwaysLeaves(statement: AST.Statement): boolean {
  if (statement.type === "ReturnStatement" || statement.type === "ThrowStatement") return true;
  if (statement.type !== "BlockStatement") return false;
  const last = statement.body.at(-1);
  return last !== undefined && alwaysLeaves(last);
}

/**
 * Whether a statement may leave the function, outside the functions in it: a `return`, a
 * `throw` that no `catch` around it catches, or a labelled `break` or `continue` (the subset has
 * no labels, UF1002; a label still counts, to be safe).
 */
function mayLeave(node: unknown, caught = false): boolean {
  if (!node || typeof node !== "object") return false;
  if (Array.isArray(node)) return node.some((item) => mayLeave(item, caught));
  const typed = node as AST.Node;
  switch (typed.type) {
    case "ReturnStatement":
      return true;
    case "ThrowStatement":
      return !caught || mayLeave(typed.argument, caught);
    case "BreakStatement":
    case "ContinueStatement":
      return typed.label !== null;
    case "ArrowFunctionExpression":
    case "FunctionExpression":
    case "FunctionDeclaration":
    case "ClassDeclaration":
    case "ClassExpression":
      return false;
    case "TryStatement":
      return (
        mayLeave(typed.block, caught || typed.handler !== null) ||
        mayLeave(typed.handler, caught) ||
        mayLeave(typed.finalizer, caught)
      );
    default:
      return (visitorKeys[typed.type] ?? []).some((key) =>
        mayLeave((typed as unknown as Record<string, unknown>)[key], caught),
      );
  }
}

/**
 * The `preventDefault()` and `stopPropagation()` calls a function makes on its event (ADR-0047):
 * the leading ones, which the IR lists (`eventControls`), and those that run after the event is
 * dispatched, which no target can honour (UF3033). A leading control is a statement at the top of
 * the body before any `await`, or the sole statement under an `if` there without an `else` whose
 * test reads only the event, after no statement that may leave the body but a guard clause whose
 * test reads only the event (`if (event.key !== "Enter") return;`), which the control then runs
 * under, negated: Vue's modifiers and Qwik's markers read them. Every other control in the body
 * (beside other statements in an `if` block, in an `else if` branch or a `switch` case, after a
 * guard that reads state) runs while the event is dispatched too, on every target but Qwik, whose
 * codegen lifts what it can (`handlerControls`) and declares the rest (`conditional-event-control`).
 * A control after an `await`, or in a function inside the handler (a timer's, a promise's
 * continuation), runs once the event is over. `isEvent` tells the event parameter's identifier;
 * `body` is the function's block, or its expression body with where that is written. Codegen's
 * `eventCalls` judges the calls that pass the event on by the same leading rule.
 */
export function eventControlsOf(
  body: AST.BlockStatement | { node: AST.Expression; span: Span },
  isEvent: (identifier: AST.IdentifierReference) => boolean,
): { controls: ControlStatement[]; deferred: DeferredControl[] } {
  const controls: ControlStatement[] = [];
  const control = (node: AST.Node | null | undefined): ControlCall | undefined => {
    if (node?.type !== "CallExpression" || node.optional || node.arguments.length) return undefined;
    const { callee } = node;
    if (callee.type !== "MemberExpression" || callee.computed || callee.optional) return undefined;
    if (callee.object.type !== "Identifier" || !isEvent(callee.object)) return undefined;
    const name = callee.property.type === "Identifier" ? callee.property.name : "";
    return name === "preventDefault" || name === "stopPropagation"
      ? { call: node, method: name }
      : undefined;
  };
  const statementCall = (statement: AST.Statement | null | undefined) =>
    statement?.type === "ExpressionStatement" ? control(statement.expression) : undefined;
  const eventOnly = (test: AST.Expression) =>
    readIdentifiers(test).every((identifier) => isEvent(identifier));
  if ("type" in body) {
    // Past a statement that may leave the body on more than the event, a control is no longer
    // a leading one.
    let blocked = false;
    for (const statement of body.body) {
      if (statement.type === "EmptyStatement") continue;
      const direct = statementCall(statement);
      let found: ControlStatement | undefined;
      if (direct) {
        found = { ...direct, statement: span(statement) };
      } else if (statement.type === "IfStatement" && !statement.alternate) {
        const { consequent } = statement;
        const inner =
          consequent.type === "BlockStatement"
            ? consequent.body.length === 1
              ? statementCall(consequent.body[0])
              : undefined
            : statementCall(consequent);
        if (inner && eventOnly(statement.test)) {
          found = { ...inner, statement: span(statement), test: statement.test };
        }
      }
      if (found && !blocked) controls.push(found);
      if (awaits(statement)) break;
      if (blocked) continue;
      // A guard clause on the event leaves what follows dispatched, under its negated test,
      // which codegen's `handlerControls` reads from the body.
      const exit = statementExit(statement);
      if ((exit.kind === "guard" && !eventOnly(exit.test)) || exit.kind === "exit") {
        blocked = true;
      }
    }
  } else {
    const direct = control(body.node);
    if (direct) controls.push({ ...direct, statement: body.span });
  }
  const deferred: DeferredControl[] = [];
  const visit = (node: unknown, inFunction: boolean, afterAwait: { value: boolean }): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, inFunction, afterAwait);
      return;
    }
    const typed = node as AST.Node;
    const found = control(typed);
    if (found && inFunction) {
      deferred.push({
        ...found,
        reason: "it is in a function inside the handler, which may run once the event is over",
        inFunction: true,
      });
    } else if (found && afterAwait.value) {
      deferred.push({
        ...found,
        reason: "it runs after an `await`, once the event has been dispatched",
      });
    }
    const nested =
      typed.type === "ArrowFunctionExpression" ||
      typed.type === "FunctionExpression" ||
      typed.type === "FunctionDeclaration";
    for (const key of visitorKeys[typed.type] ?? []) {
      // A `for await` loop's body runs once the first value has been awaited.
      if (key === "body" && typed.type === "ForOfStatement" && typed.await && !inFunction) {
        afterAwait.value = true;
      }
      visit((typed as unknown as Record<string, unknown>)[key], inFunction || nested, afterAwait);
    }
    if (typed.type === "AwaitExpression" && !inFunction) afterAwait.value = true;
  };
  if ("type" in body) {
    const afterAwait = { value: false };
    for (const statement of body.body) visit(statement, false, afterAwait);
  } else {
    visit(body.node, false, { value: false });
  }
  return { controls, deferred };
}

/** A node's span. */
function span(node: { start: number; end: number }): Span {
  return { start: node.start, end: node.end };
}

/** Whether a statement awaits, outside the functions in it. */
function awaits(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  if (Array.isArray(node)) return node.some(awaits);
  const typed = node as AST.Node;
  if (typed.type === "AwaitExpression") return true;
  if (
    typed.type === "ArrowFunctionExpression" ||
    typed.type === "FunctionExpression" ||
    typed.type === "FunctionDeclaration"
  ) {
    return false;
  }
  if (typed.type === "ForOfStatement" && typed.await) return true;
  return (visitorKeys[typed.type] ?? []).some((key) =>
    awaits((typed as unknown as Record<string, unknown>)[key]),
  );
}

/** The node types that wrap an expression with a type, which reads no name (`x as T`, `x!`). */
const TYPED_EXPRESSIONS: ReadonlySet<string> = new Set([
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "TSTypeAssertion",
  "TSInstantiationExpression",
]);

/** The keys of a node that hold types, which read no name. */
const TYPE_KEYS: ReadonlySet<string> = new Set([
  "typeAnnotation",
  "typeArguments",
  "typeParameters",
  "returnType",
]);

/**
 * The identifiers an expression reads as names: not a member's name after `.`, nor an object
 * literal's key, nor a name in a type (`event.target as HTMLInputElement` reads only `event`).
 */
export function readIdentifiers(node: unknown): AST.IdentifierReference[] {
  const found: AST.IdentifierReference[] = [];
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    const typed = value as AST.Node;
    if (typed.type === "Identifier") {
      found.push(typed as AST.IdentifierReference);
      return;
    }
    if (typed.type === "MemberExpression") {
      visit(typed.object);
      if (typed.computed) visit(typed.property);
      return;
    }
    if (typed.type === "Property") {
      if (typed.computed || typed.shorthand) visit(typed.key);
      if (!typed.shorthand) visit(typed.value);
      return;
    }
    if (TYPED_EXPRESSIONS.has(typed.type)) {
      visit((typed as unknown as { expression: unknown }).expression);
      return;
    }
    if (typed.type.startsWith("TS")) return;
    for (const key of visitorKeys[typed.type] ?? []) {
      if (!TYPE_KEYS.has(key)) visit((typed as unknown as Record<string, unknown>)[key]);
    }
  };
  visit(node);
  return found;
}
