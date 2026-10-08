// Handlers in Qwik (ADR-0047). Qwik runs a listener's `$` handler after it loads, once the
// event has been dispatched: `preventDefault()` and `stopPropagation()` there come too late, and
// `event.currentTarget` is gone (its listeners run from one document listener). So the controls
// at the top of a handler (codegen's `ownControls`) leave it:
// - an unconditional `preventDefault()` or `stopPropagation()` becomes the element's
//   `preventdefault:<event>` or `stoppropagation:<event>`, which Qwik's loader applies as it
//   dispatches;
// - one under a test of the event becomes a `sync$` handler before the `$` one, which runs at
//   dispatch (it captures nothing, as its test reads only the event);
// - `event.currentTarget` is the element Qwik passes as the handler's second argument.
// Any other control is `conditional-event-control`, which Qwik does not support (./index.ts).
// A function whose body was only controls (`const cancel = (event: Event) =>
// event.preventDefault();`) is empty: a statement that only calls it goes from its callers too,
// and it is not declared where nothing else names it.
import { ownControls, parseCodeSource } from "@unframework/codegen";
import type {
  BindingId,
  Code,
  CodeReference,
  EventControl,
  FunctionCode,
  Parameter,
  Span,
  UfComponent,
} from "@unframework/ir";
import { walk } from "@unframework/ir";

import { unreachable } from "./plan.ts";

/** A handler's body with its event controls taken out. */
export interface SplitHandler {
  /** The body without the controls: the same span, its text and references shifted. */
  body: Code;
  /** Whether nothing is left of the body. */
  empty: boolean;
  /** The controls taken out of it. */
  controls: EventControl[];
  /** Whether what is left reads `event.currentTarget`, which the element argument replaces. */
  currentTarget: boolean;
  /** Whether what is left uses the event parameter at all. */
  usesEvent: boolean;
  /** The calls of empty functions taken out of it, by their callee's offset in the source. */
  removedCalls: readonly number[];
}

/**
 * Splits a handler's body into its event controls and the rest (see the module comment), taking
 * out too the statements that only call one of the `empty` functions.
 */
export function splitHandler(
  fn: FunctionCode,
  component: UfComponent,
  emptyFunctions: ReadonlySet<BindingId> = new Set(),
): SplitHandler {
  const controls = ownControls(fn, component);
  const event = fn.parameters.find((parameter) => parameter.event !== undefined)?.name;
  const calls = emptyCalls(fn, emptyFunctions);
  const body = removeSpans(fn.body, [
    ...controls.map((control) => control.span),
    ...calls.map((call) => call.statement),
  ]);
  const empty = fn.expression
    ? body.code.trim() === ""
    : body.code.replace(/^\{|\}$/g, "").trim() === "";
  // `event.currentTarget` becomes Qwik's element argument: it is no use of the event.
  const targets = body.refs.filter(
    (reference) => reference.kind === "Event" && reference.member === "currentTarget",
  );
  let rest = body.code;
  for (const { span } of targets) {
    const start = span.start - body.span.start;
    const end = span.end - body.span.start;
    rest = `${rest.slice(0, start)}${" ".repeat(end - start)}${rest.slice(end)}`;
  }
  return {
    body,
    empty,
    controls,
    currentTarget: targets.length > 0,
    usesEvent: event !== undefined && readsName(rest, event),
    removedCalls: calls.map((call) => call.callee),
  };
}

/** A node of a parsed body, as far as {@link emptyCalls} reads it. */
interface CallNode {
  type: string;
  start: number;
  end: number;
  expression?: CallNode;
  argument?: CallNode;
  operator?: string;
  callee?: CallNode;
  arguments?: CallNode[];
  body?: CallNode[];
  test?: CallNode;
  consequent?: CallNode;
  alternate?: CallNode | null;
  left?: CallNode;
  right?: CallNode;
}

/**
 * The statements of a function's body (or its expression body) that only call one of the `empty`
 * functions, with arguments that do nothing themselves (names and literals), alone or under a
 * test of the event that changes nothing (`if (event.key === "a") cancel(event);`, `event.altKey
 * && cancel(event)`): each statement's span and its callee's offset, in the source.
 */
