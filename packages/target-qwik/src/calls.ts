// Calls of the setup's functions that are QRLs (ADR-0045): a function a `$`
// scope reaches is a `$()` QRL, and calling a QRL returns a promise, which the call awaits so
// that what follows it sees what it did (read after write). An awaited call makes its function
// async. The code is the target's own rewritten text; this finds the calls in its syntax tree
// and splices `await` in, as the rewrite engine splices references.
import { parseCodeSource } from "@unframework/codegen";
import type { CodeKind } from "@unframework/codegen";

/** A node of oxc's syntax tree, as far as this walk reads it. */
interface Node {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

/** What {@link awaitQrlCalls} returns. */
export interface AwaitedCode {
  /** The code with `await` before each call of a QRL, and `async` on each function it is in. */
  code: string;
  /** Whether a call is awaited directly in the code's own function, which must then be async. */
  async: boolean;
}

/**
 * Awaits every call of a QRL in a function's body (`kind` `statements` for a block, `expression`
 * for an arrow's expression body): `save()` becomes `await save()`, and `(await total()).toFixed()`
 * where the result is an operand. A nested arrow that makes such a call becomes `async`; the
 * body's own function is reported in `async`. An expression body that is the call itself stays as
 * it is: the arrow returns the call's promise, which its caller awaits. A call of a function that
 * returns a promise (`promiseQrls`: an `async` one, or one that returns `new Promise(…)`) is that
 * promise, awaited only where the source awaits it: elsewhere it is the value the source uses
 * (`ask().then(…)`, `const pending = ask()`), the caller going on before the callee's
 * continuation as it does on the source's semantics, and a call that is a statement of its own
 * floats, `void run()`.
 */
export function awaitQrlCalls(
  code: string,
  kind: CodeKind,
  qrls: ReadonlySet<string>,
  promiseQrls: ReadonlySet<string> = new Set(),
): AwaitedCode {
  if (qrls.size === 0 || ![...qrls].some((name) => code.includes(name))) {
    return { code, async: false };
  }
  const { root } = parseCodeSource(code, kind);
  const edits: { at: number; text: string }[] = [];
  let ownAsync = false;
  const asyncArrows = new Set<Node>();
  const visit = (node: unknown, ancestors: readonly Node[]): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item, ancestors);
      return;
    }
    if (!isNode(node)) return;
    if (
      isQrlCall(node, promiseQrls) &&
      !awaited(ancestors) &&
      !(kind === "expression" && returned(node, ancestors, root))
    ) {
      if (ancestors.at(-1)?.type === "ExpressionStatement") {
        edits.push({ at: node.start, text: "void " });
      }
    } else if (
      isQrlCall(node, qrls) &&
      !awaited(ancestors) &&
      !(kind === "expression" && returned(node, ancestors, root))
    ) {
      const parent = ancestors.at(-1);
      const wrap = parent !== undefined && needsParentheses(node, parent);
      edits.push({ at: node.start, text: wrap ? "(await " : "await " });
      if (wrap) edits.push({ at: node.end, text: ")" });
      const fn = ancestors.findLast((ancestor) => isFunction(ancestor));
      if (fn) asyncArrows.add(fn);
      else ownAsync = true;
    }
    const next = [...ancestors, node];
    for (const [key, value] of Object.entries(node)) {
      if (key !== "type" && key !== "parent" && typeof value === "object") visit(value, next);
    }
  };
  visit(root, []);
  for (const fn of asyncArrows) {
    if (fn.async !== true) edits.push({ at: fn.start, text: "async " });
  }
  let result = code;
  for (const { at, text } of edits.toSorted((a, b) => b.at - a.at)) {
    result = `${result.slice(0, at)}${text}${result.slice(at)}`;
  }
  return { code: result, async: ownAsync };
}

function isNode(value: unknown): value is Node {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Node).type === "string" &&
    typeof (value as Node).start === "number"
  );
}

function isFunction(node: Node): boolean {
  return node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression";
}

/** A call whose callee is the name of a QRL: `save()`, `save?.()` is not one (a QRL is defined). */
function isQrlCall(node: Node, qrls: ReadonlySet<string>): boolean {
  if (node.type !== "CallExpression") return false;
  const callee = node.callee as Node;
  return callee.type === "Identifier" && qrls.has(callee.name as string);
}

/** Whether the nearest enclosing expression already awaits the call. */
function awaited(ancestors: readonly Node[]): boolean {
  const parent = ancestors.at(-1);
  return parent?.type === "AwaitExpression";
}

/**
 * Whether an expression body returns the call's promise as it is: the body is the call, or the
 * call is the body's value through `a && call`, `a ? call : b` or `a, call` (parentheses are not
 * in oxc's tree). The arrow's caller awaits what it returns, so the call stays as written.
 */
function returned(node: Node, ancestors: readonly Node[], root: unknown): boolean {
  let child: Node = node;
  for (let index = ancestors.length - 1; index >= 0; index--) {
    const parent = ancestors[index]!;
    const tail =
      (parent.type === "LogicalExpression" && parent.right === child) ||
      (parent.type === "ConditionalExpression" && parent.test !== child) ||
      (parent.type === "SequenceExpression" && (parent.expressions as Node[]).at(-1) === child);
    if (!tail) return false;
    child = parent;
  }
  return child === root;
}

/**
 * Whether `await call` needs parentheses in its parent: where the call is a member's object, a
 * callee, a tag, a `new`'s callee, a non-null assertion's operand, the left of `**`, or in an
 * optional chain, the `await` would bind to more than the call.
 */
function needsParentheses(node: Node, parent: Node): boolean {
  switch (parent.type) {
    case "MemberExpression":
      return parent.object === node;
    case "CallExpression":
    case "NewExpression":
      return parent.callee === node;
    case "TaggedTemplateExpression":
      return parent.tag === node;
    case "ChainExpression":
    case "TSNonNullExpression":
      return true;
    case "BinaryExpression":
      return parent.operator === "**" && parent.left === node;
    default:
      return false;
  }
}

/**
 * Passes Qwik's element argument on: in each call of a function that takes it (`callees`), the
 * argument after the event (`pick(item, event)` → `pick(item, event, element)`), as the function
 * takes it after its event parameter.
 */
export function passElement(
  code: string,
  kind: CodeKind,
  callees: ReadonlySet<string>,
  event: string,
  element: string,
): string {
  if (callees.size === 0 || ![...callees].some((name) => code.includes(name))) return code;
  const { root } = parseCodeSource(code, kind);
  const at: number[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (!isNode(node)) return;
    if (isQrlCall(node, callees)) {
      const argument = (node.arguments as Node[]).find(
        (candidate) => candidate.type === "Identifier" && candidate.name === event,
      );
      if (argument) at.push(argument.end);
    }
    for (const [key, value] of Object.entries(node)) {
      if (key !== "type" && key !== "parent" && typeof value === "object") visit(value);
    }
  };
  visit(root);
  let result = code;
  for (const offset of at.toSorted((a, b) => b - a)) {
    result = `${result.slice(0, offset)}, ${element}${result.slice(offset)}`;
  }
  return result;
}
