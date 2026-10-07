// Listeners in Qwik (ADR-0047): `onClick={…}` → `onClick$={…}`, by the DOM event's
// name (./events.ts), the handler a `$` scope Qwik loads when the event first fires. The
// listeners of one element, event and scope are one prop (./plan.ts `ListenerGroup`): one `$`
// handler that runs them in attribute order, after the `sync$` handlers that run their controls
// (./handlers.ts). Several listeners never share an array of `$` handlers: Qwik's loader starts
// an element's handler after one that returned a promise only once every handler started before
// it has finished (qwikloader's `dispatch` and `queueTasks`). Across elements, the loader runs
// each element's handler as it walks the path, at once when its code has loaded: the order of a
// page whose code has loaded (ADR-0050). So a handler that another listener of the dispatch may
// follow writes its calls in place (./inline.ts), and an async one returns after its synchronous
// part, the rest going on by itself: the next listener sees what the synchronous part wrote. The
// options:
// - capture: Qwik's `capture:<event>` runs every handler of that event on the element in the
//   capture phase. Where an element listens to one event in both phases, its capture listener
//   runs from the window instead (`window:onClick$`, which Qwik runs first, for the elements in
//   document order) when the event's target is inside the element, and so does every capture
//   listener of that event in the component, which keeps their order;
// - passive: `passive:<event>`, unless the component also listens to the event otherwise;
// - once: Qwik has no `once`, so the handler skips an element it has run for, which a WeakSet
//   holds, and takes the element's `preventdefault:`/`stoppropagation:` off after its first run
//   unless another listener of the element still needs it.
// A control runs at dispatch as the element's marker only where it runs on every event and the
// element has no window listener of the event (the loader applies an element's markers to every
// event it broadcasts to the window listener, wherever the event happened): else in a `sync$`.
import {
  functionSource,
  handlerControls,
  js,
  parseCodeSource,
  rewriteCode,
} from "@unframework/codegen";
import type { CodeKind, JsxContext, LiftedControl } from "@unframework/codegen";
import type { ElementNode, EventAttribute, FunctionCode, Parameter } from "@unframework/ir";

import { qwikListenerProp } from "./events.ts";
import { readsName, splitHandler } from "./handlers.ts";
import type { SplitHandler } from "./handlers.ts";
import type { ListenerGroup, SetupPlan } from "./plan.ts";
import { clientCode, passEvent } from "./setup.ts";
import { batches, negation, syncHandler } from "./syncs.ts";
import type { SyncBatch } from "./syncs.ts";

type JsxAttribute = ReturnType<typeof js.jsxAttribute>;

/** A group's `$` handler: an arrow written in place takes `typed` in an array, which wraps it in `$()`. */
interface Handler {
  code: (typed: boolean) => string;
  /** Whether it is an arrow written in place, which an array wraps in `$()`. */
  inline: boolean;
}

/** What a group lowers to: the controls its `sync$` runs, its `$` handler, the element's markers. */
interface Lowered {
  syncs: SyncBatch[];
  handler?: Handler;
  /** `preventdefault:submit`, `stoppropagation:click`: the loader's markers. */
  markers: string[];
  /** Every control of the group, with the listener that makes it. */
  controls: { listener: EventAttribute; lifted: LiftedControl }[];
  /** The type of the group's event, as its listeners take it. */
  eventType: string;
}

/** A listener of a group, with what its handler is made of. */
interface Member {
  listener: EventAttribute;
  /** The function it runs: written in place, or the setup function it names. */
  fn: FunctionCode;
  /** Its body without the controls that moved out of it. */
  split: SplitHandler;
  /** The setup function it names: how a call spells it, and the parameters it takes. */
  named?: {
    name: string;
    takes: readonly Parameter[];
    /** A module-level function, called synchronously. */
    module: boolean;
    /** Whether nothing is left of it (its body was only controls). */
    empty: boolean;
  };
  controls: LiftedControl[];
  /** The markers of its controls, and the controls that run in a `sync$`. */
  markers: string[];
  syncs: LiftedControl[];
}

