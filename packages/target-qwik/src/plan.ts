// How the Qwik target lowers a component's setup (ADR-0045): which of the
// setup's functions and constants move to module scope, which stay in the component as plain
// code, and which become `$()` QRLs, and how references are spelled for each. A `$` scope (a
// handler, a task, a `useComputed$` getter) can capture only serialisable values: never a plain
// function (optimizer C02), so a function a `$` scope calls is a QRL, whose calls are awaited
// (./calls.ts), or, when it captures nothing of the component, a module-level function.
import { bindingOf, parseCodeSource } from "@unframework/codegen";
import type { CodeKind, ImportSet, RewriteRules, RewriteSite } from "@unframework/codegen";
import { expressionsOf, functionsOf, summarizeCode, walk } from "@unframework/ir";
import type {
  Binding,
  BindingId,
  BindingKind,
  Code,
  CodeReference,
  ConstItem,
  ElementNode,
  EventAttribute,
  FunctionCode,
  FunctionItem,
  RenderNode,
  UfComponent,
  UfModule,
} from "@unframework/ir";

import { qwikEventProp } from "./events.ts";
import { elementParameter, handlerOnlyFunctions, splitHandler, usedFunctions } from "./handlers.ts";
import type { SplitHandler } from "./handlers.ts";
import { callSites, spliceable } from "./inline.ts";
import type { CallSite } from "./inline.ts";

/**
 * Where a setup function goes:
 * - `module`: it captures nothing of the component (its reads, followed through what it calls,
 *   are module-level constants and functions), so it moves to module scope as written, where
 *   render, getters and `$` scopes all reach it (ADR-0045);
 * - `render`: render or setup-time code calls it, so it stays a plain function in the component;
 * - `qrl`: client code calls it, names it as a handler or passes it on, so it is a `$()` QRL;
 * - `both`: render and client code call it: a plain function, and a QRL twin for client code.
 */
export type FunctionForm = "module" | "render" | "qrl" | "both";

/** Where a setup `const` goes: module scope, `useConstant` (it reads a reactive value), or plain. */
export type ConstForm = "module" | "constant" | "plain";

/** A setup function and where it goes. */
export interface FunctionPlan {
  item: FunctionItem;
  binding: Binding;
  form: FunctionForm;
  /** The name client code calls it by: its own, or its QRL twin's (`both`). */
  qrl: string;
}

/**
 * A setup function that takes an event (a listener names it, or a handler passes it its event),
 * and what moves out of it: its event controls go to each listener that reaches it
 * (./handlers.ts), and it takes Qwik's element argument where it reads `event.currentTarget` or
 * passes its event to a function that does.
 */
export interface EventFunction {
  split: SplitHandler;
  /**
   * The function to declare: the rest of its body, the element argument after the event where it
   * takes it, and an event parameter nothing reads dropped (a function only listeners name) or
   * named `_event` (one a handler calls); `null` when nothing is left of a function only listeners
   * name (its controls run in its listeners' markers and `sync$` handlers).
   */
  code: FunctionCode | null;
  /** Whether it takes Qwik's element argument after its event. */
  element: boolean;
  /** The functions taking an event that it calls, which it passes its event. */
  passes: readonly BindingId[];
}

/**
 * The listeners of one element, event and scope, printed as one prop in attribute order
 * (./listeners.ts): its window-scope capture listeners (see {@link ListenerPlan}) or the rest.
 */
export interface ListenerGroup {
  readonly element: ElementNode;
  readonly event: string;
  readonly scope: "element" | "window";
  readonly listeners: readonly EventAttribute[];
  /**
   * Whether its handler runs its calls of local functions in place (./inline.ts), and an async
   * one returns after its synchronous part (./listeners.ts): where it holds several listeners, or
   * another listener of the component may run after it in the same dispatch (an ancestor's in the
   * bubble phase; a descendant's or any bubble listener on the path after a capture listener; any
   * after the window's). Qwik's loader runs each element's loaded handler as it walks the path,
   * so the handler's synchronous code is done when the next element's starts; a handler the
   * loader queues (one after a `sync$` on its element) waits for the promise of every handler
   * started before it, which is then only the synchronous part's.
   */
  readonly synchronous: boolean;
}

/** How the component's listeners are grouped and lowered (./listeners.ts). */
export interface ListenerPlan {
  /**
   * The events some element listens to in both phases. Qwik's `capture:<event>` makes every
   * handler of the element a capture one, so every capture listener of such an event runs from
   * the window (`window:onClick$`), which keeps their order.
   */
  readonly windowEvents: ReadonlySet<string>;
  /**
   * The events the component listens to both passively and not. Qwik's loader dispatches
   * passive and other handlers from two document listeners, each walking the whole path, so
   * every handler of one would run before every handler of the other whatever the nesting:
   * every listener of such an event is non-passive (a passive listener's `preventDefault()`
   * does nothing, so it is left out).
   */
  readonly mixedPassive: ReadonlySet<string>;
  /** Each listener's group. */
  readonly groups: ReadonlyMap<EventAttribute, ListenerGroup>;
}

/** The names and imports of one output file, shared by the planner and the printers. */
export class OutputNames {
  readonly imports: ImportSet;
  readonly #claimed = new Map<string, string>();

  constructor(imports: ImportSet) {
    this.imports = imports;
  }

  /** An import from `@qwik.dev/core`, under a free name. */
  core(name: string, options: { type?: boolean } = {}): string {
    return this.imports.add("@qwik.dev/core", name, options);
  }

