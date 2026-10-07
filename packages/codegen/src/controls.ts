// Where a handler's event controls run (ADR-0047). A target that runs `preventDefault()` and
// `stopPropagation()` apart from the handler, as the event is dispatched (Qwik: the element's
// `preventdefault:<event>` and a `sync$` handler), can do it for a control at the top of the
// handler only, where moving it before the rest of the handler changes nothing the handler does:
// its body's leading statements, each a control, an `if` without `else` whose test reads only the
// event around one control or one call, a call that makes a control, or a guard clause whose test
// reads only the event (`if (event.key !== "Enter") return;`, whose test the controls after it run
// under, negated). A test that reads what a control changes (`event.defaultPrevented`) is no such
// test: another listener's control, or the lifted control itself, changes it. The same holds
// through the local functions the handler passes its event to: a call at the top of the handler
// runs the callee's top under the call's tests, the `if`'s and those of `&&`, `||` and `?:` around
// it (`void` and type assertions are read through). Any other control (after another statement,
// under a test of state, in an `else` or a `switch`, after an `await`, in a callback) is
// `unliftable`, and so is every control after a read of what a control changes: that is the
// `conditional-event-control` capability. A local function that client code hands to a call as a
// value (`addEventListener("keydown", onKey)`), or calls from anywhere but a template listener's
// top, runs its controls as a target's local functions run, which on Qwik is later: that is the
// capability too (`handedControls`).
import type * as AST from "@oxc-project/types";
import type {
  BindingId,
  Code,
  CodeReference,
  EventControl,
  FunctionCode,
  Span,
  UfComponent,
} from "@unframework/ir";
import { functionsOf } from "@unframework/ir";
import { visitorKeys } from "@unframework/parser";

import { parseCodeSource } from "./parse.ts";

/** A test a control or a call runs under: it runs where the test holds, or where it fails. */
export interface ControlTest {
  /** Code of the function the test is written in, which reads only that function's event. */
  test: Code;
  /** Set where it runs only where the test fails: a guard clause's, `||`'s, `?:`'s alternate. */
  negated?: true;
}

/** A call of a local function that takes the event, made by a function that has one. */
export interface EventCall {
  /** The function called. */
  binding: BindingId;
  /** The callee's reference. */
  span: Span;
  /** Whether the call is at the top of the body (see the module comment). */
  dispatched: boolean;
  /** For a dispatched call, the tests it runs under, outermost first (absent when none). */
  tests?: ControlTest[];
}

/** A control a handler makes while its event is dispatched: its own, or a function's it calls. */
export interface LiftedControl {
  /** The function whose body makes the control. */
  fn: FunctionCode;
  /**
   * The control: its statement (the expression statement, or the whole `if` it is the only
   * statement of, whose test is its `condition`), at offsets in the source.
   */
  control: EventControl;
  /**
   * The tests it runs under, outermost first, each with the function it is written in: those of
   * each call it is reached through, then the guard clauses before it. Its `condition` is not
   * among them.
   */
  tests: (ControlTest & { fn: FunctionCode })[];
}

/** What {@link handlerControls} finds. */
export interface HandlerControls {
  /** The controls that run while the event is dispatched, in the order they run. */
  controls: LiftedControl[];
  /** The controls, and the calls of functions that make one, that cannot run then. */
  unliftable: Span[];
}

/** The members of an event that a control changes: a test that reads one is no test of the event. */
const CHANGED_MEMBERS: ReadonlySet<string> = new Set([
  "defaultPrevented",
  "cancelBubble",
  "returnValue",
]);

/** A test at the top of a function's body, as its node. */
interface TopTest {
  node: AST.Expression;
  negated?: true;
}

/** What runs at the top of a function's body: a control, or a call of a local function. */
type TopItem =
  | {
      kind: "control";
      method: EventControl["method"];
      /** The control's call. */
      call: AST.Node;
      /** The statement to take out of the handler: the control's, or the `if`'s around it. */
      statement: AST.Node;
      condition?: AST.Expression;
      tests: TopTest[];
    }
  | { kind: "call"; callee: AST.Node; tests: TopTest[] };

/** The name of a function's event parameter, as the IR marks it. */
function eventName(fn: FunctionCode): string | undefined {
  return fn.parameters.find((parameter) => parameter.event !== undefined)?.name;
}

