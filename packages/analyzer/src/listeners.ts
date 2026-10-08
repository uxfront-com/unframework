// Element listeners and template refs (ADR-0047, ADR-0049): `onClick={save}`,
// `onKeydownCapture={(event) => …}` and `ref={input}`. A listener's name is Vue's, the DOM
// event's in lower case after `on` with at most one option suffix (ADR-0017); the IR holds the
// DOM's name and the option, which each target spells its own way. A handler is a local
// function's name or an arrow function (UF3029), and a template ref one `useTemplateRef`
// binding, attached once, outside any list (UF3027).

import {
  createEventAttribute,
  createFunctionHandler,
  createInlineHandler,
  createRefAttribute,
  DOM_EVENTS,
  EVENT_INTERFACES,
  extendsEventInterface,
  PASSIVE_EVENTS,
  UNSUPPORTED_EVENTS,
  WINDOW_EVENTS,
} from "@unframework/ir";
import type { Attribute, CodeReference, Handler, Span } from "@unframework/ir";
import type { AST } from "@unframework/parser";
import { visitorKeys } from "@unframework/parser";

import { list } from "./attribute-names.ts";
import { Reporter } from "./context.ts";
import { checkCopiedText } from "./declarations.ts";
import { checkDirectives, checkExpression, lowerFunction, span } from "./expressions.ts";
import { narrowingFacts, referencePath } from "./narrowing.ts";
import type { RenderContext, SetupBinding } from "./render.ts";
import { setupBindingOf } from "./render.ts";

/** A listener's option suffixes, as Vue spells them (plan §4.3). */
const SUFFIXES = ["Capture", "Once", "Passive"] as const;

/** React's names for DOM events whose lower case is not the DOM's: `onDoubleClick`. */
const REACT_EVENTS: ReadonlyMap<string, string> = new Map([["doubleclick", "dblclick"]]);

/** A listener's name, read. */
export interface ListenerName {
  /** The DOM event, in lower case: `click`. */
  event: string;
  /** The options its suffixes ask for, in order: one at most is valid. */
  options: ("capture" | "once" | "passive")[];
  /** How the name is written canonically: `onDblclick`, `onKeydownCapture`. */
  canonical: string;
}

/**
 * Reads an attribute's name as a listener's: `on` and an event, with option suffixes. A name with
 * a capital after `on` is one whatever the event; any other only when it names an event of the
 * vocabulary (`onclick`), so `one` and `onion` stay attributes.
 */
export function listenerName(authored: string): ListenerName | undefined {
  if (!/^on/i.test(authored)) return undefined;
  let rest = authored.slice(2);
  const options: ListenerName["options"] = [];
  const suffixes: string[] = [];
  for (let found = true; found;) {
    found = false;
    for (const suffix of SUFFIXES) {
      const lower = rest.toLowerCase();
      if (rest.length > suffix.length && lower.endsWith(suffix.toLowerCase())) {
        const candidate = rest.slice(0, -suffix.length);
        // A suffix written in another case counts where what is left is an event.
        if (!rest.endsWith(suffix) && !known(eventOf(candidate))) continue;
        options.unshift(suffix.toLowerCase() as ListenerName["options"][number]);
        suffixes.unshift(suffix);
        rest = candidate;
        found = true;
        break;
      }
    }
  }
  const event = eventOf(rest);
  if (!/^on[A-Z]/.test(authored) && !known(event)) return undefined;
  const canonical = `on${event.charAt(0).toUpperCase()}${event.slice(1)}${suffixes.join("")}`;
  return { event, options, canonical };
}

/** The DOM event a name stands for, in lower case. */
function eventOf(name: string): string {
  const lower = name.toLowerCase();
  return REACT_EVENTS.get(lower) ?? lower;
}

/** Whether a DOM event of any kind has the name: one an element, the window or HTML knows. */
function known(event: string): boolean {
  return DOM_EVENTS.has(event) || WINDOW_EVENTS.has(event) || UNSUPPORTED_EVENTS.has(event);
}

/** What lowering a listener or a template ref needs: its element, and its render context. */
export interface OwnAttributeContext {
  tag: string;
  render: RenderContext;
}