  /** A name the output declares once per file (`track`, `element`, a helper), claimed once. */
  once(name: string): string {
    let local = this.#claimed.get(name);
    if (local === undefined) {
      local = this.imports.claim(name);
      this.#claimed.set(name, local);
    }
    return local;
  }

  /** A fresh name the output declares (`previousQuery`), `_1`, `_2`… when taken. */
  fresh(name: string): string {
    return this.imports.claim(name);
  }

  /** Whether a once-claimed name has been taken (a helper the output then emits). */
  has(name: string): boolean {
    return this.#claimed.has(name);
  }
}

/** What the planner decides for a component, which every printer reads. */
export interface SetupPlan {
  readonly component: UfComponent;
  readonly module: UfModule;
  readonly names: OutputNames;
  readonly functions: ReadonlyMap<BindingId, FunctionPlan>;
  readonly consts: ReadonlyMap<BindingId, ConstForm>;
  /** The names client code calls as QRLs, which a call awaits. */
  readonly qrls: ReadonlySet<string>;
  /** The template refs attached inside a conditional, read through the `rendered` helper. */
  readonly conditionalRefs: ReadonlySet<BindingId>;
  /** The events some code emits, which the props destructure. */
  readonly emitted: ReadonlySet<string>;
  /** How code spells an event's QRL prop: its destructured name, or `props.onX$`. */
  eventProp(event: string): string;
  /** The destructured name of each emitted event's prop, by event (destructured form only). */
  readonly eventLocals: ReadonlyMap<string, string>;
  /** The setup functions that take an event, with what moves out of them. */
  readonly eventFunctions: ReadonlyMap<BindingId, EventFunction>;
  /** The setup functions nothing is left of once their controls move out (./handlers.ts). */
  readonly emptyFunctions: ReadonlySet<BindingId>;
  /** How the listeners are grouped and lowered. */
  readonly listeners: ListenerPlan;
  /**
   * The client functions whose `$()` QRL the component declares: those client code calls as a
   * QRL, names as a handler that runs alone or passes on. A function every call writes in place
   * (./inline.ts) has none.
   */
  readonly declared: ReadonlySet<BindingId>;
  /**
   * The QRL names whose function returns a promise (`returnsPromise`): a call of one is the
   * promise itself, which only a call the source awaits awaits, and a statement call floats.
   */
  readonly promiseQrls: ReadonlySet<string>;
  /** The function client code calls by a QRL name, by that name. */
  readonly qrlFunctions: ReadonlyMap<string, BindingId>;
  /** The functions that keep one identity for the instance's life (see {@link StablePlan}). */
  readonly stable: StablePlan;
  /**
   * The reads of a template ref's value that client code uses whole (stored, passed on, compared,
   * returned), by their offset in the source: \`T | null\` there, as the source's type is, where
   * Qwik's ref signal holds \`T | undefined\`.
   */
  readonly wholeRefReads: ReadonlySet<number>;
  /**
   * The rules code is printed with; `event` names the event parameter of the function printed,
   * whose members other than `currentTarget` stay as written.
   */
  rules(event?: string): RewriteRules;
  /**
   * The code a setup function is declared with: its own (`undefined`), the rest of a named
   * handler's, or `null` for a named handler with nothing left.
   */
  functionCode(id: BindingId): FunctionCode | null | undefined;
}

/** Plans a component's setup: see {@link SetupPlan}. */
export function planSetup(component: UfComponent, module: UfModule, names: OutputNames): SetupPlan {
  const hoisted = hoistable(component);
  const functions = planFunctions(component, hoisted, names);
  const consts = planConsts(component, hoisted);
  const qrls = new Set<string>();
  for (const plan of functions.values()) {
    if (plan.form === "qrl" || plan.form === "both") qrls.add(plan.qrl);
  }
  const emitted = emittedEvents(component);
  const eventLocals = new Map<string, string>();
  const objectForm = component.propsParameter?.form === "object";
  if (!objectForm) {
    for (const event of component.emits?.events ?? []) {
      if (emitted.has(event.name))
        eventLocals.set(event.name, names.fresh(qwikEventProp(event.name)));
    }
  }
  const eventProp = (event: string): string =>
    objectForm
      ? `${component.propsParameter!.name}.${qwikEventProp(event)}`
      : (eventLocals.get(event) ?? qwikEventProp(event));
  const conditionalRefs = refsInConditionals(component);
  const { planned: eventFunctions, empty: emptyFunctions } = planEventFunctions(component, names);
  const listeners = planListeners(component);
  const qrlFunctions = new Map<string, BindingId>();
  const promiseQrls = new Set<string>();
  for (const [id, fnPlan] of functions) {
    if (fnPlan.form !== "qrl" && fnPlan.form !== "both") continue;
    qrlFunctions.set(fnPlan.qrl, id);
    if (returnsPromise(fnPlan.item.function)) promiseQrls.add(fnPlan.qrl);
  }
  const stable = planStable(component, functions, names);
  const wholeRefReads = refReadsUsedWhole(component);
  const plan: SetupPlan = {
    component,
    module,
    names,
    functions,
    consts,
    qrls,
    conditionalRefs,
    emitted,
    eventProp,
    eventLocals,
    eventFunctions,
    emptyFunctions,
    listeners,
    declared: declaredQrls(component, functions, listeners),
    promiseQrls,
    qrlFunctions,
    stable,
    wholeRefReads,
    rules: (event) => rewriteRules(plan, event),
    functionCode: (id) => eventFunctions.get(id)?.code,
  };
  return plan;
}

