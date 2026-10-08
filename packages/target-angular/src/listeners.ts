// The template's listeners (ADR-0047). Angular's template statements are not JavaScript
// functions: no block bodies, no `++`, and a signal is written through `set`. So a listener is
// written in one of three ways:
// - `(click)="save()"`, `(keydown)="recordKey($event)"`: a setup function it names;
// - `(click)="pick(contact, index)"`, `(click)="open.emit(path)"`: an inline handler that is one
//   call of a setup function or of `emit`, with arguments the template can read (an inline
//   handler that reads a list's item, or a value a condition around it narrows, must be one,
//   UF3029: the template types and narrows what it reads);
// - `(click)="onClick($event)"`: any other inline handler, moved to a protected method of the
//   class, its event parameter annotated with its event's DOM interface when the source left it
//   to the JSX types.
// Angular prevents the event when a listener's value is `false`, which no other target does: a
// statement that may have a value is written `void`.
// A listener with an option has no template syntax: it binds the output of a directive the file
// declares for that event and option (`(ufClickCapture)="…"`, see ./directives.ts). A directive
// listens when its element is created, before the template's own listeners: so the listeners of one
// element, event and phase that must run in their attributes' order (`onClick` beside
// `onClickOnce`) are one template listener, which chains their statements in that order
// (`groupStatement`).
import {
  angularCode,
  parameterText,
  parseExpression,
  parseStatementsSource,
  pascalCase,
  rewriteCode,
} from "@unframework/codegen";
import { DOM_EVENTS, walk } from "@unframework/ir";
import type {
  BindingId,
  Code,
  CodeReference,
  ElementNode,
  EventAttribute,
  FunctionCode,
  IfNode,
  UfComponent,
} from "@unframework/ir";

import type { DirectiveSpec } from "./directives.ts";
import { assertedCode, assertedFunction } from "./narrowing.ts";
import { bindingById, formOf, isLoopVariable, unreachable } from "./plan.ts";
import type { Plan } from "./plan.ts";
import { classRules, statementRead, statementRules } from "./rules.ts";
import { bodyStatements, returnsValue } from "./statements.ts";

/** A handler moved to a method of the class. */
export interface HandlerMethod {
  name: string;
  /** Its parameters, as the method declares them: the event (`event: PointerEvent`) when it takes one. */
  parameters: string[];
  async: boolean;
  /** The method's body, its references spelled for the class. */
  body: string;
}

/** How the template writes its listeners, and what the class and the file declare for them. */
export interface Listeners {
  /** The template statement of each listener without an option, by its IR attribute. */
  statements: ReadonlyMap<EventAttribute, string>;
  /** The whole attribute of each listener with an option: `(ufClickCapture)="…"`. */
  attributes: ReadonlyMap<EventAttribute, string>;
  /** The methods handlers moved to, in document order. */
  methods: HandlerMethod[];
  /** The directives the listeners with an option use, each once, in document order. */
  directives: DirectiveSpec[];
  /** The bindings the template statements read or call by name, which the template must see. */
  reads: ReadonlySet<BindingId>;
  /**
   * The signals the template statements read from the class (`this.selected()`): members the
   * template must see, which no `@let` reads.
   */
  members: ReadonlySet<BindingId>;
  /** The globals the template statements read, which the template sees as members. */
  globals: ReadonlySet<string>;
  /**
   * The members that remember the elements a group's once listener ran on: each a
   * `WeakSet<EventTarget>` the template passes to the guard method (`groupStatement`).
   */
  guards: string[];
  /** The guard method's name, when a group has a once listener. */
  once?: string;
}

