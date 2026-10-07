// Listeners and template refs in React's JSX (ADR-0047, ADR-0049). A listener React's
// synthetic event keeps the DOM's semantics for is its prop (`onKeyDown={recordKey}`,
// `onClickCapture`); listeners of one prop on one element run in attribute order in one handler;
// a listener that runs once tests its guard first (`useOnce`, the `event-once` helper); a
// bubble-phase listener of an event that does not bubble tests that its element is the target.
// Every other listener is native: the element's ref callback adds it (`listen`, the
// `event-semantics` helper), one `listen` call for each event and phase running its listeners in
// attribute order, and React removes them with the cleanup the callback returns, which also
// clears a template ref on the same element. The callback is declared once for the instance's
// life (`useState`), so React never adds the listeners again as it renders: a listener added
// again while an event is dispatched would miss it. Only one whose listener reads a list's row,
// or a value its branch narrows, is written in place.
import { handlerText, js, parameterText, parseStatementsSource } from "@unframework/codegen";
import type { JsxContext } from "@unframework/codegen";
import type {
  Attribute,
  ElementNode,
  EventAttribute,
  FunctionCode,
  RefAttribute,
} from "@unframework/ir";

import { reactProp, targetGuarded } from "./events.ts";
import { listenHelper, onceHelper } from "./helpers.ts";
import type { ListenerMode, ReactPlan } from "./plan.ts";
import type { ReactCode } from "./rules.ts";
import { locals, templateRefType, withEventTypes } from "./setup.ts";

type JsxAttributeItem = ReturnType<typeof js.jsxAttribute>;

/** How one element's listeners and template ref are printed. */
interface ElementListeners {
  /** The synthetic listeners by prop, each group in attribute order. */
  props: Map<string, EventAttribute[]>;
  /** The native listeners, those of one event and phase together, in attribute order. */
  native: EventAttribute[][];
  ref?: RefAttribute;
  /** The attribute the element's `ref` is printed at: its first native listener or ref. */
  refAt?: Attribute;
  /** The ref callback declared once in the component's body, by name. */
  callback?: string;
}

/** Prints the listeners and template refs of a planned component's elements. */
export class ReactListeners {
  readonly #plan: ReactPlan;
  readonly #code: ReactCode;
  readonly #elements = new WeakMap<ElementNode, ElementListeners>();

  constructor(plan: ReactPlan, code: ReactCode) {
    this.#plan = plan;
    this.#code = code;
  }

  /** The `listen` helper's name, claimed once a native listener needs it. */
  get #listen(): string {
    return (this.#plan.helpers.listen ??= this.#plan.names.claim("listen"));
  }