/** The listeners of a component, printed per element and event at the first of them. */
export class Listeners {
  readonly #plan: SetupPlan;
  /** The elements and events already printed. */
  readonly #printed = new Set<EventAttribute>();
  /** The `once` listeners' WeakSets, declared after the component. */
  readonly helpers: string[] = [];

  constructor(plan: SetupPlan) {
    this.#plan = plan;
  }

  /** The JSX attributes of `attribute`'s event on `element`, at its first listener; `[]` after. */
  attributes(attribute: EventAttribute, element: ElementNode, context: JsxContext): JsxAttribute[] {
    const listeners = element.attributes.filter(
      (other): other is EventAttribute => other.kind === "Event" && other.event === attribute.event,
    );
    const [first] = listeners;
    if (first !== attribute || this.#printed.has(first)) return [];
    this.#printed.add(first);
    return this.#event(attribute.event, listeners, context);
  }

  #event(event: string, listeners: readonly EventAttribute[], context: JsxContext): JsxAttribute[] {
    const plan = this.#plan;
    const groups = [
      ...new Set(listeners.map((listener) => plan.listeners.groups.get(listener)!)),
    ].toSorted((a, b) => (a.scope === b.scope ? 0 : a.scope === "element" ? -1 : 1));
    const window = groups.some((group) => group.scope === "window");
    const attributes: JsxAttribute[] = [];
    if (!window && listeners.some((listener) => listener.capture)) {
      attributes.push(js.jsxAttribute(`capture:${event}`));
    }
    const passive =
      listeners.some((listener) => listener.passive) && !plan.listeners.mixedPassive.has(event);
    if (passive) attributes.push(js.jsxAttribute(`passive:${event}`));
    const lowered = new Map(
      groups.map((group) => [group.scope, this.#group(group, { markers: !window, passive })]),
    );
    const markers = [...lowered.values()].flatMap((each) => each.markers);
    for (const marker of new Set(markers)) attributes.push(js.jsxAttribute(marker));
    for (const scope of ["element", "window"] as const) {
      const found = lowered.get(scope);
      // A `$` handler beside a `sync$` waits for it: Qwik's loader starts the handler once every
      // handler started before it on the page has finished (qwikloader's `dispatch` and
      // `queueTasks`), which the semantics page declares. Where nothing is left but markers, a
      // `sync$` that runs the same controls keeps the element's listener of the event: Qwik's
      // loader listens only to the events some element has a handler of, and applies a marker
      // only as it dispatches one.
      const syncs =
        found && !found.handler && !found.syncs.length && found.markers.length
          ? batches(found.controls.map(({ lifted }) => lifted))
          : (found?.syncs ?? []);
      // A window group's controls are `conditional-event-control` (Qwik's cell): its `sync$`
      // is printed only beside that error.
      const sync = found && syncHandler(plan, syncs, found.eventType);
      const entries = [
        ...(sync ? [{ code: () => sync, inline: false }] : []),
        ...(found?.handler ? [found.handler] : []),
      ];
      if (!entries.length) continue;
      const value =
        entries.length === 1
          ? context.placeholders.expression(entries[0]!.code(false))
          : js.arrayExpression(
              entries.map(({ code, inline }) =>
                context.placeholders.expression(
                  inline ? `${plan.names.core("$")}(${code(true)})` : code(true),
                ),
              ),
            );
      attributes.push(
        js.jsxAttribute(qwikListenerProp(event, scope), js.jsxExpressionContainer(value)),
      );
    }
    return attributes;
  }

  /** A group's prop: its controls' markers and `sync$` handlers, and one `$` handler. */
  #group(group: ListenerGroup, options: { markers: boolean; passive: boolean }): Lowered {
    const plan = this.#plan;
    const members = group.listeners.map((listener) => this.#member(listener, group, options));
    // A `once` listener takes its markers off after its first run, unless a listener of the
    // element that runs every time still needs them.
    const kept = new Set(members.flatMap((member) => (member.listener.once ? [] : member.markers)));
    const syncs = batches(members.flatMap((member) => member.syncs));
    const markers = [...new Set(members.flatMap((member) => member.markers))];
    const controls = members.flatMap(({ listener, controls: lifted }) =>
      lifted.map((each) => ({ listener, lifted: each })),
    );
    const eventType = groupEventType(members);
    if (members.length === 1) {
      const handler = this.#single(members[0]!, group, kept);
      return { syncs, markers, controls, eventType, ...(handler ? { handler } : {}) };
    }
    const element = plan.names.once("element");
    const eventName = commonEventName(members, plan);
    const parts = members.map((member) => this.#part(member, group, eventName, kept));
    const guard =
      group.scope === "window"
        ? [`if (!${element}.contains(${eventName}.target as Node)) return;`]
        : [];
    const body = [...guard, ...parts].filter(Boolean).join("\n");
    const usesElement = readsName(body, element);
    const usesEvent = readsName(body, eventName);
    const parameters = (typed: boolean) => {
      const list: string[] = [];
      if (usesEvent || usesElement) {
        list.push(`${usesEvent ? eventName : "_"}${typed ? `: ${eventType}` : ""}`);
      }
      if (usesElement) list.push(`${element}${typed ? ": Element" : ""}`);
      return list.join(", ");
    };
    return {
      syncs,
      markers,
      controls,
      eventType,
      handler: { code: (typed) => `(${parameters(typed)}) => {\n${body}\n}`, inline: true },
    };
  }

  /** What one listener is made of: its function, its body, its controls and where they run. */
  #member(
    listener: EventAttribute,
    group: ListenerGroup,
    options: { markers: boolean; passive: boolean },
  ): Member {
    const plan = this.#plan;
    let fn: FunctionCode;
    let split: SplitHandler;
    let named: Member["named"];
    if (listener.handler.kind === "Inline") {
      fn = listener.handler.function;
      split = splitHandler(fn, plan.component, plan.emptyFunctions);
    } else {
      const fnPlan = plan.functions.get(listener.handler.binding)!;
      const planned = plan.eventFunctions.get(listener.handler.binding);
      fn = fnPlan.item.function;
      split = planned?.split ?? noControls(fn);
      const declared = planned === undefined ? fn : planned.code;
      named = {
        name: fnPlan.form === "both" ? fnPlan.qrl : fnPlan.binding.name,
        takes: declared?.parameters ?? [],
        module: fnPlan.form === "module",
        empty: planned?.code === null,
      };
    }
    // A passive listener's `preventDefault()` does nothing: where it is not passive here (the
    // component also listens to the event otherwise), it is left out.
    const controls = handlerControls(fn, plan.component).controls.filter(
      ({ control }) =>
        !(listener.passive && !options.passive && control.method === "preventDefault"),
    );
    const markers: string[] = [];
    const syncs: LiftedControl[] = [];
    for (const lifted of controls) {
      const always = !lifted.tests.length && lifted.control.condition === undefined;
      if (always && options.markers && group.scope === "element") {
        const marker = `${lifted.control.method === "preventDefault" ? "preventdefault" : "stoppropagation"}:${listener.event}`;
        if (!markers.includes(marker)) markers.push(marker);
      } else {
        syncs.push(lifted);
      }
    }
    return { listener, fn, split, ...(named ? { named } : {}), controls, markers, syncs };
  }

  /** The `$` handler of a group of one listener, with its guards. */
  #single(member: Member, group: ListenerGroup, kept: ReadonlySet<string>): Handler | undefined {
    const plan = this.#plan;
    const { listener, fn, split, named } = member;
    const once = listener.once === true;
    const eventParameter = fn.parameters.find((parameter) => parameter.event !== undefined);
    const eventName = eventParameter?.name ?? localName("event", fn, plan);
    const element = plan.names.once("element");
    const guards: string[] = [];
    if (group.scope === "window") {
      guards.push(`if (!${element}.contains(${eventName}.target as Node)) return;`);
    }
    if (once) {
      const set = this.#onceSet(listener);
      guards.push(`if (${set}.has(${element})) return;`, `${set}.add(${element});`);
      for (const marker of member.markers) {
        if (!kept.has(marker)) guards.push(`${element}.removeAttribute("${marker}");`);
      }
    }
    const guarded = guards.length > 0;
    if (named) {
      if (named.empty && !(once && member.markers.length)) return undefined;
      // A module-level function is a handler through its own QRL, which the optimizer makes a
      // segment that imports it: a plain function would not serialise with the page.
      const reference = named.module ? `${plan.names.core("$")}(${named.name})` : named.name;
      const inPlace = group.synchronous && !named.module && !named.empty;
      if (!guarded && !inPlace) return { code: () => reference, inline: false };
      const args = named.takes.map((parameter) =>
        parameter.name === element ? element : eventName,
      );
      const call = named.empty ? "" : `${named.name}(${args.join(", ")});`;
      const settled = call
        ? clientCode(plan, `{\n${call}\n}`, "statements", group.synchronous)
        : { code: "{}", kind: "statements" as CodeKind, async: false };
      const statements = settled.code.trim().slice(1, -1).trim();
      const usesEvent =
        guards.some((guard) => readsName(guard, eventName)) || readsName(statements, eventName);
      const usesElement =
        guards.some((guard) => readsName(guard, element)) || readsName(statements, element);
      const eventType = eventParameter?.type?.code ?? eventParameter?.event ?? "Event";
      const parameters = (typed: boolean) => {
        const list: string[] = [];
        if (usesEvent || usesElement)
          list.push(`${usesEvent ? eventName : "_"}${typed ? `: ${eventType}` : ""}`);
        if (usesElement) list.push(`${element}${typed ? ": Element" : ""}`);
        return list.join(", ");
      };
      return {
        code: (typed) =>
          `${settled.async ? "async " : ""}(${parameters(typed)}) => {\n${[...guards, statements].filter(Boolean).join("\n")}\n}`,
        inline: true,
      };
    }
    if (split.empty && !(guarded && once && member.markers.length)) return undefined;
    return {
      code: (typed) => this.#inline(fn, split, guards, eventName, typed, group.synchronous),
      inline: true,
    };
  }

  /**
   * One listener of a merged group, as statements: its body (or its call of the function it
   * names), behind its `once` guard, in a block of its own unless it is one statement. A body
   * that awaits floats, `void (async () => {…})()`, so that the next listener runs after its
   * synchronous part; one that returns early runs the rest under the guards' negation, or is a
   * local function the handler calls.
   */
  #part(
    member: Member,
    group: ListenerGroup,
    eventName: string,
    kept: ReadonlySet<string>,
  ): string {
    const plan = this.#plan;
    const { listener, fn, split, named } = member;
    const element = plan.names.once("element");
    const own = fn.parameters.find((parameter) => parameter.event !== undefined)?.name ?? eventName;
    let statements = "";
    // Whether the printed statements await: a call written in place keeps an async callee's
    // `await`s in its own function (./inline.ts).
    let awaits = false;
    if (named) {
      if (!named.empty) {
        const args = named.takes.map((parameter) => (parameter.name === element ? element : own));
        const call = `${named.name}(${args.join(", ")});`;
        const settled = named.module
          ? { code: `{\n${call}\n}`, async: false }
          : clientCode(plan, `{\n${call}\n}`, "statements", true);
        statements = settled.code.trim().slice(1, -1).trim();
        awaits = settled.async;
      }
    } else if (!split.empty) {
      const kind: CodeKind = fn.expression ? "expression" : "statements";
      const rewritten = passEvent(
        plan,
        rewriteCode(split.body, plan.component, plan.rules(own), "client"),
        kind,
        split.body,
        own,
      );
      const block = fn.expression ? `{\n${asStatement(rewritten)}\n}` : rewritten;
      const settled = clientCode(plan, block, "statements", true);
      statements = settled.code.trim().slice(1, -1).trim();
      awaits = settled.async || (fn.async === true && awaitsIn(statements));
    }
    if (statements && awaits) {
      statements = `void (async () => {\n${statements}\n})();`;
    } else if (statements && returnsEarly(statements)) {
      statements = this.#guarded(statements);
    }
    if (statements && own !== eventName && readsName(statements, own)) {
      statements = `const ${own} = ${eventName};\n${statements}`;
    }
    if (!listener.once) return statementCount(statements) > 1 ? `{\n${statements}\n}` : statements;
    const set = this.#onceSet(listener);
    const removals = member.markers
      .filter((marker) => !kept.has(marker))
      .map((marker) => `${element}.removeAttribute("${marker}");`);
    return `if (!${set}.has(${element})) {\n${[`${set}.add(${element});`, ...removals, statements].filter(Boolean).join("\n")}\n}`;
  }

