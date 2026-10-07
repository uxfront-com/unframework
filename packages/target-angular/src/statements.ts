// An arrow's expression body as the statements a method or a hook runs, when the Angular output
// moves it out of the arrow (a handler, a lifecycle hook, `watchEffect`): its value is dropped, as
// every target drops a handler's value, so only what changes something stays. A logical or
// conditional expression that only runs what one side does becomes the `if` it stands for
// (`event.key === "Escape" && clear()` → `if (event.key === "Escape") clear();`), and a side, an
// operand or a whole expression that changes nothing goes (`c ? save() : false` →
// `if (c) save();`), which a reader and the L5 baseline (`no-unused-expressions`) expect of a
// statement. A block body the output moves returns nothing either (`withoutValues`).
//
// What changes something is judged on the class code, where the source's reads of a signal, an
// input, a derived value or a template ref are calls of their members (`this.count()`,
// `this.field()?.nativeElement`): those calls are reads, as the source's `count.value` is; every
// other call may change something.
import { functionBodyText, parseExpression, parseStatementsSource } from "@unframework/codegen";
import type { RewriteRules } from "@unframework/codegen";
import type { FunctionCode } from "@unframework/ir";

import { isSignal } from "./plan.ts";
import type { Plan } from "./plan.ts";
import { tidied } from "./rules.ts";

interface Node {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

/**
 * A function's body as statements, its value dropped (see the module's comment): a block body's
 * own `return`s give none (`withoutValues`), since Angular calls what the output moves it to (a
 * method, a hook, an effect) for no value, and a value on some paths only fails
 * `noImplicitReturns`.
 */
export function bodyStatements(fn: FunctionCode, plan: Plan, rules: RewriteRules): string {
  const body = functionBodyText(fn, plan.component, rules, "client", { discard: true });
  if (!fn.expression) {
    return tidied(returnsValue(fn) ? withoutValues(body, plan) : body, "statements");
  }
  const code = body.replace(/;$/, "");
  return tidied(
    effectsOf(parseExpression(code) as unknown as Node, code, reads(plan)),
    "statements",
  );
}

/**
 * The members whose call reads a value and changes nothing: the signals (inputs, states,
 * derived values, setup-once constants) and the template refs' queries.
 */
function reads(plan: Plan): ReadonlySet<string> {
  const names = new Set<string>();
  for (const binding of plan.component.bindings) {
    const form = plan.forms.get(binding.id);
    if (form !== undefined && (isSignal(form) || form === "query")) names.add(binding.name);
  }
  return names;
}

/**
 * The statements that run what an expression in `code` changes, its value dropped, or `""` when
 * it changes nothing. A side of `&&`, `||` or `??` that changes something runs under the test its
 * operator makes; a branch of `?:` that does, under the condition. An operand, an element or a
 * member read that changes nothing goes, and the parts that do run in their order.
 */
function effectsOf(node: Node, code: string, members: ReadonlySet<string>): string {
  if (!hasEffects(node, members)) return "";
  const text = (part: unknown) => code.slice((part as Node).start, (part as Node).end);
  const of = (part: unknown) => effectsOf(part as Node, code, members);
  const all = (parts: readonly unknown[]) => parts.map(of).filter(Boolean).join("\n");
  switch (node.type) {
    case "LogicalExpression": {
      const right = of(node.right);
      if (right === "") return of(node.left);
      const left = text(node.left);
      const test =
        node.operator === "&&" ? left : node.operator === "||" ? `!(${left})` : `(${left}) == null`;
      return `if (${test}) ${branch(right)}`;
    }
    case "ConditionalExpression": {
      const consequent = of(node.consequent);
      const alternate = of(node.alternate);
      const test = text(node.test);
      if (consequent === "" && alternate === "") return of(node.test);
      if (alternate === "") return `if (${test}) ${branch(consequent)}`;
      if (consequent === "") return `if (!(${test})) ${branch(alternate)}`;
      // A consequent that is an `if` of its own is braced: the `else` would be its.
      return `if (${test}) ${branch(consequent, true)} else ${branch(alternate)}`;
    }
    case "SequenceExpression":
      return all(node.expressions as Node[]);
    case "BinaryExpression":
      return all([node.left, node.right]);
    case "UnaryExpression":
      return node.operator === "delete" ? `${text(node)};` : of(node.argument);
    case "MemberExpression":
      return all(node.computed ? [node.object, node.property] : [node.object]);
    case "TemplateLiteral":
      return all(node.expressions as Node[]);
    case "ArrayExpression":
      return all((node.elements as (Node | null)[]).filter((element) => element !== null));
    case "SpreadElement":
      return of(node.argument);
    case "ObjectExpression":
      return all(
        (node.properties as Node[]).flatMap((property) =>
          property.type === "SpreadElement"
            ? [property]
            : property.computed
              ? [property.key, property.value]
              : [property.value],
        ),
      );
    case "TSAsExpression":
    case "TSSatisfiesExpression":
    case "TSNonNullExpression":
    case "TSTypeAssertion":
    case "TSInstantiationExpression":
      return of(node.expression);
    case "ChainExpression":
      // An optional chain runs its parts only as far as it gets, so it stays whole: one that ends
      // in a call is a statement as it stands, one that ends in a member read drops it by `void`.
      return (node.expression as Node).type === "CallExpression"
        ? `${text(node)};`
        : `void ${text(node)};`;
    default: {
      const statement = text(node);
      return `${/^(?:\{|function\b|class\b|let\s*\[)/.test(statement) ? `(${statement})` : statement};`;
    }
  }
}

/** Statements as an `if`'s branch: braced when there are several, or when an `else` follows an `if`. */
function branch(statements: string, beforeElse = false): string {
  return statements.includes("\n") || (beforeElse && statements.startsWith("if "))
    ? `{\n${statements}\n}`
    : statements;
}

/** The nodes that start a function: code inside one is not the handler's own. */
const FUNCTIONS = new Set([
  "ArrowFunctionExpression",
  "FunctionExpression",
  "FunctionDeclaration",
  "ClassDeclaration",
  "ClassExpression",
]);

/** The expressions that may change something when they run. */
const EFFECTS = new Set([
  "CallExpression",
  "NewExpression",
  "AssignmentExpression",
  "UpdateExpression",
  "AwaitExpression",
  "YieldExpression",
  "TaggedTemplateExpression",
  "ImportExpression",
]);

/**
 * Whether a function may return a value: an expression body, or a `return` with an argument in
 * its own body (not in a function inside it).
 */
export function returnsValue(fn: FunctionCode): boolean {
  return fn.expression === true || ownReturns(fn.body.code, true);
}

/** Whether a function's block body has a `return` of its own (not in a function inside it). */
export function hasReturn(fn: FunctionCode): boolean {
  return fn.expression !== true && ownReturns(fn.body.code, false);
}

/** Whether a body has a `return` of its own, with an argument when `valued`. */
function ownReturns(code: string, valued: boolean): boolean {
  let found = false;
  const visit = (value: unknown): void => {
    if (found) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!isNode(value) || FUNCTIONS.has(value.type)) return;
    if (value.type === "ReturnStatement" && (!valued || value.argument !== null)) {
      found = true;
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (key !== "type" && typeof child === "object") visit(child);
    }
  };
  visit(parseStatementsSource(code).statements);
  return found;
}