  #of(element: ElementNode): ElementListeners {
    let found = this.#elements.get(element);
    if (found) return found;
    // The printer's element may be a copy (`rootForReact`): the plan knows its attributes.
    const listened = element.attributes.find((attribute) => attribute.kind === "Event");
    const planned = listened && this.#plan.listeners.get(listened)!.element;
    const native = planned && this.#plan.nativeElements.get(planned);
    found = { props: new Map(), native: native?.groups ?? [] };
    if (native?.callback) found.callback = native.callback;
    for (const attribute of element.attributes) {
      if (attribute.kind === "Ref") {
        found.ref = attribute;
        found.refAt ??= attribute;
      } else if (attribute.kind === "Event") {
        if (this.#plan.listeners.get(attribute)!.mode === "native") {
          found.refAt ??= attribute;
        } else {
          const prop = reactProp(attribute);
          const group = found.props.get(prop);
          if (group) group.push(attribute);
          else found.props.set(prop, [attribute]);
        }
      }
    }
    this.#elements.set(element, found);
    return found;
  }

  /**
   * The ref callbacks declared once, as statements of the component's body, in render order:
   * `const [nameListeners] = useState(() => (element: Element | null) => listen(…));`.
   */
  declarations(): string[] {
    const statements: string[] = [];
    for (const [element, { callback }] of this.#plan.nativeElements) {
      if (!callback) continue;
      const listeners = this.#of(element);
      const useState = this.#plan.names.add("react", "useState");
      const type = listeners.ref ? templateRefType(this.#plan, listeners.ref.binding) : "Element";
      const arrow = this.#callback(listeners, `${type} | null`);
      statements.push(`const [${callback}] = ${useState}(() => ${arrow});`);
    }
    return statements;
  }

  /** A listener's attributes: its prop, or the element's ref, or nothing (merged). */
  event(attribute: EventAttribute, element: ElementNode, context: JsxContext): JsxAttributeItem[] {
    const listeners = this.#of(element);
    if (this.#plan.listeners.get(attribute)!.mode === "native") {
      return listeners.refAt === attribute ? [this.#refAttribute(listeners, context)] : [];
    }
    const prop = reactProp(attribute);
    const group = listeners.props.get(prop)!;
    if (group[0] !== attribute) return [];
    const handler = this.#synthetic(group, element);
    return [
      js.jsxAttribute(prop, js.jsxExpressionContainer(context.placeholders.expression(handler))),
    ];
  }

  /**
   * A template ref's attribute: `ref={input}`, or the element's ref callback. React's `ref` takes
   * a ref of the element's own interface: one typed otherwise (`useRef<HTMLElement>` on a
   * `<div>`, or on elements of several interfaces) is set by a callback, which takes the element
   * whatever the ref's type.
   */
  ref(attribute: RefAttribute, element: ElementNode, context: JsxContext): JsxAttributeItem[] {
    const listeners = this.#of(element);
    if (listeners.refAt !== attribute) return [];
    if (listeners.native.length === 0) {
      const { name } = this.#plan.bindings.get(attribute.binding)!;
      const own = this.#plan.refInterfaces.get(attribute);
      if (own === templateRefType(this.#plan, attribute.binding)) {
        return [js.jsxAttribute("ref", js.jsxExpressionContainer(js.identifier(name)))];
      }
      const { element: local } = locals([name], ["element"]);
      const callback = `(${local}) => {\n${name}.current = ${local};\n}`;
      return [
        js.jsxAttribute(
          "ref",
          js.jsxExpressionContainer(context.placeholders.expression(callback)),
        ),
      ];
    }
    return [this.#refAttribute(listeners, context)];
  }

  /** The `ref` of an element with native listeners: its declared callback, or one in place. */
  #refAttribute(listeners: ElementListeners, context: JsxContext): JsxAttributeItem {
    const value = listeners.callback
      ? js.identifier(listeners.callback)
      : context.placeholders.expression(this.#callback(listeners));
    return js.jsxAttribute("ref", js.jsxExpressionContainer(value));
  }

  /** The handler of one synthetic prop: its listeners, guarded, in attribute order. */
  #synthetic(group: EventAttribute[], element: ElementNode): string {
    const [first] = group;
    const guarded = targetGuarded(first!, element);
    if (group.length === 1 && !first!.once && !guarded) return this.#handler(first!, "synthetic");
    // A listener of an event that does not bubble runs, as in the DOM, only at its target.
    return this.#wrapped(group, "synthetic", (event) =>
      guarded ? `if (${event}.target !== ${event}.currentTarget) return;` : undefined,
    );
  }

  /**
   * One handler that runs `group`'s listeners in attribute order, each that runs once behind its
   * guard, after `head`'s statement. A listener's own code is written out where it can stand among
   * the others: one that is async, or returns early other than through guards at its top level,
   * is a local function the handler calls, so every listener after it starts as the DOM runs
   * them, in the dispatch, and none is skipped by its `return`.
   */
  #wrapped(
    group: EventAttribute[],
    mode: ListenerMode,
    head: (event: string) => string | undefined,
  ): string {
    const typed = group.map((listener) =>
      listener.handler.kind === "Inline"
        ? withEventTypes(this.#plan, listener.handler.function, new Set([mode]), true)
        : undefined,
    );
    const named = typed.find((fn) => fn?.parameters[0]?.name)?.parameters[0];
    const handlers = group.map((listener) => this.#handler(listener, mode));
    const event = named?.name ?? locals(handlers, ["event"]).event;
    const single = group.length === 1;
    const lines = [head(event)].filter((line) => line !== undefined);
    const taken = [...handlers, event];
    let awaits = false;
    for (const [index, listener] of group.entries()) {
      const fn = typed[index];
      const later = handlers.slice(index + 1);
      const statements =
        single && fn
          ? this.#body(fn)
          : this.#statements(listener, fn, handlers[index]!, event, later, taken);
      // A single listener's own code is the handler's: an async one makes it async.
      awaits ||= single && fn?.async === true;
      if (!listener.once) lines.push(statements);
      else if (single) lines.push(`if (!${this.#once(listener)}(${event})) return;`, statements);
      else lines.push(`if (${this.#once(listener)}(${event})) {\n${statements}\n}`);
    }
    const async = awaits ? "async " : "";
    const parameter = named ? parameterText(named) : event;
    return `${async}(${parameter}) => {\n${lines.join("\n")}\n}`;
  }

  /**
   * The statements that run one listener among several in a handler the target writes, whose
   * event is `event`: a call of the function it names; its own code where it is synchronous, its
   * parameter is that event (or it has none), it returns early only through guards at its top
   * level (written as the negated condition around the rest), and it declares no name a later
   * listener reads; otherwise a local function the handler calls, whose promise floats where it
   * is async. `taken` gathers the names the handler holds.
   */
  #statements(
    listener: EventAttribute,
    typed: FunctionCode | undefined,
    handler: string,
    event: string,
    later: readonly string[],
    taken: string[],
  ): string {
    if (!typed) {
      const fn = this.#function(listener);
      const argument = fn && fn.parameters.length > 0 ? event : "";
      return `${handler}(${argument});`;
    }
    const own = typed.parameters[0];
    const body = this.#body(typed);
    const same = own === undefined || own.name === event;
    if (!typed.async && same) {
      const written = withoutGuards(body);
      // A listener that runs once is written in a block of its own; another at the handler's top
      // level, whose declarations must leave the event and the later listeners' names alone.
      const captures =
        !listener.once && written !== undefined && declaresRead(written, [...later, event]);
      if (written !== undefined && !captures) return written;
    }
    const base = `${listener.event}Listener`;
    const local = locals(taken, [base])[base]!;
    taken.push(local);
    const async = typed.async ? "async " : "";
    const parameter = same ? "" : `${own!.name}: typeof ${event}`;
    const call = `${typed.async ? "void " : ""}${local}(${same ? "" : event});`;
    return `const ${local} = ${async}(${parameter}) => {\n${body}\n};\n${call}`;
  }

  /**
   * The ref callback that adds an element's native listeners, one `listen` call for each event
   * and phase, and sets its template ref; `type` types its parameter where no prop does.
   */
  #callback(listeners: ElementListeners, type?: string): string {
    const listen = this.#listen;
    const handlers = listeners.native.map((group) => this.#nativeHandler(group));
    const ref = listeners.ref && this.#plan.bindings.get(listeners.ref.binding)!.name;
    const local = locals(
      [...handlers, listen, ref ?? ""],
      ["element", "stop", "cleanups", "cleanup"],
    );
    const calls = listeners.native.map(([first], index) => {
      const options = first!.capture
        ? ", { capture: true }"
        : first!.passive
          ? ", { passive: true }"
          : "";
      return `${listen}(${local.element}, "${first!.event}", ${handlers[index]!}${options})`;
    });
    const parameter = type ? `(${local.element}: ${type})` : `(${local.element})`;
    if (!ref && calls.length === 1) return `${parameter} => ${calls[0]!}`;
    const lines = ref ? [`${ref}.current = ${local.element};`] : [];
    const stops = [ref ? `${ref}.current = null;` : undefined];
    if (calls.length === 1) {
      lines.push(`const ${local.stop} = ${calls[0]!};`);
      stops.push(`${local.stop}();`);
    } else {
      lines.push(`const ${local.cleanups} = [${calls.join(", ")}];`);
      stops.push(`for (const ${local.cleanup} of ${local.cleanups}) ${local.cleanup}();`);
    }
    const cleanup = stops.filter((line) => line !== undefined).join("\n");
    return `${parameter} => {\n${lines.join("\n")}\nreturn () => {\n${cleanup}\n};\n}`;
  }

  /** The handler of one native event and phase: its listeners in attribute order, guarded. */
  #nativeHandler(group: EventAttribute[]): string {
    const [first] = group;
    if (group.length === 1 && !first!.once) return this.#handler(first!, "native");
    return this.#wrapped(group, "native", () => undefined);
  }

  /** A listener's handler as code: the function it names, or the one it writes. */
  #handler(listener: EventAttribute, mode: "synthetic" | "native"): string {
    const { handler } = listener;
    if (handler.kind === "Function") {
      return handlerText(handler, this.#plan.component, this.#code.rules, "client");
    }
    const typed = withEventTypes(this.#plan, handler.function, new Set([mode]), true);
    return this.#code.fn(typed, "client");
  }

  /** A function's body as the statements of a function the target writes around it. */
  #body(fn: FunctionCode): string {
    return this.#code.statements(fn, "client");
  }

  /** The setup function a listener names. */
  #function(listener: EventAttribute): FunctionCode | undefined {
    if (listener.handler.kind !== "Function") return undefined;
    const { binding } = listener.handler;
    const item = this.#plan.component.setup.find(
      (entry) => entry.kind === "Function" && entry.binding === binding,
    );
    return item?.kind === "Function" ? item.function : undefined;
  }

  /** The guard of a listener that runs once. */
  #once(listener: EventAttribute): string {
    return this.#plan.onceGuards.get(listener)!;
  }
}