function emptyCalls(
  fn: FunctionCode,
  empty: ReadonlySet<BindingId>,
): { statement: Span; callee: number }[] {
  if (!empty.size) return [];
  const base = fn.body.span.start;
  const callees = new Set(
    fn.body.refs.flatMap((reference) =>
      reference.kind === "Binding" && reference.call === true && empty.has(reference.binding)
        ? [reference.span.start - base]
        : [],
    ),
  );
  if (!callees.size) return [];
  const called = (node: CallNode | undefined): number | undefined => {
    let inner = node;
    while (
      inner &&
      ((inner.type === "UnaryExpression" && inner.operator === "void") ||
        inner.type === "AwaitExpression" ||
        inner.type === "ParenthesizedExpression")
    ) {
      inner = inner.type === "ParenthesizedExpression" ? inner.expression : inner.argument;
    }
    // `test && f(event)`, as a statement or an expression body.
    if (inner?.type === "LogicalExpression") {
      return inner.operator === "&&" && eventTest(inner.left) ? called(inner.right) : undefined;
    }
    if (inner?.type !== "CallExpression" || inner.callee?.type !== "Identifier") return undefined;
    const inert = (inner.arguments ?? []).every(
      (argument) => argument.type === "Identifier" || argument.type === "Literal",
    );
    return inert && callees.has(inner.callee.start) ? inner.callee.start : undefined;
  };
  // A test that reads only the event and changes nothing: no call, no assignment.
  const eventTest = (node: CallNode | undefined): boolean => {
    if (!node) return false;
    const start = base + node.start;
    const end = base + node.end;
    let pure = true;
    const visit = (value: unknown): void => {
      if (!pure || !value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        for (const item of value) visit(item);
        return;
      }
      const type = (value as { type?: unknown }).type;
      if (
        type === "CallExpression" ||
        type === "NewExpression" ||
        type === "AssignmentExpression" ||
        type === "UpdateExpression" ||
        type === "AwaitExpression"
      ) {
        pure = false;
        return;
      }
      for (const [key, child] of Object.entries(value)) if (key !== "parent") visit(child);
    };
    visit(node);
    return (
      pure &&
      fn.body.refs.every(
        (reference) =>
          reference.kind === "Event" || reference.span.end <= start || reference.span.start >= end,
      )
    );
  };
  // `if (test) f(event);` without `else`, its consequent a statement or a block of one.
  const guardedCall = (statement: CallNode): number | undefined => {
    if (statement.type !== "IfStatement" || statement.alternate || !eventTest(statement.test)) {
      return undefined;
    }
    const consequent =
      statement.consequent?.type === "BlockStatement"
        ? statement.consequent.body?.length === 1
          ? statement.consequent.body[0]
          : undefined
        : statement.consequent;
    return consequent?.type === "ExpressionStatement" ? called(consequent.expression) : undefined;
  };
  const span = (node: CallNode) => ({ start: base + node.start, end: base + node.end });
  if (fn.expression) {
    const root = parseCodeSource(fn.body.code, "expression").root as unknown as CallNode;
    const callee = called(root);
    return callee === undefined ? [] : [{ statement: span(root), callee: base + callee }];
  }
  const [block] = parseCodeSource(fn.body.code, "statements").root as unknown as CallNode[];
  return (block?.type === "BlockStatement" ? (block.body ?? []) : []).flatMap((statement) => {
    const callee =
      statement.type === "ExpressionStatement"
        ? called(statement.expression)
        : guardedCall(statement);
    return callee === undefined ? [] : [{ statement: span(statement), callee: base + callee }];
  });
}

/** Whether code reads a name, as a word that is not a member's property. */
export function readsName(code: string, name: string): boolean {
  return new RegExp(`(?<![\\w$.])${name.replace(/\$/g, "\\$")}(?![\\w$])`).test(code);
}

/**
 * Code with some spans taken out, each with its line when nothing else is on it. The span stays
 * the code's own (`codeKind` finds a function's body by it); the text and every reference after a
 * removed span move back by what was removed, and a reference inside one goes with it.
 */