/** A node of a function's body as its code, with the body's references inside it. */
function bodyCode(fn: FunctionCode, node: { start: number; end: number }): Code {
  const { code, span } = fn.body;
  const start = span.start + node.start;
  const end = span.start + node.end;
  return {
    code: code.slice(node.start, node.end),
    span: { start, end },
    refs: fn.body.refs.filter((each) => each.span.start >= start && each.span.end <= end),
  };
}

/**
 * The top of a function's body (see the module comment), in order: its controls on `event` and
 * its calls whose callee `topCall` accepts (by the callee's offset in the body), each with the
 * tests it runs under.
 */
function topOf(
  fn: FunctionCode,
  event: string | undefined,
  topCall: (offset: number) => boolean,
): TopItem[] {
  const items: TopItem[] = [];
  if (event === undefined) return items;
  const eventOnly = (test: AST.Node) => readsOnly(test, event) && !readsChanged(test, event);
  // A call form (`f(event)`, `void f(event)`, `test && f(event)`, `test ? f(event) : g()`): its
  // calls that `topCall` accepts, under their tests, and whether it does nothing else.
  const form = (node: AST.Node, tests: TopTest[]): { calls: TopItem[]; only: boolean } => {
    const inner = unwrapped(node);
    if (
      inner.type === "CallExpression" &&
      !inner.optional &&
      inner.callee.type === "Identifier" &&
      topCall(inner.callee.start)
    ) {
      return { calls: [{ kind: "call", callee: inner.callee, tests }], only: true };
    }
    if (
      inner.type === "LogicalExpression" &&
      (inner.operator === "&&" || inner.operator === "||") &&
      eventOnly(inner.left)
    ) {
      const negated = inner.operator === "||" ? { negated: true as const } : {};
      return form(inner.right, [...tests, { node: inner.left, ...negated }]);
    }
    if (inner.type === "ConditionalExpression" && eventOnly(inner.test)) {
      const consequent = form(inner.consequent, [...tests, { node: inner.test }]);
      const alternate = form(inner.alternate, [...tests, { node: inner.test, negated: true }]);
      return {
        calls: [...consequent.calls, ...alternate.calls],
        only: consequent.only && alternate.only,
      };
    }
    return { calls: [], only: isInert(inner) };
  };
  const control = (node: AST.Node | null | undefined) => {
    const inner = node ? unwrapped(node) : undefined;
    const method = controlOn(inner, event);
    return method && inner ? { method, call: inner } : undefined;
  };
  if (fn.expression) {
    const root = parseCodeSource(fn.body.code, "expression").root as AST.Expression;
    const own = control(root);
    if (own) {
      items.push({ kind: "control", ...own, statement: root, tests: [] });
    } else {
      items.push(...form(root, []).calls);
    }
    return items;
  }
  const [block] = parseCodeSource(fn.body.code, "statements").root as AST.Statement[];
  const guards: TopTest[] = [];
  for (const statement of block?.type === "BlockStatement" ? block.body : []) {
    if (statement.type === "EmptyStatement") continue;
    if (statement.type === "ExpressionStatement") {
      const own = control(statement.expression);
      if (own) {
        items.push({ kind: "control", ...own, statement, tests: [...guards] });
        continue;
      }
      const { calls, only } = form(statement.expression, [...guards]);
      items.push(...calls);
      if (calls.length && only && !awaits(statement)) continue;
      break;
    }
    if (statement.type !== "IfStatement" || statement.alternate || !eventOnly(statement.test)) {
      break;
    }
    const { consequent } = statement;
    const inner =
      consequent.type === "BlockStatement"
        ? consequent.body.length === 1
          ? consequent.body[0]
          : undefined
        : consequent;
    if (inner?.type === "ExpressionStatement") {
      const own = control(inner.expression);
      if (own) {
        items.push({
          kind: "control",
          ...own,
          statement,
          condition: statement.test,
          tests: [...guards],
        });
        continue;
      }
      const { calls, only } = form(inner.expression, [...guards, { node: statement.test }]);
      items.push(...calls);
      if (calls.length && only && !awaits(statement)) continue;
      break;
    }
    if (!alwaysLeaves(consequent)) break;
    guards.push({ node: statement.test, negated: true });
  }
  return items;
}