/** The helpers the listeners of a planned component need, after it is printed. */
export function listenerHelpers(plan: ReactPlan): string[] {
  const helpers: string[] = [];
  if (plan.helpers.listen) helpers.push(listenHelper(plan.helpers.listen));
  if (plan.helpers.once)
    helpers.push(onceHelper(plan.helpers.once, plan.names.add("react", "useRef")));
  return helpers;
}

/**
 * A listener's statements with its early returns written as conditions: each guard at its top
 * level, `if (test) return;`, becomes `if (!test) { …the rest… }`. `undefined` where it returns
 * otherwise (in a loop, a branch or a `switch`, with a value that does work, or as its last
 * statement), which only a function of its own can hold.
 */
function withoutGuards(statements: string): string | undefined {
  if (!/\breturn\b/.test(statements)) return statements;
  const { statements: parsed } = parseStatementsSource(statements);
  const guards = parsed.filter(isGuard);
  let returns = 0;
  visitNodes(parsed, (node) => {
    if (node.type === "ReturnStatement" && !insideFunction(parsed, node)) returns++;
  });
  if (returns !== guards.length || guards.at(-1) === parsed.at(-1)) return undefined;
  let text = statements;
  for (const guard of guards.toReversed()) {
    const { test } = guard as unknown as { test: Node };
    const rest = text.slice(guard.end).trim();
    text = `${text.slice(0, guard.start)}if (${negated(test, statements)}) {\n${rest}\n}`;
  }
  return text;
}