  /**
   * A listener's statements that return early, as statements of a merged handler: the rest under
   * the negation of its leading guard clauses (`if (tags.value.length === 0) return;` → `if
   * (tags.value.length !== 0) { … }`) where they are its only returns, else a local function the
   * handler calls.
   */
  #guarded(statements: string): string {
    const { root } = parseCodeSource(`{\n${statements}\n}`, "statements");
    const [block] = root as { type: string; body: GuardNode[] }[];
    const body = block!.body;
    const offset = 2;
    const text = (node: { start: number; end: number }) =>
      statements.slice(node.start - offset, node.end - offset);
    const guards: string[] = [];
    let index = 0;
    for (; index < body.length; index++) {
      const statement = body[index]!;
      const exit =
        statement.type === "IfStatement" &&
        !statement.alternate &&
        (statement.consequent!.type === "ReturnStatement" ||
          (statement.consequent!.type === "BlockStatement" &&
            statement.consequent!.body!.length === 1 &&
            statement.consequent!.body![0]!.type === "ReturnStatement"));
      if (!exit) break;
      const returned =
        statement.consequent!.type === "ReturnStatement"
          ? statement.consequent!
          : statement.consequent!.body![0]!;
      // A returned value is the listener's, which nothing reads: only one without effects goes.
      if (
        returned.argument &&
        !/^(?:true|false|null|undefined|\d+|"[^"]*")$/.test(text(returned.argument))
      ) {
        break;
      }
      guards.push(negation(text(statement.test!)));
    }
    const rest = body.slice(index);
    if (guards.length && rest.length && !rest.some((statement) => returnsEarly(text(statement)))) {
      const condition = guards
        .map((guard) => (guards.length > 1 && /\|\||\?/.test(guard) ? `(${guard})` : guard))
        .join(" && ");
      // A block alone needs no braces of its own inside the `if`'s.
      const [only] = rest;
      const inner =
        rest.length === 1 && only!.type === "BlockStatement"
          ? text(only!).trim().slice(1, -1).trim()
          : rest.map(text).join("\n");
      return `if (${condition}) {\n${inner}\n}`;
    }
    const name = this.#plan.names.fresh("listener");
    return `const ${name} = () => {\n${statements}\n};\n${name}();`;
  }

  /** The WeakSet of the elements a `once` listener ran for, declared after the component. */
  #onceSet(listener: EventAttribute): string {
    const event = listener.event;
    const set = this.#plan.names.fresh(`once${event.charAt(0).toUpperCase()}${event.slice(1)}`);
    this.helpers.push(`const ${set} = new WeakSet<Element>();`);
    return set;
  }

  /** An inline handler as an arrow: its rest, after the guards, with Qwik's arguments. */
  #inline(
    fn: FunctionCode,
    split: SplitHandler,
    guards: readonly string[],
    eventName: string,
    typed: boolean,
    synchronous: boolean,
  ): string {
    const plan = this.#plan;
    const element = plan.names.once("element");
    const kind: CodeKind = fn.expression ? "expression" : "statements";
    const rewritten = split.empty
      ? ""
      : passEvent(
          plan,
          rewriteCode(split.body, plan.component, plan.rules(eventName), "client"),
          kind,
          split.body,
          eventName,
        );
    // Behind guards an expression body is a statement; and where another listener may follow,
    // so is an expression body whose value may be a promise (a call's): the handler never returns
    // a promise the loader would make a handler it queues wait for.
    const statement =
      fn.expression && (guards.length > 0 || (synchronous && valueIsCall(rewritten)));
    const settled = split.empty
      ? { code: guards.length ? "{}" : "", kind, async: false }
      : statement || guards.length
        ? clientCode(
            plan,
            statement ? `{\n${asStatement(rewritten)}\n}` : rewritten,
            "statements",
            synchronous,
          )
        : clientCode(plan, rewritten, kind, synchronous, true);
    const statements = guards.length ? settled.code.trim().slice(1, -1).trim() : settled.code;
    // What the printed code reads: a call written in place may read the event no more.
    const reads = (name: string) =>
      readsName(statements, name) || guards.some((guard) => readsName(guard, name));
    const needsElement = reads(element);
    const needsEvent = needsElement || reads(eventName);
    const parameters: Parameter[] = [];
    const at = { start: 0, end: 0 };
    const own = fn.parameters[0];
    const type = (code: string | undefined) =>
      typed && code !== undefined ? { type: { code, span: at } } : {};
    if (needsEvent) {
      // An event nothing reads before the element Qwik passes is `_`, as Qwik's guides write it.
      const eventType = own?.type?.code ?? own?.event ?? "Event";
      parameters.push({
        ...(own ?? { span: at }),
        name: reads(eventName) ? (own?.name ?? eventName) : "_",
        ...type(eventType),
      });
    }
    if (needsElement) parameters.push({ name: element, span: at, ...type("Element") });
    const async = fn.async === true || settled.async;
    // A listener that another listener of the dispatch may follow: an async body goes on by
    // itself, as it does on the source's semantics, and the handler returns after its synchronous
    // part, so a handler the loader queues behind it waits for that part only (./plan.ts).
    if (async && synchronous && statements) {
      const body = guards.length
        ? statements
        : settled.kind === "statements"
          ? statements.trim().slice(1, -1).trim()
          : asStatement(statements);
      const printed: FunctionCode = { ...fn, parameters };
      delete printed.async;
      delete printed.expression;
      delete printed.returnType;
      const floating = `void (async () => {\n${body}\n})();`;
      return functionSource(printed, `{\n${[...guards, floating].join("\n")}\n}`);
    }
    const printed: FunctionCode = {
      ...fn,
      parameters,
      ...(async ? { async: true as const } : {}),
    };
    if (guards.length || settled.kind === "statements") delete printed.expression;
    if (!guards.length) return functionSource(printed, statements);
    return functionSource(printed, `{\n${[...guards, statements].filter(Boolean).join("\n")}\n}`);
  }
}