/**
 * A moved body's statements, its own `return`s giving no value: Angular prevents the event when
 * a listener's value is `false`, and a method that returns a value on some paths only fails
 * `noImplicitReturns`. `return false;` becomes `return;`, `return save();` becomes `save();
 * return;` (in a block where it stood alone), and the body's last `return x;` keeps only what
 * runs (`save();`, or nothing for `return count.value > 0;`).
 */
function withoutValues(code: string, plan: Plan): string {
  const members = reads(plan);
  const { statements } = parseStatementsSource(code);
  const last = statements.at(-1) as unknown as Node | undefined;
  const edits: { start: number; end: number; text: string }[] = [];
  /** Visits a statement; `listed` when it stands in a list of statements, not alone. */
  const visit = (value: unknown, listed: boolean): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item, listed);
      return;
    }
    if (!isNode(value) || FUNCTIONS.has(value.type)) return;
    if (value.type === "ReturnStatement") {
      const argument = value.argument as Node | null;
      if (argument === null) return;
      const runs = effectsOf(argument, code, members);
      const replaced = value === last ? runs : runs === "" ? "return;" : `${runs}\nreturn;`;
      edits.push({
        start: value.start,
        end: value.end,
        text: listed || runs === "" ? replaced : `{\n${replaced}\n}`,
      });
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === "type" || typeof child !== "object") continue;
      // A block's and a case's statements are lists; an `if`'s branch or a loop's body stands alone.
      visit(child, Array.isArray(child));
    }
  };
  visit(statements, true);
  let result = code;
  for (const { start, end, text: replacement } of edits.toSorted((a, b) => b.start - a.start)) {
    result = `${result.slice(0, start)}${replacement}${result.slice(end)}`;
  }
  return result.trim();
}

/**
 * Whether an expression may change something when it runs (code inside a function aside): a
 * call of a member `members` names, with no arguments, only reads.
 */
function hasEffects(node: Node, members: ReadonlySet<string>): boolean {
  let found = false;
  const visit = (value: unknown): void => {
    if (found) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!isNode(value) || FUNCTIONS.has(value.type)) return;
    if (
      (EFFECTS.has(value.type) && !isRead(value, members)) ||
      (value.type === "UnaryExpression" && value.operator === "delete")
    ) {
      found = true;
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (key !== "type" && typeof child === "object") visit(child);
    }
  };
  visit(node);
  return found;
}

/** Whether a node is the class code's read of a signal or a query: `this.count()`. */
function isRead(node: Node, members: ReadonlySet<string>): boolean {
  if (node.type !== "CallExpression" || (node.arguments as unknown[]).length > 0) return false;
  const callee = node.callee as Node;
  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    (callee.object as Node).type === "ThisExpression" &&
    members.has((callee.property as Node).name as string)
  );
}

function isNode(value: unknown): value is Node {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Node).type === "string" &&
    typeof (value as Node).start === "number"
  );
}