/** A listener, lowered: its IR, and what one element may set once (its event and option). */
export interface LoweredListener {
  attribute: Attribute | undefined;
  /** The event and option, which one element listens with once. */
  key: string;
}

/**
 * Lowers a listener (ADR-0047): its name (UF3004 for another spelling, with the rename; UF3006
 * for what is no element event, a second option, or `Passive` where it does nothing) and its
 * handler (UF3029). A renamed listener is lowered as its new name, so the fix reveals nothing.
 */
export function lowerListener(
  item: AST.JSXAttribute,
  nameNode: AST.JSXIdentifier,
  name: ListenerName,
  context: OwnAttributeContext,
): LoweredListener {
  const { render, tag } = context;
  const { reporter } = render;
  const mark = reporter.diagnostics.length;
  const authored = nameNode.name;
  const { event, options } = name;
  const key = `${event}:${options.join(",")}`;
  const window = WINDOW_EVENTS.has(event);
  const unsupported = UNSUPPORTED_EVENTS.get(event);
  if (window) {
    reporter.report(
      "UF3006",
      nameNode,
      `\`${authored}\` listens to \`${event}\`, which only the window receives: a listener on <${tag}> never runs.`,
      { help: "Listen to an event the element receives." },
    );
  } else if (unsupported) {
    reporter.report(
      "UF3006",
      nameNode,
      `\`${authored}\` listens to \`${event}\`, which no target listens to alike: ${unsupported}.`,
    );
  } else if (!DOM_EVENTS.has(event)) {
    reporter.report(
      "UF3006",
      nameNode,
      `\`${authored}\` is not a listener: \`${event}\` is no DOM event.`,
      {
        help: "Name a DOM event after `on`, as Vue does: `onClick`, `onKeydown`, `onDblclick`.",
      },
    );
  } else if (options.length > 1) {
    reporter.report(
      "UF3006",
      nameNode,
      `\`${authored}\` asks for ${options.length} options, and a listener takes one: its name has one suffix (ADR-0017).`,
      { help: "Keep one of `Capture`, `Once` and `Passive`." },
    );
  } else if (options[0] === "passive" && !PASSIVE_EVENTS.has(event)) {
    reporter.report(
      "UF3006",
      nameNode,
      `\`${authored}\` is passive, and a listener is passive only on ${list([...PASSIVE_EVENTS].map((name) => `\`${name}\``))}, where it lets scrolling go on: elsewhere it changes nothing.`,
      { help: `Write \`${name.canonical.slice(0, -"Passive".length)}\`.` },
    );
  } else if (authored !== name.canonical) {
    reporter.report(
      "UF3004",
      nameNode,
      `\`${authored}\` is written \`${name.canonical}\`: a listener is named as Vue names it, \`on\` and the DOM event's name, which every target spells its own way.`,
      {
        fixes: [
          {
            title: `Rename \`${authored}\` to \`${name.canonical}\``,
            confidence: "safe",
            edits: [{ span: span(nameNode), text: name.canonical }],
          },
        ],
      },
    );
  }
  const handler = lowerHandler(item, event, context);
  if (!handler || reporter.hasErrorsSince(mark)) return { attribute: undefined, key };
  const [option] = options;
  return {
    attribute: createEventAttribute(event, handler, span(item), {
      capture: option === "capture",
      once: option === "once",
      passive: option === "passive",
    }),
    key,
  };
}

/**
 * The interface a function's event parameter is annotated with, if it names one, or a union of
 * them (`MouseEvent | KeyboardEvent`, which a function two listeners share is typed with): then
 * the nearest interface they all extend (`UIEvent`), whose members are what TypeScript lets code
 * read of the union, and `members`, the events it takes.
 */