/** An expression without the wrappers that change nothing it runs: `void`, `await`, `as`, `!`. */
function unwrapped(node: AST.Node): AST.Node {
  let current = node;
  for (;;) {
    if (TYPED_EXPRESSIONS.has(current.type)) {
      current = (current as unknown as { expression: AST.Node }).expression;
    } else if (
      (current.type === "UnaryExpression" && current.operator === "void") ||
      current.type === "AwaitExpression"
    ) {
      current = current.argument;
    } else {
      return current;
    }
  }
}

/** Whether an expression does nothing: a literal, `undefined`, a template without expressions. */
function isInert(node: AST.Node): boolean {
  return (
    node.type === "Literal" ||
    (node.type === "Identifier" && node.name === "undefined") ||
    (node.type === "TemplateLiteral" && node.expressions.length === 0)
  );
}

/**
 * The calls a function makes of the local functions that take an event (`takesEvent`), each
 * with whether it is at the top of the body and the tests it runs under there (see
 * {@link EventCall}), in source order.
 */
export function eventCalls(
  fn: FunctionCode,
  takesEvent: (binding: BindingId) => boolean,
): EventCall[] {
  const base = fn.body.span.start;
  const references = new Map<number, { binding: BindingId; span: Span }>();
  for (const reference of fn.body.refs) {
    if (reference.kind === "Binding" && reference.call === true && takesEvent(reference.binding)) {
      references.set(reference.span.start - base, reference);
    }
  }
  if (!references.size) return [];
  const top = new Map<number, TopTest[]>();
  for (const item of topOf(fn, eventName(fn), (offset) => references.has(offset))) {
    if (item.kind === "call") top.set(item.callee.start, item.tests);
  }
  return [...references].map(([offset, reference]) => {
    const tests = top.get(offset);
    return {
      binding: reference.binding,
      span: reference.span,
      dispatched: tests !== undefined,
      ...(tests?.length ? { tests: tests.map((each) => controlTest(fn, each)) } : {}),
    };
  });
}

/** A test at the top of a function's body as its code. */
function controlTest(fn: FunctionCode, test: TopTest): ControlTest {
  return { test: bodyCode(fn, test.node), ...(test.negated ? { negated: true as const } : {}) };
}

/** The setup's local functions, by binding. */
function localFunctions(component: UfComponent): Map<BindingId, FunctionCode> {
  const functions = new Map<BindingId, FunctionCode>();
  for (const item of component.setup) {
    if (item.kind === "Function") functions.set(item.binding, item.function);
  }
  return functions;
}

/**
 * The event controls a handler makes while its event is dispatched (see the module comment): its
 * own at the top of its body, and those of the functions it calls there, which it passes its
 * event, under the calls' tests; and every other control, own or through a call, as
 * `unliftable`.
 */
export function handlerControls(fn: FunctionCode, component: UfComponent): HandlerControls {
  const functions = localFunctions(component);
  const makers = controlMakers(functions);
  const controls: LiftedControl[] = [];
  const unliftable: Span[] = [];
  // Whether code before the next control reads what a control changes: it then reads it after
  // the lifted control, where the handler read it before.
  let changed = false;
  const visit = (
    each: FunctionCode,
    tests: LiftedControl["tests"],
    seen: ReadonlySet<FunctionCode>,
  ) => {
    const event = eventName(each);
    const base = each.body.span.start;
    const callees = new Map<number, { binding: BindingId; span: Span }>();
    for (const reference of each.body.refs) {
      if (
        reference.kind === "Binding" &&
        reference.call === true &&
        makers.has(reference.binding)
      ) {
        callees.set(reference.span.start - base, reference);
      }
    }
    const handled = new Set<number>();
    for (const item of topOf(each, event, (offset) => callees.has(offset))) {
      const written = [
        ...tests,
        ...item.tests.map((test) => ({ fn: each, ...controlTest(each, test) })),
      ];
      if (item.kind === "control") {
        handled.add(item.call.start);
        if (changed) {
          unliftable.push({ start: base + item.call.start, end: base + item.call.end });
          continue;
        }
        controls.push({
          fn: each,
          control: {
            method: item.method,
            span: { start: base + item.statement.start, end: base + item.statement.end },
            ...(item.condition ? { condition: bodyCode(each, item.condition) } : {}),
          },
          tests: written,
        });
        continue;
      }
      handled.add(item.callee.start);
      const callee = functions.get(callees.get(item.callee.start)!.binding)!;
      if (!seen.has(callee)) visit(callee, written, new Set([...seen, callee]));
    }
    // Every other control, and every other call of a function that makes one, runs apart. A
    // function whose event the IR does not mark has no top: its controls are read by its
    // parameters' names.
    const names =
      event !== undefined
        ? [event]
        : each.parameters.flatMap((parameter) =>
            parameter.name === undefined ? [] : [parameter.name],
          );
    const body = parsedBody(each);
    visitNodes(body, (node) => {
      if (names.some((name) => controlOn(node, name)) && !handled.has(node.start)) {
        unliftable.push({ start: base + node.start, end: base + node.end });
      }
    });
    for (const [offset, reference] of callees) {
      if (!handled.has(offset)) unliftable.push(reference.span);
    }
    if (names.some((name) => readsChanged(body, name))) changed = true;
  };
  visit(fn, [], new Set([fn]));
  return { controls, unliftable: unliftable.toSorted((a, b) => a.start - b.start) };
}