/** Plans every listener of a component's template, in document order. */
export function planListeners(plan: Plan, nextTick: string | undefined): Listeners {
  const { component } = plan;
  const statements = new Map<EventAttribute, string>();
  const attributes = new Map<EventAttribute, string>();
  const methods: HandlerMethod[] = [];
  const directives = new Map<string, DirectiveSpec>();
  const reads = new Set<BindingId>();
  const members = new Set<BindingId>();
  const globals = new Set<string>();
  // An element has one once listener of an event at most (the analyser allows one), so one set
  // per event tells every element's apart.
  const guards = new Map<string, string>();
  let once: string | undefined;
  const collected: StatementReads = { reads, members, globals, nextTick, tested: new Map() };
  const { tested } = collected;
  /** Counts the bindings an `If`'s conditions read in or out, as the walk enters and leaves it. */
  const count = (node: IfNode, step: 1 | -1) => {
    for (const { condition } of node.branches) {
      for (const reference of condition?.refs ?? []) {
        if (reference.kind !== "Binding") continue;
        const next = (tested.get(reference.binding) ?? 0) + step;
        if (next === 0) tested.delete(reference.binding);
        else tested.set(reference.binding, next);
      }
    }
  };
  const context: GroupContext = {
    methods,
    collected,
    once: () => (once ??= templateMember(plan, "once")),
    guard: (event) => {
      let guard = guards.get(event);
      if (guard === undefined) {
        guard = templateMember(plan, `${event}Once`);
        guards.set(event, guard);
      }
      return guard;
    },
  };
  walk(component.render, {
    leave(node) {
      if (node.kind === "If") count(node, -1);
    },
    enter(node) {
      if (node.kind === "If") count(node, 1);
      if (node.kind !== "Element") return;
      const groups = orderedGroups(node);
      for (const attribute of node.attributes) {
        if (attribute.kind !== "Event") continue;
        const group = groups.get(attribute);
        if (group !== undefined) {
          // The group's first attribute writes its one listener; the others print nothing.
          const statement =
            group[0] === attribute ? groupStatement(plan, node, group, context) : undefined;
          attributes.set(
            attribute,
            statement === undefined
              ? ""
              : `(${attribute.event})="${angularCode(statement, "event")}"`,
          );
          continue;
        }
        const name = () => handlerName(plan, node, attribute.event, optionOf(attribute));
        const { code, valued } = listenerStatement(plan, attribute, name, methods, collected);
        const statement = valued ? `void ${code}` : code;
        const option = optionOf(attribute);
        if (option === undefined) {
          statements.set(attribute, statement);
          continue;
        }
        const output = `uf${pascalCase(attribute.event)}${pascalCase(option)}`;
        let directive = directives.get(output);
        if (!directive) {
          directive = {
            event: attribute.event,
            option,
            output,
            className: plan.imports.claim(`${pascalCase(attribute.event)}${pascalCase(option)}`),
            eventType: DOM_EVENTS.get(attribute.event) ?? "Event",
          };
          directives.set(output, directive);
        }
        attributes.set(attribute, `(${output})="${angularCode(statement, "event")}"`);
      }
    },
  });
  return {
    statements,
    attributes,
    methods,
    directives: [...directives.values()],
    reads,
    members,
    globals,
    guards: [...guards.values()],
    ...(once === undefined ? {} : { once }),
  };
}

/** A listener's option, or none. */
function optionOf(attribute: EventAttribute): "capture" | "once" | "passive" | undefined {
  if (attribute.capture) return "capture";
  if (attribute.once) return "once";
  return attribute.passive ? "passive" : undefined;
}

/** What the template statements read, collected as the listeners are planned. */
interface StatementReads {
  reads: Set<BindingId>;
  members: Set<BindingId>;
  globals: Set<string>;
  nextTick: string | undefined;
  /**
   * The bindings the conditions around the listener being planned read, each by how many: a
   * prop among them may be narrowed there.
   */
  tested: Map<BindingId, number>;
}

/**
 * A listener's template statement, and whether it may have a value (`valued`): Angular prevents
 * the event when a listener's value is `false`, so the listener's last statement is then `void`.
 */
interface Statement {
  code: string;
  valued: boolean;
}