export function removeSpans(code: Code, spans: readonly Span[]): Code {
  if (!spans.length) return code;
  const { code: text, span } = code;
  const removed = spans
    .map(({ start, end }) => widen(text, start - span.start, end - span.start))
    .toSorted((a, b) => a.start - b.start);
  let result = "";
  let last = 0;
  for (const { start, end } of removed) {
    result += text.slice(last, start);
    last = end;
  }
  result += text.slice(last);
  const shift = (offset: number): number => {
    const local = offset - span.start;
    let delta = 0;
    for (const { start, end } of removed) if (end <= local) delta += end - start;
    return offset - delta;
  };
  const inside = (reference: CodeReference) =>
    removed.some(
      ({ start, end }) =>
        reference.span.start - span.start >= start && reference.span.end - span.start <= end,
    );
  const moved = (at: Span): Span => ({ start: shift(at.start), end: shift(at.end) });
  const refs = code.refs
    .filter((reference) => !inside(reference))
    .map((reference): CodeReference => {
      switch (reference.kind) {
        case "Binding":
        case "Global":
        case "Api":
        case "Event":
        case "Slot":
          return { ...reference, span: moved(reference.span) };
        case "Write":
          return {
            ...reference,
            span: moved(reference.span),
            target: moved(reference.target),
            ...(reference.value ? { value: moved(reference.value) } : {}),
          };
        case "Emit":
          return {
            ...reference,
            span: moved(reference.span),
            arguments: reference.arguments.map(moved),
          };
        default:
          return unreachable(reference);
      }
    });
  return { code: result, span, refs };
}

/** A span of a statement widened to its whole lines when nothing else is on them. */
function widen(text: string, start: number, end: number): { start: number; end: number } {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = text.indexOf("\n", end);
  const before = text.slice(lineStart, start);
  const after = text.slice(end, lineEnd === -1 ? text.length : lineEnd);
  if (/^[ \t]*$/.test(before) && /^[ \t]*$/.test(after) && lineStart > 0) {
    return { start: lineStart - 1, end: lineEnd === -1 ? text.length : lineEnd };
  }
  return { start, end };
}

/**
 * The setup functions only listeners name (`onClick={save}`), never called or passed: their
 * event controls move to those listeners, and their event parameter may go.
 */
export function handlerOnlyFunctions(component: UfComponent): Set<string> {
  const used = usedFunctions(component, new Set());
  return new Set([...listenerFunctions(component)].filter((id) => !used.has(id)));
}

/** The setup functions some listener names (`onClick={save}`). */
function listenerFunctions(component: UfComponent): Set<string> {
  const named = new Set<string>();
  walk(component.render, {
    enter(node) {
      if (node.kind !== "Element") return;
      for (const attribute of node.attributes) {
        if (attribute.kind === "Event" && attribute.handler.kind === "Function") {
          named.add(attribute.handler.binding);
        }
      }
    },
  });
  return named;
}

/**
 * The bindings code names (setup code, inline handlers), but where a reference starts at one of
 * the `removed` offsets (a call taken out of its statement).
 */
export function usedFunctions(component: UfComponent, removed: ReadonlySet<number>): Set<string> {
  const used = new Set<string>();
  const visit = (refs: readonly CodeReference[]) => {
    for (const reference of refs) {
      if (reference.kind === "Binding" && !removed.has(reference.span.start)) {
        used.add(reference.binding);
      }
    }
  };
  for (const item of component.setup) {
    switch (item.kind) {
      case "State":
      case "Variable":
        if (item.initial) visit(item.initial.refs);
        break;
      case "Const":
        visit(item.value.refs);
        break;
      case "Derived":
        visit(item.getter.body.refs);
        break;
      case "Function":
        visit(item.function.body.refs);
        break;
      case "Watch":
        for (const source of item.sources)
          if (source.kind === "Getter") visit(source.getter.body.refs);
        visit(item.callback.body.refs);
        break;
      case "WatchEffect":
        visit(item.effect.body.refs);
        break;
      case "Lifecycle":
        visit(item.callback.body.refs);
        break;
      case "Provide":
        visit(item.value.refs);
        break;
      case "Inject":
        if (item.fallback) visit(item.fallback.refs);
        break;
      case "TemplateRef":
      case "Id":
      case "Model":
        break;
      default:
        unreachable(item);
    }
  }
  walk(component.render, {
    enter(node) {
      if (node.kind !== "Element") return;
      for (const attribute of node.attributes) {
        if (attribute.kind === "Event" && attribute.handler.kind === "Inline") {
          visit(attribute.handler.function.body.refs);
        }
      }
    },
  });
  return used;
}

/** A parameter the target adds: Qwik's element argument, typed where nothing types it. */
export function elementParameter(name: string, type?: string): Parameter {
  const at = { start: 0, end: 0 };
  return {
    name,
    ...(type === undefined ? {} : { type: { code: type, span: at } }),
    span: at,
  };
}