export function annotatedInterface(parameter: AST.ParamPattern | undefined): {
  interface?: string;
  /** The interfaces the annotation names: one, or each of a union's. */
  members?: readonly string[];
  annotated: boolean;
} {
  if (parameter?.type !== "Identifier" || !parameter.typeAnnotation) return { annotated: false };
  const type = parameter.typeAnnotation.typeAnnotation;
  const named = (node: AST.TSType) =>
    node.type === "TSTypeReference" &&
    node.typeName.type === "Identifier" &&
    !node.typeArguments &&
    EVENT_INTERFACES.has(node.typeName.name)
      ? node.typeName.name
      : undefined;
  const members = type.type === "TSUnionType" ? type.types.map(named) : [named(type)];
  if (!members.length || members.some((member) => member === undefined)) {
    return { annotated: true };
  }
  const names = members as string[];
  return { interface: commonInterface(names), members: names, annotated: true };
}

/** The nearest event interface every one of `names` is or extends: `Event` at worst. */
function commonInterface(names: readonly string[]): string {
  for (let current: string | null | undefined = names[0]; current;) {
    if (names.every((name) => extendsEventInterface(name, current!))) return current;
    current = EVENT_INTERFACES.get(current);
  }
  return "Event";
}

/** Whether an event's interface fits a parameter that takes `members`: it extends one of them. */
function takesEvent(dom: string, members: readonly string[]): boolean {
  return members.some((member) => extendsEventInterface(dom, member));
}

/**
 * Lowers a handler (ADR-0047): a local function's name, or an arrow function, whose
 * parameter, when it has one, is the event (UF3029 for anything else).
 */
function lowerHandler(
  item: AST.JSXAttribute,
  event: string,
  context: OwnAttributeContext,
): Handler | undefined {
  const { render } = context;
  const { reporter, source } = render;
  const dom = DOM_EVENTS.get(event) ?? "Event";
  const invalid = (at: { start: number; end: number }, message: string, help?: string) => {
    reporter.report("UF3029", at, message, {
      help:
        help ??
        "Name a local function (`onClick={save}`), or write an arrow function (`onClick={() => save()}`).",
    });
    return undefined;
  };
  const value = item.value;
  if (!value) {
    return invalid(
      item,
      "A listener needs a handler: a local function's name or an arrow function.",
    );
  }
  if (value.type === "Literal") {
    return invalid(
      value,
      "A handler is code, not a string: the compiler analyses a handler, and every target runs it as a function.",
    );
  }
  if (value.type !== "JSXExpressionContainer" || value.expression.type === "JSXEmptyExpression") {
    return invalid(value, "A handler is a local function's name or an arrow function.");
  }
  const expression = value.expression;
  if (expression.type === "Identifier") {
    const binding = setupBindingOf(expression, render);
    if (binding?.kind === "localFn")
      return functionHandler(expression, binding, event, dom, render);
    if (binding?.kind === "emit") {
      return invalid(
        expression,
        "`emit` takes an event's name and its payload, and a listener would pass it the DOM event.",
        'Emit from an arrow function: `onClick={() => emit("close")}`.',
      );
    }
    return invalid(
      expression,
      `\`${expression.name}\` is not a local function: a handler is a function the component's setup declares, or an arrow function.`,
    );
  }
  if (expression.type === "ArrowFunctionExpression") {
    const [parameter] = expression.params;
    let parameterInterface = dom;
    if (parameter) {
      const annotation = annotatedInterface(parameter);
      if (annotation.annotated && !annotation.interface) {
        return invalid(
          parameter,
          "A handler's parameter is the event: annotate it with its event's interface, or leave it to be inferred.",
          `Write \`(${parameter.type === "Identifier" ? parameter.name : "event"}: ${dom})\`, or no annotation.`,
        );
      }
      if (annotation.interface) {
        if (DOM_EVENTS.has(event) && !takesEvent(dom, annotation.members!)) {
          return invalid(
            parameter,
            `\`${event}\` dispatches a ${dom}, and the handler takes a ${annotation.members!.join(" or ")}.`,
            `Annotate it as \`${dom}\`, or as an interface it extends.`,
          );
        }
        parameterInterface = annotation.interface;
      }
    }
    checkCopiedText(span(expression), source, reporter, "A handler");
    checkDirectives(span(expression), render.comments, reporter);
    const lowered = lowerFunction(expression, render, {
      role: "handler",
      ...(parameter ? { event: { index: 0, interface: parameterInterface, events: [event] } } : {}),
    });
    // Checked whatever else the handler reports, so that fixing that reveals nothing new.
    const fits = capturable(expression, lowered.function.body.refs, render);
    if (!lowered.clean || !fits) return undefined;
    return createInlineHandler(lowered.function, span(expression));
  }
  if (expression.type === "CallExpression") {
    return invalid(
      expression,
      "This handler is a call, which would run while the component renders: a handler is a function the event calls.",
      `Write an arrow function: \`() => ${source.slice(expression.start, expression.end)}\`.`,
    );
  }
  if (expression.type === "FunctionExpression") {
    return invalid(
      expression,
      "A handler is an arrow function, not a function expression: Angular's output makes a handler a method, which a function expression would rebind `this` in.",
    );
  }
  return invalid(
    expression,
    "A handler is a local function's name or an arrow function, written in place: the compiler cannot tell which function a conditional, a member or another expression gives.",
  );
}