/** The template statement a listener runs, moving its handler to a method when it must. */
function listenerStatement(
  plan: Plan,
  attribute: EventAttribute,
  methodName: () => string,
  methods: HandlerMethod[],
  collected: StatementReads,
): Statement {
  const { reads, nextTick } = collected;
  const { component } = plan;
  const { handler } = attribute;
  switch (handler.kind) {
    case "Function": {
      const binding = bindingById(plan, handler.binding);
      const fn = functionOf(component, handler.binding);
      const takesEvent = fn.parameters[0]?.event !== undefined;
      reads.add(handler.binding);
      return {
        code: `${binding.name}(${takesEvent ? "$event" : ""})`,
        valued: !fn.async && returnsValue(fn),
      };
    }
    case "Inline": {
      const statement = templateStatement(plan, handler.function, collected);
      if (statement !== undefined) return statement;
      const fn = handler.function;
      const [event] = fn.parameters;
      const name = methodName();
      // The method returns nothing: an expression body becomes a statement, and a block body's
      // `return`s give no value.
      const body = bodyStatements(
        assertedFunction(fn, () => true),
        plan,
        classRules(plan, nextTick),
      );
      methods.push(hoisted(name, fn, attribute.event, body));
      return { code: `${name}(${event === undefined ? "" : "$event"})`, valued: false };
    }
    default:
      return unreachable(handler);
  }
}

/**
 * The name of the method a handler moves to, `on` and what the element says it is
 * (`elementSubject`), with its option's name for a listener of a group (`onGoOnce`), or, for an
 * element that says nothing, the event and its option (`onClickCapture`).
 */
function handlerName(
  plan: Plan,
  element: ElementNode,
  domEvent: string,
  option: "capture" | "once" | "passive" | undefined,
  /** Set for a listener of a group, which names its option beside the group's other listeners. */
  optioned = false,
): string {
  const suffix = option === undefined ? "" : pascalCase(option);
  const subject = elementSubject(element, domEvent);
  return templateMember(
    plan,
    subject === undefined
      ? `on${pascalCase(domEvent)}${suffix}`
      : `on${subject}${optioned ? suffix : ""}`,
  );
}

/**
 * A name for a member the template reads (a moved handler, a once guard and its set), claimed
 * beside the class's members: never a list's variable's name, which would shadow it in the list.
 */
function templateMember(plan: Plan, base: string): string {
  let name = plan.members.claim(base);
  while (plan.loopNames.has(name)) name = plan.members.claim(base);
  return name;
}

/**
 * What an element says it is, for the names of its handlers: its static `aria-label`
 * or its text (`AddOne`, `Reset`), with the event's name but for a click (`QueryKeydown`); or a
 * form control's `name` and the event (`EmailInput`); or `undefined`.
 */
function elementSubject(element: ElementNode, domEvent: string): string | undefined {
  const event = pascalCase(domEvent);
  const label = words(staticValue(element, "aria-label") ?? textOf(element));
  if (label !== undefined) return `${label}${domEvent === "click" ? "" : event}`;
  const control = words(staticValue(element, "name"));
  return control === undefined ? undefined : `${control}${event}`;
}

/** A handler hoisted to a method, its event parameter typed as its event's DOM interface. */
function hoisted(name: string, fn: FunctionCode, domEvent: string, body: string): HandlerMethod {
  const [event] = fn.parameters;
  return {
    name,
    parameters:
      event === undefined
        ? []
        : [
            event.type
              ? parameterText(event)
              : `${parameterText(event)}: ${event.event ?? DOM_EVENTS.get(domEvent)}`,
          ],
    async: fn.async === true,
    body,
  };
}

/** An element's static attribute value. */
function staticValue(element: ElementNode, name: string): string | undefined {
  for (const attribute of element.attributes) {
    if (attribute.kind === "Static" && attribute.name === name && attribute.value !== true) {
      return attribute.value;
    }
  }
  return undefined;
}

/** An element's text, when its children are text alone. */
function textOf(element: ElementNode): string | undefined {
  const { children } = element;
  if (!children.length || !children.every((child) => child.kind === "Text")) return undefined;
  return children.map((child) => (child.kind === "Text" ? child.value : "")).join("");
}

/** Up to four ASCII words in PascalCase (`Add one` → `AddOne`), or `undefined`. */
function words(text: string | undefined): string | undefined {
  const found = text?.match(/[A-Za-z0-9]+/g);
  if (!found || found.length > 4) return undefined;
  return found.map((word) => `${word[0]!.toUpperCase()}${word.slice(1).toLowerCase()}`).join("");
}

/** The function a setup function's binding names. */
function functionOf(component: UfComponent, id: BindingId): FunctionCode {
  for (const item of component.setup) {
    if (item.kind === "Function" && item.binding === id) return item.function;
  }
  throw new Error(`No setup function declares ${id}.`);
}