/**
 * A function's own controls that a target runs apart from it, as its handler or as a function a
 * handler passes its event to (see {@link handlerControls}): the statements a target takes out of
 * its body. Every other control of a function a handler reaches is `unliftable` there.
 */
export function ownControls(fn: FunctionCode, component: UfComponent): EventControl[] {
  return handlerControls(fn, component).controls.flatMap((lifted) =>
    lifted.fn === fn ? [lifted.control] : [],
  );
}

/**
 * The local functions that make a control on what they are given: a `preventDefault()` or a
 * `stopPropagation()` call on one of their parameters, read by its name, or a call that passes
 * one of them to such a function.
 */
function controlMakers(functions: ReadonlyMap<BindingId, FunctionCode>): Set<BindingId> {
  const makers = new Set<BindingId>();
  const passes = new Map<BindingId, BindingId[]>();
  for (const [id, fn] of functions) {
    const names = fn.parameters.flatMap((parameter) =>
      parameter.name === undefined ? [] : [parameter.name],
    );
    if (!names.length) continue;
    const body = parsedBody(fn);
    let own = false;
    const callees: BindingId[] = [];
    const base = fn.body.span.start;
    const references = new Map<number, BindingId>();
    for (const reference of fn.body.refs) {
      if (
        reference.kind === "Binding" &&
        reference.call === true &&
        functions.has(reference.binding)
      ) {
        references.set(reference.span.start - base, reference.binding);
      }
    }
    visitNodes(body, (node) => {
      if (names.some((name) => controlOn(node, name))) own = true;
      if (node.type !== "CallExpression" || node.callee.type !== "Identifier") return;
      const callee = references.get(node.callee.start);
      const passed = node.arguments.some((argument) => {
        const inner = unwrapped(argument);
        return inner.type === "Identifier" && names.includes(inner.name);
      });
      if (callee !== undefined && passed) callees.push(callee);
    });
    if (own) makers.add(id);
    passes.set(id, callees);
  }
  for (let changed = true; changed;) {
    changed = false;
    for (const [id, callees] of passes) {
      if (!makers.has(id) && callees.some((callee) => makers.has(callee))) {
        makers.add(id);
        changed = true;
      }
    }
  }
  return makers;
}

/**
 * The local functions that capture nothing of the component: what they reference, followed
 * through the setup's functions and constants, is only such functions and constants, globals,
 * events and the authoring APIs. A target runs one as a plain function wherever it is called or
 * handed, at once (Qwik moves it to module scope, ADR-0045).
 */
function isolatedFunctions(component: UfComponent): Set<BindingId> {
  const candidates = new Map<BindingId, readonly CodeReference[]>();
  for (const item of component.setup) {
    if (item.kind === "Const") candidates.set(item.binding, item.value.refs);
    else if (item.kind === "Function") candidates.set(item.binding, item.function.body.refs);
  }
  const isolated = new Set(candidates.keys());
  for (let changed = true; changed;) {
    changed = false;
    for (const [id, refs] of candidates) {
      if (!isolated.has(id)) continue;
      const captures = refs.some(
        (reference) =>
          reference.kind === "Write" ||
          reference.kind === "Emit" ||
          (reference.kind === "Binding" && !isolated.has(reference.binding)),
      );
      if (captures) {
        isolated.delete(id);
        changed = true;
      }
    }
  }
  return isolated;
}