/**
 * What moves out of each setup function that takes an event (see {@link EventFunction}), and the
 * functions nothing is left of: their controls, and their calls of such functions, moved out.
 */
function planEventFunctions(
  component: UfComponent,
  names: OutputNames,
): { planned: Map<BindingId, EventFunction>; empty: Set<BindingId> } {
  const functions = new Map<BindingId, FunctionCode>();
  for (const item of component.setup) {
    if (item.kind !== "Function") continue;
    if (item.function.parameters.some((parameter) => parameter.event !== undefined)) {
      functions.set(item.binding, item.function);
    }
  }
  const empty = new Set<BindingId>();
  for (let changed = true; changed;) {
    changed = false;
    for (const [id, fn] of functions) {
      if (!empty.has(id) && splitHandler(fn, component, empty).empty) {
        empty.add(id);
        changed = true;
      }
    }
  }
  const splits = new Map(
    [...functions].map(([id, fn]) => [id, splitHandler(fn, component, empty)]),
  );
  // The calls taken out of their statements, which leave a function nothing else may name.
  const removed = new Set([...splits.values()].flatMap((split) => split.removedCalls));
  walk(component.render, {
    enter(node) {
      if (node.kind !== "Element") return;
      for (const attribute of node.attributes) {
        if (attribute.kind !== "Event" || attribute.handler.kind !== "Inline") continue;
        const split = splitHandler(attribute.handler.function, component, empty);
        for (const offset of split.removedCalls) removed.add(offset);
      }
    },
  });
  const used = usedFunctions(component, removed);
  const passes = new Map(
    [...functions].map(([id]) => [id, eventCallees(splits.get(id)!.body.refs, functions)]),
  );
  // Through the functions it passes its event to.
  const element = new Set([...splits].flatMap(([id, split]) => (split.currentTarget ? [id] : [])));
  for (let changed = true; changed;) {
    changed = false;
    for (const [id, callees] of passes) {
      if (!element.has(id) && callees.some((callee) => element.has(callee))) {
        element.add(id);
        changed = true;
      }
    }
  }
  const handlerOnly = handlerOnlyFunctions(component);
  const planned = new Map<BindingId, EventFunction>();
  for (const [id, fn] of functions) {
    const split = splits.get(id)!;
    const takesElement = element.has(id);
    const base = { split, element: takesElement, passes: passes.get(id)! };
    if (!split.controls.length && !split.removedCalls.length && !takesElement) continue;
    if (split.empty && !used.has(id)) {
      planned.set(id, { ...base, code: null });
      continue;
    }
    const index = fn.parameters.findIndex((parameter) => parameter.event !== undefined);
    const event = fn.parameters[index]!;
    const parameters = [...fn.parameters];
    if (takesElement) {
      parameters.splice(index + 1, 0, elementParameter(names.once("element"), "Element"));
    } else if (!split.usesEvent && index === parameters.length - 1) {
      // An event nothing reads any more: a function only listeners name drops it; one a handler
      // calls keeps its place, unused.
      if (handlerOnly.has(id)) parameters.splice(index, 1);
      else parameters[index] = { ...event, name: `_${event.name!}` };
    }
    const code: FunctionCode = { ...fn, parameters, body: split.body };
    delete code.eventControls;
    if (fn.expression && split.empty) {
      // An arrow whose expression body was its control (`(event: Event) =>
      // event.preventDefault()`), which code still names: an empty block.
      delete code.expression;
      code.body = { ...split.body, code: "{}" };
    }
    planned.set(id, { ...base, code });
  }
  return { planned, empty };
}

/**
 * The functions that keep one identity for the instance's life: a QRL a component declares is a
 * new one each time Qwik renders the component again, so a function client code hands to
 * `addEventListener` or `removeEventListener` is one \`useConstant(() => $(…))\`, which the
 * listeners it adds and removes in any handler, hook or function share. A QRL captures what it
 * reads when it is created, so two functions that reference each other (a listener that removes
 * itself through a helper: \`close\` reads \`onEscape\`, which calls \`close\`) cannot both capture
 * the other: each reference that closes such a cycle by value reads the function from a holder
 * the component declares first (\`functions.onEscape\`), which the function's \`useConstant\`
 * fills as it creates it. A cycle has a reference by value (the analyser rejects recursion).
 */
export interface StablePlan {
  /** The functions declared with \`useConstant\`. */
  readonly functions: ReadonlySet<BindingId>;
  /** The references, by their offset in the source, that read a function through the holder. */
  readonly lazy: ReadonlySet<number>;
  /** The holder, where some reference reads through it: its name and the functions it holds. */
  readonly holder?: { name: string; members: readonly BindingId[] };
}