interface AstNode {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

const isAstNode = (value: unknown): value is AstNode =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as AstNode).type === "string" &&
  typeof (value as AstNode).start === "number";

/** Calls `visit` on every node of an AST, parents first; `false` skips a node's children. */
function visitAst(root: unknown, visit: (node: AstNode) => boolean | void): void {
  if (Array.isArray(root)) {
    for (const item of root) visitAst(item, visit);
    return;
  }
  if (!isAstNode(root) || visit(root) === false) return;
  for (const [key, value] of Object.entries(root)) {
    if (key !== "type" && typeof value === "object") visitAst(value, visit);
  }
}

/**
 * An inline handler as a template statement, when it is one call of a setup function or of
 * `emit` whose arguments the template can read: always for a handler that reads a list's item
 * or index (the analyser keeps those to this form, UF3029); for one that reads a prop a condition
 * around it tests, when Angular's expressions can hold its arguments (the analyser keeps a handler
 * that reads a narrowed prop to this form, UF3029, which the template keeps narrowed, where a
 * method of the class would read the input un-narrowed); otherwise when its arguments are
 * literals, names and members of the inputs, the constants, a list's variables and the event, so
 * that nothing in them reads a state's value from the last render. Otherwise `undefined`.
 */
function templateStatement(
  plan: Plan,
  fn: FunctionCode,
  { reads, members, globals, tested }: StatementReads,
): Statement | undefined {
  const call = singleCall(fn.body, fn.expression === true);
  if (!call) return undefined;
  const refs = fn.body.refs;
  const readsLoop = refs.some(
    (reference) =>
      reference.kind === "Binding" && isLoopVariable(bindingById(plan, reference.binding).kind),
  );
  const readsTested = refs.some(
    (reference) =>
      reference.kind === "Binding" &&
      tested.has(reference.binding) &&
      formOf(plan, bindingById(plan, reference.binding)) === "input",
  );
  if (
    !readsLoop &&
    !(readsTested && call.arguments.every(angularReadable)) &&
    !(call.arguments.every(isSimple) && refs.every((ref) => simpleRead(plan, ref)))
  ) {
    return undefined;
  }
  // A state's narrowed path is read through the class (`this.draft().email!`); an input's, through
  // the template's own name, which the template narrows.
  const code: Code = assertedCode(
    {
      code: call.code,
      span: call.span,
      refs: refs.filter(
        (reference) =>
          reference.span.start >= call.span.start && reference.span.end <= call.span.end,
      ),
    },
    (reference) => formOf(plan, bindingById(plan, reference.binding)) !== "input",
  );
  for (const reference of code.refs) {
    if (reference.kind === "Binding") {
      // A signal the statement reads through `this.` needs no `@let` (NG8112 for an unread one),
      // only a member the template sees.
      const through = statementRead(plan, bindingById(plan, reference.binding)).startsWith("this.");
      (through ? members : reads).add(reference.binding);
    } else if (reference.kind === "Emit") reads.add(reference.binding);
    else if (reference.kind === "Global") globals.add(reference.name);
  }
  const rewritten = rewriteCode(code, plan.component, statementRules(plan), "client");
  const event = fn.parameters[0]?.name;
  const statement = event === undefined ? rewritten : withEvent(rewritten, event);
  if (call.callee === undefined) return { code: statement, valued: false };
  // A setup function's value, unless it is async (its value is a promise).
  const callee = functionOf(plan.component, call.callee);
  return { code: statement, valued: !callee.async && returnsValue(callee) };
}