/** The calls that never run a function they are given: they compare it or forget it. */
const NON_CALLING_METHODS: ReadonlySet<string> = new Set(["removeEventListener"]);
const NON_CALLING_GLOBALS: ReadonlySet<string> = new Set([
  "cancelAnimationFrame",
  "cancelIdleCallback",
  "clearInterval",
  "clearTimeout",
]);

/**
 * Where client code runs a control apart from a template listener's top (ADR-0047), which a
 * target whose local functions run asynchronously (Qwik's QRLs) cannot run while the event is
 * dispatched: the `conditional-event-control` capability. A local function that makes a control
 * on what it is given (`controlMakers`) and captures something of the component (one that
 * captures nothing runs at once everywhere, `isolatedFunctions`), handed as a value to anything
 * but a call that never runs it (`removeEventListener`, `clearTimeout`), or called from client
 * code that is not a template listener's (or the functions it passes its event to:
 * `handlerControls` judges those) or from a callback inside one; and a control a callback makes
 * on its own parameter after a call of such a local function there, which such a target awaits.
 * In source order.
 */
export function handedControls(component: UfComponent): Span[] {
  const functions = localFunctions(component);
  const isolated = isolatedFunctions(component);
  const makers = new Set([...controlMakers(functions)].filter((id) => !isolated.has(id)));
  const found: Span[] = [];
  for (const { function: fn, context } of functionsOf(component)) {
    if (context !== "client") continue;
    const listener = eventName(fn) !== undefined;
    const base = fn.body.span.start;
    const body = parsedBody(fn);
    const nested: { start: number; end: number }[] = [];
    // The arguments of the calls that never run what they are given, by their offsets.
    const forgotten = new Set<number>();
    visitNodes(body, (node) => {
      if (isFunction(node)) nested.push(node);
      if (node.type !== "CallExpression") return;
      const { callee } = node;
      const method =
        callee.type === "MemberExpression" &&
        !callee.computed &&
        callee.property.type === "Identifier"
          ? callee.property.name
          : undefined;
      const never =
        (callee.type === "Identifier" && NON_CALLING_GLOBALS.has(callee.name)) ||
        (method !== undefined &&
          (NON_CALLING_METHODS.has(method) || NON_CALLING_GLOBALS.has(method)));
      if (never) for (const argument of node.arguments) forgotten.add(unwrapped(argument).start);
    });
    for (const reference of fn.body.refs) {
      if (reference.kind !== "Binding" || !makers.has(reference.binding)) continue;
      const offset = reference.span.start - base;
      if (reference.call !== true) {
        if (!forgotten.has(offset)) found.push(reference.span);
      } else if (!listener || nested.some((each) => offset > each.start && offset < each.end)) {
        found.push(reference.span);
      }
    }
    for (const span of lateCallbackControls(fn, functions, isolated)) found.push(span);
  }
  return found.toSorted((a, b) => a.start - b.start);
}

/**
 * The controls the callbacks inside a function make on their own parameters after a call of a
 * local function in the callback (`(event) => { save(); event.preventDefault(); }`), at their
 * spans in the source.
 */
function lateCallbackControls(
  fn: FunctionCode,
  functions: ReadonlyMap<BindingId, FunctionCode>,
  isolated: ReadonlySet<BindingId>,
): Span[] {
  const base = fn.body.span.start;
  const calls = fn.body.refs.flatMap((reference) =>
    reference.kind === "Binding" &&
    reference.call === true &&
    functions.has(reference.binding) &&
    !isolated.has(reference.binding)
      ? [reference.span.start - base]
      : [],
  );
  if (!calls.length) return [];
  const found: Span[] = [];
  // Each callback's controls on its parameters, outside the callbacks inside it.
  const scan = (callback: AST.Node, names: readonly string[]) => {
    const first = (node: AST.Node) =>
      calls.some((offset) => offset > callback.start && offset < node.start && !inner(offset));
    const nestedIn: { start: number; end: number }[] = [];
    const inner = (offset: number) =>
      nestedIn.some((each) => offset > each.start && offset < each.end);
    const body = (callback as unknown as { body: AST.Node }).body;
    visitNodes(body, (node) => {
      if (isFunction(node)) nestedIn.push(node);
    });
    visitNodes(body, (node) => {
      if (inner(node.start)) return;
      if (names.some((name) => controlOn(node, name)) && first(node)) {
        found.push({ start: base + node.start, end: base + node.end });
      }
    });
  };
  visitNodes(parsedBody(fn), (node) => {
    if (!isFunction(node)) return;
    const names = (node as unknown as { params: AST.Node[] }).params.flatMap((parameter) =>
      parameter.type === "Identifier" ? [parameter.name] : [],
    );
    if (names.length) scan(node, names);
  });
  return found;
}