/** Plans which functions keep their identity, and the holder (see {@link StablePlan}). */
function planStable(
  component: UfComponent,
  functions: ReadonlyMap<BindingId, FunctionPlan>,
  names: OutputNames,
): StablePlan {
  const qrl = (id: BindingId) => {
    const form = functions.get(id)?.form;
    return form === "qrl" || form === "both";
  };
  const stable = new Set<BindingId>();
  // The functions handed to `addEventListener`/`removeEventListener`, anywhere in client code.
  for (const { function: fn, context } of functionsOf(component)) {
    if (context !== "client") continue;
    const base = fn.body.span.start;
    const values = new Map<number, BindingId>();
    for (const reference of fn.body.refs) {
      if (reference.kind === "Binding" && reference.call !== true && qrl(reference.binding)) {
        values.set(reference.span.start - base, reference.binding);
      }
    }
    if (!values.size) continue;
    walkNodes(
      parseCodeSource(fn.body.code, fn.expression ? "expression" : "statements").root,
      (node) => {
        const callee = node.callee as SyntaxNode | undefined;
        const property = callee?.property as SyntaxNode | undefined;
        if (
          node.type !== "CallExpression" ||
          callee?.type !== "MemberExpression" ||
          callee.computed === true ||
          (property?.name !== "addEventListener" && property?.name !== "removeEventListener")
        ) {
          return;
        }
        const listener = (node.arguments as SyntaxNode[])[1];
        const id = listener ? values.get(unwrappedNode(listener).start) : undefined;
        if (id !== undefined) stable.add(id);
      },
    );
  }
  // The references between client functions, and which function reaches which.
  const edges = new Map<BindingId, { to: BindingId; at: number; call: boolean }[]>();
  for (const [id, fnPlan] of functions) {
    if (!qrl(id)) continue;
    edges.set(
      id,
      fnPlan.item.function.body.refs.flatMap((reference) =>
        reference.kind === "Binding" && qrl(reference.binding)
          ? [{ to: reference.binding, at: reference.span.start, call: reference.call === true }]
          : [],
      ),
    );
  }
  const reach = (from: BindingId): Set<BindingId> => {
    const seen = new Set<BindingId>();
    const queue = [from];
    for (let id = queue.pop(); id !== undefined; id = queue.pop()) {
      for (const edge of edges.get(id) ?? []) {
        if (!seen.has(edge.to)) {
          seen.add(edge.to);
          queue.push(edge.to);
        }
      }
    }
    return seen;
  };
  const lazy = new Set<number>();
  const members: BindingId[] = [];
  for (const [from, list] of edges) {
    for (const edge of list) {
      // A reference by value that closes a cycle: the function it reads reaches back to this one.
      if (edge.call || !reach(edge.to).has(from)) continue;
      lazy.add(edge.at);
      stable.add(edge.to);
      if (!members.includes(edge.to)) members.push(edge.to);
    }
  }
  return {
    functions: stable,
    lazy,
    ...(members.length ? { holder: { name: names.fresh("functions"), members } } : {}),
  };
}

/**
 * The reads of a template ref's value in client code that use it whole (see
 * {@link SetupPlan.wholeRefReads}): any but a member's object (\`field.value?.focus()\`), an
 * operand of \`!\`, \`typeof\` or \`void\`, a test, or the left operand of \`&&\`, \`||\` or \`??\`,
 * where \`undefined\` and \`null\` do the same.
 */
function refReadsUsedWhole(component: UfComponent): Set<number> {
  const found = new Set<number>();
  const refs = new Set(
    component.bindings.flatMap((binding) => (binding.kind === "templateRef" ? [binding.id] : [])),
  );
  if (!refs.size) return found;
  for (const { function: fn, context } of functionsOf(component)) {
    if (context !== "client") continue;
    const base = fn.body.span.start;
    // Each read's span in the body: the node of `field.value` itself, not of what starts with it.
    const reads = new Map(
      fn.body.refs.flatMap((reference) =>
        reference.kind === "Binding" && refs.has(reference.binding)
          ? [[reference.span.start - base, reference.span.end - base] as const]
          : [],
      ),
    );
    if (!reads.size) continue;
    const visit = (node: unknown, parent: SyntaxNode | undefined, key: string): void => {
      if (Array.isArray(node)) {
        for (const item of node) visit(item, parent, key);
        return;
      }
      if (!isSyntaxNode(node)) return;
      if (reads.get(node.start) === node.end && !usedPartly(parent, key)) {
        found.add(base + node.start);
      }
      for (const [childKey, value] of Object.entries(node)) {
        if (childKey !== "type" && childKey !== "parent" && typeof value === "object") {
          visit(value, node, childKey);
        }
      }
    };
    visit(
      parseCodeSource(fn.body.code, fn.expression ? "expression" : "statements").root,
      undefined,
      "",
    );
  }
  return found;
}

/** Whether a node at \`key\` of \`parent\` is used for its truth or its members only. */
function usedPartly(parent: SyntaxNode | undefined, key: string): boolean {
  if (!parent) return false;
  switch (parent.type) {
    case "MemberExpression":
      return key === "object";
    case "ChainExpression":
    case "TSNonNullExpression":
      return true;
    case "UnaryExpression":
      return parent.operator === "!" || parent.operator === "typeof" || parent.operator === "void";
    case "IfStatement":
    case "WhileStatement":
    case "DoWhileStatement":
    case "ForStatement":
    case "ConditionalExpression":
      return key === "test";
    case "LogicalExpression":
      return key === "left";
    default:
      return false;
  }
}

/** A node of oxc's syntax tree, as far as the walks of this file read it. */
interface SyntaxNode {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

function isSyntaxNode(value: unknown): value is SyntaxNode {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as SyntaxNode).type === "string" &&
    typeof (value as SyntaxNode).start === "number"
  );
}

/** Calls \`visit\` on every node of a tree, parents first. */
function walkNodes(root: unknown, visit: (node: SyntaxNode) => void): void {
  if (Array.isArray(root)) {
    for (const item of root) walkNodes(item, visit);
    return;
  }
  if (!isSyntaxNode(root)) return;
  visit(root);
  for (const [key, value] of Object.entries(root)) {
    if (key !== "type" && key !== "parent" && typeof value === "object") walkNodes(value, visit);
  }
}