/** Whether a statement is a guard: `if (test) return;`, with no value that does work. */
function isGuard(statement: unknown): statement is Node {
  if (!isNode(statement) || statement.type !== "IfStatement") return false;
  const { consequent, alternate } = statement as unknown as {
    consequent: Node;
    alternate: unknown;
  };
  if (alternate) return false;
  const inner =
    consequent.type === "BlockStatement"
      ? (consequent as unknown as { body: Node[] }).body
      : [consequent];
  const [only] = inner;
  if (inner.length !== 1 || only?.type !== "ReturnStatement") return false;
  const { argument } = only as unknown as { argument: Node | null };
  return !argument || argument.type === "Literal";
}

/** Whether a node lies inside a function written in code. */
function insideFunction(root: unknown, target: Node): boolean {
  let inside = false;
  visitNodes(root, (node) => {
    if (FUNCTIONS.has(node.type) && node.start <= target.start && target.end <= node.end) {
      inside = true;
    }
  });
  return inside;
}

const FUNCTIONS = new Set(["ArrowFunctionExpression", "FunctionExpression", "FunctionDeclaration"]);

/** The negation of a guard's test, as a person writes it: `a !== b`, `x` for `!x`, `!(a && b)`. */
function negated(test: Node, code: string): string {
  const text = code.slice(test.start, test.end);
  const fields = test as unknown as {
    operator?: string;
    left?: Node;
    right?: Node;
    argument?: Node;
  };
  const flipped = fields.operator && EQUALITIES.get(fields.operator);
  if (test.type === "BinaryExpression" && flipped && fields.left && fields.right) {
    const gap = code.slice(fields.left.end, fields.right.start).replace(fields.operator!, flipped);
    return `${code.slice(test.start, fields.left.end)}${gap}${code.slice(fields.right.start, test.end)}`;
  }
  if (test.type === "UnaryExpression" && fields.operator === "!" && fields.argument) {
    return code.slice(fields.argument.start, fields.argument.end);
  }
  return SIMPLE.has(test.type) ? `!${text}` : `!(${text})`;
}

const EQUALITIES: ReadonlyMap<string, string> = new Map([
  ["===", "!=="],
  ["!==", "==="],
  ["==", "!="],
  ["!=", "=="],
]);

/** Expressions `!` applies to without parentheses. */
const SIMPLE = new Set([
  "Identifier",
  "MemberExpression",
  "CallExpression",
  "ThisExpression",
  "Literal",
]);

/**
 * Whether statements written at a handler's top level declare a name that a later listener's
 * code reads, or the handler's event: the later code would read the declaration, not the name the
 * source means.
 */
function declaresRead(statements: string, later: readonly string[]): boolean {
  if (!later.length) return false;
  const { statements: parsed } = parseStatementsSource(statements);
  const declared: string[] = [];
  for (const statement of parsed) {
    if (statement.type === "VariableDeclaration") {
      for (const declarator of statement.declarations) {
        visitNodes(declarator.id, (node) => {
          if (node.type === "Identifier") declared.push((node as unknown as { name: string }).name);
        });
      }
    } else if (
      (statement.type === "FunctionDeclaration" || statement.type === "ClassDeclaration") &&
      statement.id
    ) {
      declared.push(statement.id.name);
    }
  }
  return declared.some((name) =>
    later.some((code) =>
      new RegExp(`(?<![\\w$.])${name.replace(/\$/g, "\\$")}(?![\\w$])`).test(code),
    ),
  );
}

/** A node of oxc's AST, as far as a walk reads it. */
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

/** Calls `visit` on every node of an AST, parents before their children. */
function visitNodes(root: unknown, visit: (node: Node) => void): void {
  if (Array.isArray(root)) {
    for (const item of root) visitNodes(item, visit);
    return;
  }
  if (!isNode(root)) return;
  visit(root);
  for (const [key, value] of Object.entries(root)) {
    if (key !== "type" && key !== "parent" && typeof value === "object") visitNodes(value, visit);
  }
}