/** The one call an arrow's body makes, with its code and span in the source. */
function singleCall(
  body: Code,
  expression: boolean,
):
  | {
      code: string;
      span: { start: number; end: number };
      arguments: AstNode[];
      /** The setup function it calls, or none for an `emit`. */
      callee?: BindingId;
    }
  | undefined {
  let node: AstNode;
  if (expression) {
    node = parseExpression(body.code) as unknown as AstNode;
  } else {
    const { statements } = parseStatementsSource(body.code);
    const block = statements[0] as unknown as AstNode | undefined;
    const inner =
      statements.length === 1 && block?.type === "BlockStatement" ? (block.body as AstNode[]) : [];
    const [only] = inner;
    if (inner.length !== 1 || only?.type !== "ExpressionStatement") return undefined;
    node = only.expression as AstNode;
  }
  if (node.type !== "CallExpression" || node.optional) return undefined;
  const callee = node.callee as AstNode;
  const args = node.arguments as AstNode[];
  if (callee.type !== "Identifier" || args.some((arg) => arg.type === "SpreadElement")) {
    return undefined;
  }
  const offset = body.span.start;
  // The analyser marks the callee: a setup function's call, or an `emit`.
  const start = offset + node.start;
  const end = offset + node.end;
  const callRef = body.refs.find((reference) => reference.span.start === start);
  const callsFunction =
    callRef?.kind === "Binding" &&
    callRef.call === true &&
    callRef.span.end === offset + callee.end;
  const emits = callRef?.kind === "Emit" && callRef.span.end === end;
  if (!callsFunction && !emits) return undefined;
  return {
    code: body.code.slice(node.start, node.end),
    span: { start, end },
    arguments: args,
    ...(callsFunction ? { callee: callRef.binding } : {}),
  };
}

/** An argument the template reads as the source does: literals, names, members, simple operators. */
function isSimple(node: AstNode): boolean {
  switch (node.type) {
    case "Literal":
      return node.regex === undefined && node.bigint === undefined;
    case "Identifier":
      return true;
    case "MemberExpression":
      return (
        isSimple(node.object as AstNode) && (!node.computed || isSimple(node.property as AstNode))
      );
    case "ChainExpression":
      return isSimple(node.expression as AstNode);
    case "UnaryExpression":
      return (
        ["!", "-", "+"].includes(node.operator as string) && isSimple(node.argument as AstNode)
      );
    case "ArrayExpression":
      return (node.elements as (AstNode | null)[]).every(
        (element) => element !== null && element.type !== "SpreadElement" && isSimple(element),
      );
    default:
      return false;
  }
}

/**
 * The syntax JavaScript has and Angular's expressions do not (Angular 22's `parseAction`, which
 * reads spreads in arrays, objects and calls, expression-bodied arrows and regular expressions): a
 * handler's argument holding one stays in the class. The analyser keeps a narrowed or listed
 * handler's arguments to the template subset (UF3029), which none of these is in.
 */
const NOT_ANGULAR = new Set([
  "NewExpression",
  "FunctionExpression",
  "ClassExpression",
  "AssignmentExpression",
  "UpdateExpression",
  "SequenceExpression",
  "AwaitExpression",
  "YieldExpression",
  "TaggedTemplateExpression",
  "ImportExpression",
  "MetaProperty",
  "ThisExpression",
  "Super",
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSTypeAssertion",
  "TSInstantiationExpression",
]);

/** Whether Angular's expressions can hold an argument as the printer writes it. */
function angularReadable(node: AstNode): boolean {
  let readable = true;
  visitAst(node, (each) => {
    if (
      NOT_ANGULAR.has(each.type) ||
      (each.type === "ArrowFunctionExpression" && !each.expression) ||
      (each.type === "UnaryExpression" && each.operator === "delete") ||
      (each.type === "Literal" && each.bigint !== undefined)
    ) {
      readable = false;
    }
    return readable;
  });
  return readable;
}

/** A reference a template statement reads as the source does (no state's last-render value). */
function simpleRead(plan: Plan, reference: CodeReference): boolean {
  switch (reference.kind) {
    case "Binding": {
      const form = formOf(plan, bindingById(plan, reference.binding));
      switch (form) {
        case "input":
        case "value":
        case "loop":
        case "method":
        case "arrow":
          return true;
        case "signal":
        case "linked":
        case "computed":
        case "once":
        case "query":
        case "field":
        case "emit":
          return false;
        default:
          return unreachable(form);
      }
    }
    case "Emit":
    case "Event":
      return true;
    case "Global":
    case "Slot":
    case "Write":
    case "Api":
      return false;
    default:
      return unreachable(reference);
  }
}

/** A template statement with the handler's event parameter, read whole, as `$event`. */
function withEvent(statement: string, event: string): string {
  return renamed(statement, event, "$event");
}