/** An expression without its type assertions (\`onKey as EventListener\`). */
function unwrappedNode(node: SyntaxNode): SyntaxNode {
  let current = node;
  while (TYPED.has(current.type)) current = current.expression as SyntaxNode;
  return current;
}

/** Whether a function's return type is a type predicate or an assertion (`x is T`, `asserts x`). */
export function isPredicate(fn: FunctionCode): boolean {
  const type = fn.returnType?.code.trim() ?? "";
  return /^asserts\s/.test(type) || /^[A-Za-z_$][\w$]*\s+is\s/.test(type);
}

/**
 * Whether a function returns a promise: it is `async`, its return type is a `Promise`, or each of
 * its returns (or its expression body) is one, by its syntax (`new Promise(…)`, `Promise.all(…)`,
 * `fetch(…)`, a `.then(…)`). A call of its QRL gives the same promise's value, so the output
 * awaits it only where the source does (./calls.ts).
 */
export function returnsPromise(fn: FunctionCode): boolean {
  if (fn.async === true) return true;
  if (/^(?:Promise|PromiseLike)\s*</.test(fn.returnType?.code.trim() ?? "")) return true;
  const returned: unknown[] = [];
  if (fn.expression) {
    returned.push(parseCodeSource(fn.body.code, "expression").root);
  } else {
    const visit = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        for (const item of node) visit(item);
        return;
      }
      const typed = node as { type?: unknown; argument?: unknown };
      if (typeof typed.type !== "string" || /Function/.test(typed.type)) return;
      if (typed.type === "ReturnStatement") returned.push(typed.argument);
      for (const [key, value] of Object.entries(typed)) {
        if (key !== "type" && typeof value === "object") visit(value);
      }
    };
    visit(parseCodeSource(fn.body.code, "statements").root);
  }
  return returned.length > 0 && returned.every(isPromiseExpression);
}

/** Whether an expression's value is a promise, by its syntax (see {@link returnsPromise}). */
function isPromiseExpression(node: unknown): boolean {
  const typed = node as {
    type?: string;
    callee?: {
      type?: string;
      name?: string;
      object?: { name?: string };
      property?: { name?: string };
    };
    expression?: unknown;
  } | null;
  if (!typed) return false;
  if (TYPED.has(typed.type ?? "")) return isPromiseExpression(typed.expression);
  const callee = typed.callee;
  if (typed.type === "NewExpression")
    return callee?.type === "Identifier" && callee.name === "Promise";
  if (typed.type !== "CallExpression" || !callee) return false;
  if (callee.type === "Identifier") return callee.name === "fetch";
  return (
    callee.type === "MemberExpression" &&
    (callee.object?.name === "Promise" ||
      ["then", "catch", "finally"].includes(callee.property?.name ?? ""))
  );
}

/** The node types that wrap an expression with a type (`x as T`, `x!`). */
const TYPED: ReadonlySet<string> = new Set([
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "TSTypeAssertion",
]);

/**
 * Whether client code writes a call of a client function at `site` in place (./inline.ts): a
 * type predicate's or an assertion function's anywhere, which keeps its narrowing; and in
 * `synchronous` code (a handler that shares its dispatch, a task, a function written in place),
 * every call in the code itself, not in its callbacks, of a function that returns no promise,
 * whose QRL call the output would await where the source goes on. A function that returns a
 * promise is called as a QRL, whose call runs its synchronous part at once once its code has
 * loaded (the semantics page declares a listener's first run).
 */
export function inlinedAt(fn: FunctionCode, site: CallSite, synchronous: boolean): boolean {
  return isPredicate(fn) || (synchronous && !site.nested && !returnsPromise(fn));
}

/** Groups the listeners and decides how each group runs (see {@link ListenerPlan}). */
function planListeners(component: UfComponent): ListenerPlan {
  const windowEvents = new Set<string>();
  const passive = new Map<string, Set<boolean>>();
  walk(component.render, {
    enter(node) {
      if (node.kind !== "Element") return;
      const phases = new Map<string, Set<boolean>>();
      for (const attribute of node.attributes) {
        if (attribute.kind !== "Event") continue;
        const seen = phases.get(attribute.event) ?? new Set<boolean>();
        seen.add(attribute.capture === true);
        phases.set(attribute.event, seen);
        const kinds = passive.get(attribute.event) ?? new Set<boolean>();
        kinds.add(attribute.passive === true);
        passive.set(attribute.event, kinds);
      }
      for (const [event, seen] of phases) if (seen.size === 2) windowEvents.add(event);
    },
  });
  interface Entry {
    group: Omit<ListenerGroup, "synchronous">;
    phase: "capture" | "bubble" | "window";
    path: readonly ElementNode[];
  }
  const entries: Entry[] = [];
  const visit = (node: RenderNode, path: readonly ElementNode[]): void => {
    switch (node.kind) {
      case "Element": {
        const events = new Map<string, EventAttribute[]>();
        for (const attribute of node.attributes) {
          if (attribute.kind !== "Event") continue;
          events.set(attribute.event, [...(events.get(attribute.event) ?? []), attribute]);
        }
        for (const [event, listeners] of events) {
          const capture = listeners.filter((listener) => listener.capture);
          const window = capture.length > 0 && windowEvents.has(event);
          const onElement = window ? listeners.filter((listener) => !listener.capture) : listeners;
          if (onElement.length) {
            entries.push({
              group: { element: node, event, scope: "element", listeners: onElement },
              phase: !window && capture.length ? "capture" : "bubble",
              path,
            });
          }
          if (window) {
            entries.push({
              group: { element: node, event, scope: "window", listeners: capture },
              phase: "window",
              path,
            });
          }
        }
        for (const child of node.children) visit(child, [...path, node]);
        return;
      }
      case "If":
        for (const branch of node.branches) for (const child of branch.children) visit(child, path);
        return;
      case "For":
        visit(node.body, path);
        return;
      case "Text":
      case "Interpolation":
        return;
      default:
        unreachable(node);
    }
  };
  const root = component.render;
  if (root.kind === "Fragment") for (const child of root.children) visit(child, []);
  else visit(root, []);
  const groups = new Map<EventAttribute, ListenerGroup>();
  for (const entry of entries) {
    const { element, event, listeners } = entry.group;
    const others = entries.filter((other) => other !== entry && other.group.event === event);
    const after = others.some((other) => {
      const ancestor = entry.path.includes(other.group.element);
      const descendant = other.path.includes(element);
      switch (entry.phase) {
        case "window":
          return true;
        case "capture":
          return (descendant && other.phase !== "window") || (ancestor && other.phase === "bubble");
        case "bubble":
          return ancestor && other.phase === "bubble";
        default:
          return unreachable(entry.phase);
      }
    });
    const group: ListenerGroup = { ...entry.group, synchronous: listeners.length > 1 || after };
    for (const listener of listeners) groups.set(listener, group);
  }
  const mixedPassive = new Set(
    [...passive].flatMap(([event, kinds]) => (kinds.size === 2 ? [event] : [])),
  );
  return { windowEvents, mixedPassive, groups };
}