/** An expression as a statement: an object literal or a function in parentheses. */
function asStatement(code: string): string {
  return `${/^(?:\{|function\b|class\b|let\s*\[)/.test(code.trimStart()) ? `(${code})` : code};`;
}

/** A statement of a listener's body, as far as {@link Listeners} reads it. */
interface GuardNode {
  type: string;
  start: number;
  end: number;
  test?: GuardNode;
  consequent?: GuardNode;
  alternate?: GuardNode | null;
  body?: GuardNode[];
  argument?: GuardNode | null;
}

/** Whether statements return, outside the functions in them. */
function returnsEarly(statements: string): boolean {
  if (!/(?<![\w$.])return\b/.test(statements)) return false;
  const { root } = parseCodeSource(`{\n${statements}\n}`, "statements");
  let found = false;
  const visit = (node: unknown): void => {
    if (found || !node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    const typed = node as { type?: unknown };
    if (typeof typed.type !== "string") return;
    if (typed.type === "ReturnStatement") {
      found = true;
      return;
    }
    if (/Function/.test(typed.type)) return;
    for (const [key, value] of Object.entries(typed)) {
      if (key !== "type" && key !== "parent" && typeof value === "object") visit(value);
    }
  };
  visit(root);
  return found;
}

/**
 * Whether an expression's value is a call's (a promise, maybe): the call itself, an `await`, or
 * a call through `a && call`, `a ? call : b`, `a, call`.
 */
function valueIsCall(expression: string): boolean {
  return valueNodeIsCall(parseCodeSource(expression, "expression").root as ValueNode);
}

/** A node of an expression, as far as {@link valueIsCall} reads it. */
interface ValueNode {
  type: string;
  right?: ValueNode;
  consequent?: ValueNode;
  alternate?: ValueNode;
  expressions?: ValueNode[];
}

function valueNodeIsCall(node: ValueNode): boolean {
  switch (node.type) {
    case "CallExpression":
    case "NewExpression":
    case "AwaitExpression":
    case "ChainExpression":
      return true;
    case "LogicalExpression":
      return valueNodeIsCall(node.right!);
    case "ConditionalExpression":
      return valueNodeIsCall(node.consequent!) || valueNodeIsCall(node.alternate!);
    case "SequenceExpression":
      return valueNodeIsCall(node.expressions!.at(-1)!);
    default:
      return false;
  }
}

/** Whether statements await, outside the functions in them. */
function awaitsIn(statements: string): boolean {
  if (!/\bawait\b/.test(statements)) return false;
  const { root } = parseCodeSource(`{\n${statements}\n}`, "statements");
  let found = false;
  const visit = (node: unknown): void => {
    if (found || !node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    const typed = node as { type?: unknown; await?: unknown };
    if (typeof typed.type !== "string" || /Function/.test(typed.type)) return;
    if (typed.type === "AwaitExpression" || (typed.type === "ForOfStatement" && typed.await)) {
      found = true;
      return;
    }
    for (const [key, value] of Object.entries(typed)) {
      if (key !== "type" && key !== "parent" && typeof value === "object") visit(value);
    }
  };
  visit(root);
  return found;
}

/** How many statements code is, at its top level. */
function statementCount(statements: string): number {
  if (!statements.trim()) return 0;
  const { root } = parseCodeSource(`{\n${statements}\n}`, "statements");
  const [block] = root as { body: unknown[] }[];
  return block!.body.length;
}

/** The event parameter a merged group's handler takes: its first listener's name for it. */
function commonEventName(members: readonly Member[], plan: SetupPlan): string {
  for (const { fn } of members) {
    const name = fn.parameters.find((parameter) => parameter.event !== undefined)?.name;
    if (name !== undefined) return name;
  }
  return localName("event", members[0]!.fn, plan);
}

/** The DOM interface of a merged group's event: its listeners' annotation, or the event's own. */
function groupEventType(members: readonly Member[]): string {
  for (const { fn } of members) {
    const parameter = fn.parameters.find((candidate) => candidate.event !== undefined);
    if (parameter) return parameter.type?.code ?? parameter.event ?? "Event";
  }
  return "Event";
}

/**
 * A name for a parameter the target adds to a handler: `name` itself when the handler's code does
 * not read it and no binding of the component takes it, else a free name.
 */
function localName(name: string, fn: FunctionCode, plan: SetupPlan): string {
  const taken =
    readsName(fn.body.code, name) ||
    plan.component.bindings.some((binding) => binding.name === name) ||
    plan.component.propsParameter?.name === name;
  return taken ? plan.names.fresh(name) : name;
}

/** A handler whose controls stay in it (a function also called or passed elsewhere). */
function noControls(fn: FunctionCode): SplitHandler {
  const event = fn.parameters.find((parameter) => parameter.event !== undefined)?.name;
  return {
    body: fn.body,
    empty: false,
    controls: [],
    currentTarget: false,
    usesEvent: event !== undefined && readsName(fn.body.code, event),
    removedCalls: [],
  };
}