/** Whether a node is a function. */
function isFunction(node: AST.Node): boolean {
  return (
    node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionExpression" ||
    node.type === "FunctionDeclaration"
  );
}

/** A control on an event, read by name: the method its call makes. */
function controlOn(
  node: AST.Node | null | undefined,
  event: string,
): "preventDefault" | "stopPropagation" | undefined {
  if (node?.type !== "CallExpression" || node.optional || node.arguments.length) return undefined;
  const { callee } = node;
  if (callee.type !== "MemberExpression" || callee.computed || callee.optional) return undefined;
  if (callee.object.type !== "Identifier" || callee.object.name !== event) return undefined;
  const name = callee.property.type === "Identifier" ? callee.property.name : "";
  return name === "preventDefault" || name === "stopPropagation" ? name : undefined;
}

/** Whether code reads a member of the event that a control changes (`event.defaultPrevented`). */
function readsChanged(node: unknown, event: string): boolean {
  let found = false;
  visitNodes(node, (each) => {
    if (
      each.type === "MemberExpression" &&
      !each.computed &&
      each.object.type === "Identifier" &&
      each.object.name === event &&
      each.property.type === "Identifier" &&
      CHANGED_MEMBERS.has(each.property.name)
    ) {
      found = true;
    }
  });
  return found;
}

/** A function's body, parsed: its block's statements, or its expression. */
function parsedBody(fn: FunctionCode): unknown {
  return parseCodeSource(fn.body.code, fn.expression ? "expression" : "statements").root;
}

/** Visits every node in a tree, depth first. */
function visitNodes(node: unknown, enter: (node: AST.Node) => void): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) visitNodes(item, enter);
    return;
  }
  const typed = node as AST.Node;
  if (typeof typed.type !== "string") return;
  enter(typed);
  for (const key of visitorKeys[typed.type] ?? []) {
    visitNodes((typed as unknown as Record<string, unknown>)[key], enter);
  }
}

/** Whether an expression reads no name but `name`: a member's property is no read. */
function readsOnly(node: AST.Node, name: string): boolean {
  let only = true;
  const visit = (value: unknown): void => {
    if (!only || !value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    const typed = value as AST.Node;
    if (typed.type === "Identifier") {
      if (typed.name !== name) only = false;
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
    // A type reads no name (`event.target as HTMLInputElement` reads only `event`).
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
  return only;
}

/** The node types that wrap an expression with a type (`x as T`, `x!`). */
const TYPED_EXPRESSIONS: ReadonlySet<string> = new Set([
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "TSTypeAssertion",
  "TSInstantiationExpression",
]);

/** The keys of a node that hold types. */
const TYPE_KEYS: ReadonlySet<string> = new Set([
  "typeAnnotation",
  "typeArguments",
  "typeParameters",
  "returnType",
]);

/** Whether a statement always leaves the function: a `return`, a `throw`, or a block ending so. */
function alwaysLeaves(statement: AST.Statement): boolean {
  if (statement.type === "ReturnStatement" || statement.type === "ThrowStatement") return true;
  if (statement.type !== "BlockStatement") return false;
  const last = statement.body.at(-1);
  return last !== undefined && alwaysLeaves(last);
}

/** Whether a statement awaits, outside the functions in it. */
function awaits(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  if (Array.isArray(node)) return node.some(awaits);
  const typed = node as AST.Node;
  if (typed.type === "AwaitExpression") return true;
  if (isFunction(typed)) return false;
  if (typed.type === "ForOfStatement" && typed.await) return true;
  return (visitorKeys[typed.type] ?? []).some((key) =>
    awaits((typed as unknown as Record<string, unknown>)[key]),
  );
}