/**
 * Lowers the handler of a listener on a component (ADR-0053): a local function's name, or an
 * arrow function, whose parameters are the event's payload, never a DOM event (UF3029 for
 * anything else).
 */
export function lowerComponentHandler(
  item: AST.JSXAttribute,
  render: RenderContext,
): Handler | undefined {
  const { reporter, source } = render;
  const invalid = (at: { start: number; end: number }, message: string) => {
    reporter.report("UF3029", at, message, {
      help: "Name a local function (`onClear={reset}`), or write an arrow function (`onClear={(reason) => log(reason)}`).",
    });
    return undefined;
  };
  const value = item.value;
  if (value?.type !== "JSXExpressionContainer" || value.expression.type === "JSXEmptyExpression") {
    return invalid(
      value ?? item,
      "A listener's handler is a local function's name or an arrow function.",
    );
  }
  const expression = value.expression;
  if (expression.type === "Identifier") {
    const binding = setupBindingOf(expression, render);
    if (binding?.kind === "localFn") return createFunctionHandler(binding.id, span(expression));
    return invalid(
      expression,
      `\`${expression.name}\` is not a local function: a handler is a function the component's setup declares, or an arrow function.`,
    );
  }
  if (expression.type !== "ArrowFunctionExpression") {
    return invalid(
      expression,
      "A handler is a local function's name or an arrow function, written in place.",
    );
  }
  checkCopiedText(span(expression), source, reporter, "A handler");
  checkDirectives(span(expression), render.comments, reporter);
  const lowered = lowerFunction(expression, render, { role: "handler" });
  const fits = capturable(expression, lowered.function.body.refs, render);
  if (!lowered.clean || !fits) return undefined;
  return createInlineHandler(lowered.function, span(expression));
}

/**
 * A handler that names a local function (ADR-0047): the function's first parameter, when it has
 * one, is the event's, of an interface the event's extends (UF3029).
 */
function functionHandler(
  identifier: AST.IdentifierReference,
  binding: SetupBinding,
  event: string,
  dom: string,
  render: RenderContext,
): ReturnType<typeof createFunctionHandler> | undefined {
  const fn = binding.function;
  const [first] = fn?.params ?? [];
  if (first && fn) {
    const parameter = render.setup.eventParameters.get(fn);
    // A union annotation takes each event one of its interfaces fits.
    const members = annotatedInterface(first).members ?? [parameter?.interface ?? "Event"];
    const problem =
      parameter?.index !== 0
        ? `\`${binding.name}\`'s first parameter is not an event, and a listener passes the event to it.`
        : DOM_EVENTS.has(event) && !takesEvent(dom, members)
          ? `\`${event}\` dispatches a ${dom}, and \`${binding.name}\` takes a ${members.join(" or ")}.`
          : undefined;
    if (problem) {
      render.reporter.report("UF3029", identifier, problem, {
        help: `Take the event as \`${binding.name}\`'s first parameter (\`event: ${dom}\`), or call it from an arrow function: \`() => ${binding.name}(…)\`.`,
      });
      return undefined;
    }
  }
  return createFunctionHandler(binding.id, span(identifier));
}