/**
 * The client functions whose QRL the component declares (see {@link SetupPlan.declared}): those
 * a reference reaches that is no call written in place, from the handlers, watchers, effects
 * and hooks, and from the bodies of the functions they reach, written in place or declared. A
 * code that keeps a call written in place declares the function itself (./inline.ts), so every
 * reference of that code reaches it.
 */
function declaredQrls(
  component: UfComponent,
  functions: ReadonlyMap<BindingId, FunctionPlan>,
  listeners: ListenerPlan,
): Set<BindingId> {
  const declared = new Set<BindingId>();
  const inlined = new Set<BindingId>();
  const client = (id: BindingId) => {
    const form = functions.get(id)?.form;
    return form === "qrl" || form === "both";
  };
  const visit = (code: Code, kind: CodeKind, synchronous: boolean, discarded: boolean): void => {
    const sites = callSites(code.code, kind, discarded);
    const reached = new Map<BindingId, { inPlace: boolean; local: boolean; other: boolean }>();
    for (const reference of code.refs) {
      if (reference.kind !== "Binding" || !client(reference.binding)) continue;
      const fn = functions.get(reference.binding)!.item.function;
      const site = reference.call ? sites.get(reference.span.start - code.span.start) : undefined;
      const entry = reached.get(reference.binding) ?? {
        inPlace: false,
        local: false,
        other: false,
      };
      if (site && inlinedAt(fn, site, synchronous)) {
        entry.inPlace = true;
        entry.local ||= !(site.statement && spliceable(fn));
      } else {
        entry.other = true;
      }
      reached.set(reference.binding, entry);
    }
    for (const [id, { inPlace, local, other }] of reached) {
      if (inPlace) inline(id);
      if (other && !local) need(id);
    }
  };
  const body = (id: BindingId) => functions.get(id)!.item.function;
  const need = (id: BindingId) => {
    if (declared.has(id)) return;
    declared.add(id);
    visit(body(id).body, kindOf(body(id)), false, false);
  };
  const inline = (id: BindingId) => {
    if (inlined.has(id)) return;
    inlined.add(id);
    visit(body(id).body, kindOf(body(id)), true, false);
  };
  for (const [listener, group] of listeners.groups) {
    if (listener.handler.kind === "Inline") {
      const fn = listener.handler.function;
      visit(fn.body, kindOf(fn), group.synchronous, true);
    } else if (client(listener.handler.binding)) {
      // The handler's call of the function it names (./listeners.ts), a statement.
      const site = { nested: false, awaited: false, returned: false, statement: true };
      if (inlinedAt(body(listener.handler.binding), site, group.synchronous)) {
        inline(listener.handler.binding);
      } else {
        need(listener.handler.binding);
      }
    }
  }
  for (const item of component.setup) {
    switch (item.kind) {
      // A task's calls run in place (./setup.ts `bodyStatements`).
      case "Watch":
        visit(item.callback.body, kindOf(item.callback), true, true);
        break;
      case "WatchEffect":
        visit(item.effect.body, kindOf(item.effect), true, true);
        break;
      case "Lifecycle":
        visit(item.callback.body, kindOf(item.callback), true, item.hook === "mounted");
        break;
      case "State":
      case "Variable":
      case "Const":
      case "Derived":
      case "Function":
      case "TemplateRef":
      case "Id":
        break;
      default:
        unreachable(item);
    }
  }
  return declared;
}

const kindOf = (fn: FunctionCode): CodeKind => (fn.expression ? "expression" : "statements");

/** The functions taking an event that code calls, in order, each once. */
export function eventCallees(
  refs: readonly CodeReference[],
  functions: ReadonlyMap<BindingId, unknown>,
): BindingId[] {
  const found: BindingId[] = [];
  for (const reference of refs) {
    if (reference.kind === "Binding" && reference.call && functions.has(reference.binding)) {
      if (!found.includes(reference.binding)) found.push(reference.binding);
    }
  }
  return found;
}