/** An expression with every read of the name `from` renamed `to`. */
function renamed(expression: string, from: string, to: string): string {
  const edits: { start: number; end: number; text: string }[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!isAstNode(value)) return;
    switch (value.type) {
      case "Identifier":
        if (value.name === from) edits.push({ start: value.start, end: value.end, text: to });
        return;
      // A member's name and a property's key are no reads.
      case "MemberExpression":
        visit(value.object);
        if (value.computed) visit(value.property);
        return;
      case "Property":
        if (value.shorthand && (value.value as AstNode).type === "Identifier") {
          if ((value.value as AstNode).name === from) {
            edits.push({ start: value.start, end: value.end, text: `${from}: ${to}` });
          }
          return;
        }
        if (value.computed) visit(value.key);
        visit(value.value);
        return;
      default:
        for (const [key, child] of Object.entries(value)) {
          if (key !== "type" && typeof child === "object") visit(child);
        }
    }
  };
  visit(parseExpression(expression));
  let result = expression;
  for (const { start, end, text } of edits.toSorted((a, b) => b.start - a.start)) {
    result = `${result.slice(0, start)}${text}${result.slice(end)}`;
  }
  return result;
}

/**
 * The listeners of one element that must run in their attributes' order, by attribute: those of
 * one event in the bubble phase, when there are two or three (a plain one beside a `once` or a
 * `passive` one: the analyser allows each once). A capture listener is alone in its phase, and at
 * its target it runs before the bubble phase's whatever the order it was added in.
 */
function orderedGroups(element: ElementNode): Map<EventAttribute, EventAttribute[]> {
  const byEvent = new Map<string, EventAttribute[]>();
  for (const attribute of element.attributes) {
    if (attribute.kind !== "Event" || attribute.capture) continue;
    const group = byEvent.get(attribute.event) ?? [];
    group.push(attribute);
    byEvent.set(attribute.event, group);
  }
  const groups = new Map<EventAttribute, EventAttribute[]>();
  for (const group of byEvent.values()) {
    if (group.length < 2) continue;
    for (const attribute of group) groups.set(attribute, group);
  }
  return groups;
}

/** What a group's listener adds to the class and the template beside it. */
interface GroupContext {
  methods: HandlerMethod[];
  collected: StatementReads;
  /** The guard method's name, claimed on first use (`once`). */
  once: () => string;
  /** The set of the elements whose once listener of an event ran (`clickOnce`), claimed on first use. */
  guard: (event: string) => string;
}

/**
 * A group's one template listener: a chain of template statements, one per listener in its
 * attribute's order (ADR-0047), each written as it would be alone (a setup function's call, an
 * inline handler's call, or the call of the method an inline handler moved to), so the template
 * keeps typing and narrowing what each reads (a list's item, a value a condition narrows), and
 * the source's names meet no name the emitter declares. A `once` listener runs under a guard,
 * `once(clickOnce, $event) && …`, whose set remembers each element it ran on, as `{ once: true }`
 * removes a listener from its own element only (a list's rows each run theirs once), marking it
 * before the listener runs, as the browser removes a listener before calling it. A `passive`
 * listener joins the others: the element already has a listener that is not passive, so scrolling
 * waits for it either way (the analyser rejects `preventDefault()` in a passive listener, which
 * never prevents anything: UF3034). Angular prevents the event when the listener's value is
 * `false`, and a chain's value is its last statement's: that one is `void` when it may have one.
 */
function groupStatement(
  plan: Plan,
  element: ElementNode,
  group: readonly EventAttribute[],
  context: GroupContext,
): string {
  const parts = group.map((attribute) => {
    const name = () => handlerName(plan, element, attribute.event, optionOf(attribute), true);
    const statement = listenerStatement(plan, attribute, name, context.methods, context.collected);
    if (!attribute.once) return { ...statement, guarded: false };
    return {
      code: `${context.once()}(${context.guard(attribute.event)}, $event) && ${statement.code}`,
      valued: true,
      guarded: true,
    };
  });
  const last = parts.length - 1;
  return parts
    .map(({ code, valued, guarded }, index) =>
      index < last || !valued ? code : `void ${guarded ? `(${code})` : code}`,
    )
    .join("; ");
}