/**
 * Whether an inline handler that reads a list's item or index has the shape Angular prints as a
 * template statement (ADR-0047): one call of a local function or of `emit`, with arguments in the
 * template subset, the event among them (UF3029).
 */
function capturable(
  fn: AST.ArrowFunctionExpression,
  refs: readonly CodeReference[],
  render: RenderContext,
): boolean {
  const loops = new Set([...render.loopVariables.values()].map((variable) => variable.id));
  const inList = refs.some((ref) => ref.kind === "Binding" && loops.has(ref.binding));
  const narrowed = inList ? undefined : narrowedRead(fn, render);
  if (!inList && !narrowed) return true;
  const { body } = fn;
  const callee =
    body.type === "CallExpression" && body.callee.type === "Identifier"
      ? setupBindingOf(body.callee, render)
      : undefined;
  if (body.type !== "CallExpression" || (callee?.kind !== "localFn" && callee?.kind !== "emit")) {
    render.reporter.report(
      "UF3029",
      fn,
      inList
        ? "A handler in a list that reads the list's item or index is one call of a local function or of `emit`: Angular writes it as a template statement, which passes the item to the function."
        : `A handler that reads \`${render.source.slice(narrowed!.start, narrowed!.end)}\`, which a condition around it narrows, is one call of a local function or of \`emit\`: Angular writes it as a template statement, which keeps the narrowing a method of its class would lose.`,
      {
        help: inList
          ? "Move the code into a local function, and call it with the item: `() => remove(item.id)`."
          : "Move the code into a local function, and call it with the value: `() => greet(user.name)`.",
        ...(narrowed
          ? {
              related: [
                { span: span(narrowed.condition), message: "The condition narrows it here" },
              ],
            }
          : {}),
      },
    );
    return false;
  }
  let fits = true;
  const [parameter] = fn.params;
  for (const argument of body.arguments) {
    if (argument.type === "SpreadElement") {
      fits = reportArgument(argument, "a spread argument", inList, render) && fits;
      continue;
    }
    if (
      argument.type === "Identifier" &&
      parameter?.type === "Identifier" &&
      argument.name === parameter.name
    ) {
      continue;
    }
    // Checked as a template expression would be, apart: what it reports, the template statement
    // could not hold.
    const probe = new Reporter(render.reporter.file);
    checkExpression(argument, { ...render, reporter: probe });
    const [found] = probe.diagnostics;
    if (found)
      fits =
        reportArgument(
          argument,
          `\`${render.source.slice(argument.start, argument.end)}\``,
          inList,
          render,
          found.message,
        ) && fits;
  }
  return fits;
}

/**
 * The first read in a handler of a value a condition around the handler narrows (ADR-0047, UF3029):
 * a prop, a list's item or a ref's value, or a member of one, that a conditional of the template
 * tests, which Angular keeps narrowed only in a template statement.
 */