/**
 * The rules setup code and templates are printed with. Signals keep `.value` as the source
 * writes it; a setup `let` is a signal, so its reads and writes gain `.value`; a template ref
 * attached inside a conditional is read through `rendered()`, since Qwik keeps a removed
 * element in its ref (ADR-0049); `emit("change", v)` calls the event's QRL prop,
 * `onChange$?.(v)`, and does not wait for it (the semantics contract: listeners may run
 * later); `nextTick()` is the target's helper; `event.currentTarget` is the element Qwik passes
 * as a handler's second argument (its listeners run from one document listener, ADR-0047).
 */
function rewriteRules(plan: SetupPlan, event: string | undefined): RewriteRules {
  const { names } = plan;
  return {
    binding(reference, binding, written, site) {
      switch (binding.kind) {
        case "prop":
        case "loopVar":
        case "state":
        case "derived":
        case "localConst":
        case "emit":
          return written;
        case "templateRef":
          if (site !== "client") return written;
          // \`rendered()\` gives \`T | null\`; a read used whole converts Qwik's \`undefined\`.
          if (plan.conditionalRefs.has(binding.id)) return `${names.once("rendered")}(${written})`;
          return plan.wholeRefReads.has(reference.span.start) ? `(${written} ?? null)` : written;
        case "localVar":
          return `${written}.value`;
        case "localFn": {
          const fn = plan.functions.get(binding.id);
          const name = isClient(site) && fn?.form === "both" ? fn.qrl : written;
          // A read inside the cycle it closes, through the holder (see {@link StablePlan}).
          return plan.stable.lazy.has(reference.span.start)
            ? `${plan.stable.holder!.name}.${name}`
            : name;
        }
        default:
          return unreachable(binding.kind);
      }
    },
    emit(emit, _binding, parts) {
      return `${plan.eventProp(emit.event)}?.(${parts.arguments.join(", ")})`;
    },
    api() {
      return names.once("nextTick");
    },
    event(reference) {
      if (reference.member === "currentTarget") return names.once("element");
      if (event === undefined) {
        throw new Error(
          `\`${reference.member}\` of an event read where no event parameter is known.`,
        );
      }
      return `${event}.${reference.member}`;
    },
  };
}

const isClient = (site: RewriteSite) => site === "client";

/** The bindings a piece of code references, writes included. */
export function referencedIds(refs: readonly CodeReference[]): Set<BindingId> {
  const found = new Set<BindingId>();
  for (const reference of refs) {
    switch (reference.kind) {
      case "Binding":
      case "Write":
        found.add(reference.binding);
        break;
      case "Global":
      case "Emit":
      case "Api":
      case "Event":
        break;
      default:
        unreachable(reference);
    }
  }
  return found;
}

/** The code of a setup function: its body and its parameters' defaults (static). */
function functionRefs(fn: FunctionCode): CodeReference[] {
  return fn.body.refs;
}

/**
 * The constants and functions that capture nothing of the component: what they reference,
 * followed through each other, is only such constants and functions (and globals). They move
 * to module scope (ADR-0045, `unicorn/consistent-function-scoping`). The greatest such set: the
 * analyser rejects recursion, so this is the set a reader would hoist.
 */
function hoistable(component: UfComponent): Set<BindingId> {
  const candidates = new Map<BindingId, readonly CodeReference[]>();
  for (const item of component.setup) {
    if (item.kind === "Const") candidates.set(item.binding, item.value.refs);
    else if (item.kind === "Function") candidates.set(item.binding, functionRefs(item.function));
  }
  const hoisted = new Set(candidates.keys());
  for (let changed = true; changed;) {
    changed = false;
    for (const [id, refs] of candidates) {
      if (!hoisted.has(id)) continue;
      const captures = refs.some((reference) => {
        switch (reference.kind) {
          case "Binding":
            return !hoisted.has(reference.binding);
          case "Write":
          case "Emit":
            return true;
          case "Global":
          case "Api":
          case "Event":
            return false;
          default:
            return unreachable(reference);
        }
      });
      if (captures) {
        hoisted.delete(id);
        changed = true;
      }
    }
  }
  return hoisted;
}

/**
 * Where each setup function goes (see {@link FunctionForm}). Render code (the template, and the
 * initial values and `const`s the component's body evaluates) calls plain functions; client
 * code (handlers, watch callbacks, effects, hooks, and the functions they call) calls QRLs.
 * Getters are `$` scopes too, which the analyser lets call only functions that capture nothing
 * (ADR-0045), and those are at module scope.
 */