function narrowedRead(
  fn: AST.ArrowFunctionExpression,
  render: RenderContext,
): { start: number; end: number; condition: AST.Expression } | undefined {
  let found: { start: number; end: number; condition: AST.Expression } | undefined;
  const visit = (node: unknown): void => {
    if (found || !node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    const typed = node as AST.Node;
    if (typeof typed.type !== "string") return;
    // A plain assignment's target is written, not read: writing the value a condition tests
    // (`() => (open.value = false)` in the branch `open.value` opens) needs no narrowing. A
    // compound assignment's and an update's target is read too.
    if (typed.type === "AssignmentExpression" && typed.operator === "=") {
      const target = typed.left;
      if (target.type === "MemberExpression") {
        visit(target.object);
        if (target.computed) visit(target.property);
      } else if (target.type !== "Identifier") {
        visit(target);
      }
      visit(typed.right);
      return;
    }
    if (typed.type === "Identifier" || typed.type === "MemberExpression") {
      const path = referencePath(typed as AST.Expression, render);
      if (path) {
        const [fact] = narrowingFacts(typed, path, undefined, render).filter(
          ({ condition }) => condition.start < fn.start || condition.start >= fn.end,
        );
        if (fact) {
          found = { start: typed.start, end: typed.end, condition: fact.condition };
          return;
        }
      }
    }
    if (typed.type === "MemberExpression") {
      visit(typed.object);
      if (typed.computed) visit(typed.property);
      return;
    }
    if (typed.type === "Property" && !typed.computed) {
      visit(typed.value);
      return;
    }
    for (const key of visitorKeys[typed.type] ?? []) {
      visit((typed as unknown as Record<string, unknown>)[key]);
    }
  };
  visit(fn.body);
  return found;
}

/**
 * Reports an argument of a handler's one call that a template statement cannot hold (UF3029),
 * worded by what makes the handler one call: a list's item, or a value a condition narrows.
 */
function reportArgument(
  argument: { start: number; end: number },
  what: string,
  inList: boolean,
  render: RenderContext,
  why?: string,
): false {
  render.reporter.report(
    "UF3029",
    argument,
    inList
      ? `A handler in a list passes the list's item to a function as Angular's template statements do, and ${what} is no argument they take${why ? `: ${why}` : "."}`
      : `A handler that reads a value a condition around it narrows passes it to a function as Angular's template statements do, and ${what} is no argument they take${why ? `: ${why}` : "."}`,
    {
      help: inList
        ? "Compute the value in the function the handler calls, from the item."
        : "Pass the narrowed value itself, and compute the rest in the function the handler calls.",
    },
  );
  return false;
}

/**
 * Lowers a template ref's attachment, `ref={input}` (ADR-0049): a `useTemplateRef` binding, on one
 * element, outside any list (UF3027). `attached` records each template ref's element.
 */
export function lowerRef(
  item: AST.JSXAttribute,
  nameNode: AST.JSXIdentifier,
  context: OwnAttributeContext,
  attached: Map<object, Span>,
): Attribute | undefined {
  const { render } = context;
  const { reporter } = render;
  const mark = reporter.diagnostics.length;
  const invalid = (at: { start: number; end: number }, message: string, help?: string) => {
    reporter.report("UF3027", at, message, {
      help:
        help ??
        "Attach a template ref: `ref={input}`, with `const input = useTemplateRef<HTMLInputElement>();`.",
    });
    return undefined;
  };
  if (nameNode.name !== "ref") {
    reporter.report(
      "UF3004",
      nameNode,
      `\`${nameNode.name}\` is written \`ref\`: only JSX's \`ref\`, in lower case, attaches a template ref, and any other case is an attribute.`,
      {
        fixes: [
          {
            title: `Rename \`${nameNode.name}\` to \`ref\``,
            confidence: "safe",
            edits: [{ span: span(nameNode), text: "ref" }],
          },
        ],
      },
    );
  }
  const value = item.value;
  if (value?.type === "Literal") {
    return invalid(
      value,
      "A string ref is Vue's: a template ref is a binding, which `ref` takes as it is.",
    );
  }
  if (value?.type !== "JSXExpressionContainer" || value.expression.type !== "Identifier") {
    return invalid(
      value ?? item,
      "`ref` takes a template ref, the binding `useTemplateRef()` returns: no callback, member or other expression.",
    );
  }
  const identifier = value.expression;
  const binding = setupBindingOf(identifier, render);
  if (binding?.kind !== "templateRef") {
    return invalid(
      identifier,
      `\`${identifier.name}\` is not a template ref: \`ref\` takes the binding \`useTemplateRef()\` returns.`,
    );
  }
  const first = attached.get(binding.declaration);
  if (!first) attached.set(binding.declaration, span(item));
  if (render.enclosing.length) {
    return invalid(
      item,
      `\`${binding.name}\` is attached inside a list, where Vue fills a template ref with an array of elements and the other targets with the last one: a template ref holds one element.`,
      "Attach it to an element outside the list.",
    );
  }
  if (first) {
    reporter.report(
      "UF3027",
      item,
      `\`${binding.name}\` is attached twice: a template ref holds one element.`,
      {
        help: "Attach it once, and declare a template ref for each other element.",
        related: [{ span: first, message: "First attached here" }],
      },
    );
    return undefined;
  }
  if (reporter.hasErrorsSince(mark)) return undefined;
  return createRefAttribute(binding.id, span(item));
}