function planFunctions(
  component: UfComponent,
  hoisted: ReadonlySet<BindingId>,
  names: OutputNames,
): Map<BindingId, FunctionPlan> {
  const items = new Map<BindingId, FunctionItem>();
  for (const item of component.setup) if (item.kind === "Function") items.set(item.binding, item);
  const render = new Set<BindingId>();
  const client = new Set<BindingId>();
  const mark = (target: Set<BindingId>, refs: readonly CodeReference[]) => {
    for (const reference of refs) {
      if (reference.kind === "Binding" && items.has(reference.binding))
        target.add(reference.binding);
    }
  };
  for (const { expression } of expressionsOf(component)) mark(render, expression.refs);
  for (const item of component.setup) {
    switch (item.kind) {
      case "State":
      case "Variable":
        if (item.initial) mark(render, item.initial.refs);
        break;
      case "Const":
        mark(render, item.value.refs);
        break;
      case "Derived":
        mark(render, item.getter.body.refs);
        break;
      case "Watch":
        for (const source of item.sources) {
          if (source.kind === "Getter") mark(render, source.getter.body.refs);
        }
        mark(client, item.callback.body.refs);
        break;
      case "WatchEffect":
        mark(client, item.effect.body.refs);
        break;
      case "Lifecycle":
        mark(client, item.callback.body.refs);
        break;
      case "Function":
      case "TemplateRef":
      case "Id":
        break;
      default:
        unreachable(item);
    }
  }
  walk(component.render, {
    enter(node) {
      if (node.kind !== "Element") return;
      for (const attribute of node.attributes) {
        if (attribute.kind !== "Event") continue;
        if (attribute.handler.kind === "Function") client.add(attribute.handler.binding);
        else mark(client, attribute.handler.function.body.refs);
      }
    },
  });
  // A function's calls take the forms of its callers.
  for (let changed = true; changed;) {
    changed = false;
    for (const [id, item] of items) {
      for (const set of [render, client]) {
        if (!set.has(id)) continue;
        for (const reference of functionRefs(item.function)) {
          if (
            reference.kind === "Binding" &&
            items.has(reference.binding) &&
            !set.has(reference.binding)
          ) {
            set.add(reference.binding);
            changed = true;
          }
        }
      }
    }
  }
  const plans = new Map<BindingId, FunctionPlan>();
  for (const [id, item] of items) {
    const binding = bindingOf(component, id);
    const form: FunctionForm = hoisted.has(id)
      ? "module"
      : render.has(id) && client.has(id)
        ? "both"
        : client.has(id)
          ? "qrl"
          : "render";
    const qrl = form === "both" ? names.fresh(`${binding.name}Qrl`) : binding.name;
    plans.set(id, { item, binding, form, qrl });
  }
  return plans;
}

/**
 * Where each setup `const` goes: module scope when it captures nothing of the component (ADR-0045);
 * `useConstant(() => …)` when its value reads a prop, a state or a derived value, which a plain
 * `const` would read again on each render of the component (setup runs once, ADR-0045); a plain
 * `const` otherwise (it reads only values that never change: ids, other constants).
 */
function planConsts(
  component: UfComponent,
  hoisted: ReadonlySet<BindingId>,
): Map<BindingId, ConstForm> {
  const forms = new Map<BindingId, ConstForm>();
  for (const item of component.setup) {
    if (item.kind !== "Const") continue;
    forms.set(item.binding, constForm(item, component, hoisted));
  }
  return forms;
}

function constForm(
  item: ConstItem,
  component: UfComponent,
  hoisted: ReadonlySet<BindingId>,
): ConstForm {
  if (hoisted.has(item.binding)) return "module";
  return readsReactive(item.value, component) ? "constant" : "plain";
}

/** Whether code reads a prop, a state or a derived value, itself or through what it calls. */
export function readsReactive(code: Code, component: UfComponent): boolean {
  return [...summarizeCode(code, component).reads].some((id) =>
    isReactive(bindingOf(component, id).kind),
  );
}

/**
 * Whether a binding's value can change while the component lives, so that what reads it is
 * tracked: a prop, a state or a derived value. A setup `let` and a template ref change too, but
 * nothing tracks them (UF2010).
 */
export function isReactive(kind: BindingKind): boolean {
  switch (kind) {
    case "prop":
    case "state":
    case "derived":
      return true;
    case "loopVar":
    case "templateRef":
    case "localConst":
    case "localFn":
    case "localVar":
    case "emit":
      return false;
    default:
      return unreachable(kind);
  }
}

/** The events some code of the component emits. */
function emittedEvents(component: UfComponent): Set<string> {
  const found = new Set<string>();
  const visit = (refs: readonly CodeReference[]) => {
    for (const reference of refs) if (reference.kind === "Emit") found.add(reference.event);
  };
  for (const item of component.setup) {
    switch (item.kind) {
      case "Function":
        visit(item.function.body.refs);
        break;
      case "Watch":
        visit(item.callback.body.refs);
        break;
      case "WatchEffect":
        visit(item.effect.body.refs);
        break;
      case "Lifecycle":
        visit(item.callback.body.refs);
        break;
      case "State":
      case "Derived":
      case "TemplateRef":
      case "Id":
      case "Const":
      case "Variable":
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
  return found;
}

/** The template refs attached to an element inside a conditional's branch. */
function refsInConditionals(component: UfComponent): Set<BindingId> {
  const found = new Set<BindingId>();
  const visit = (node: RenderNode, conditional: boolean): void => {
    switch (node.kind) {
      case "Element":
        if (conditional) {
          for (const attribute of node.attributes) {
            if (attribute.kind === "Ref") found.add(attribute.binding);
          }
        }
        for (const child of node.children) visit(child, conditional);
        return;
      case "If":
        for (const branch of node.branches) {
          for (const child of branch.children) visit(child, true);
        }
        return;
      case "For":
        visit(node.body, conditional);
        return;
      case "Text":
      case "Interpolation":
        return;
      default:
        unreachable(node);
    }
  };
  const root = component.render;
  if (root.kind === "Fragment") for (const child of root.children) visit(child, false);
  else visit(root, false);
  return found;
}

/** The `never` default of an exhaustive switch: a kind added to a union fails type checking. */
export function unreachable(value: never): never {
  throw new Error(`Unexpected IR value: ${JSON.stringify(value)}`);
}
