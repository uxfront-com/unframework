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
// or a value its branch narrows, is written in place, and so is one beside a directive whose value
// reads the row or a scoped fill's props: that directive's callback is made as the row renders,
// `withTrace(item.label)`, and joins the element's others through the inline `mergeRefs`
// (ADR-0108).
import {
  expressionCode,
  handlerText,
  js,
  parameterText,
  parseStatementsSource,
} from "@unframework.dev/codegen";
import type { JsxContext } from "@unframework.dev/codegen";
import type {
  Attribute,
  BoundAttribute,
  ComponentNode,
  DirectiveAttribute,
  ElementNode,
  EventAttribute,
  FunctionCode,
  ModelAttribute,
  RefAttribute,
  StaticAttribute,
} from "@unframework.dev/ir";

import type { ReactComposer } from "./compose.ts";
import { componentFallthroughTag } from "./composition.ts";
import { reactProp, targetGuarded } from "./events.ts";
import { listenHelper, onceHelper } from "./helpers.ts";
import type { ListenerMode, ReactPlan } from "./plan.ts";
import type { ReactCode } from "./rules.ts";
import { locals, templateRefType, withEventTypes } from "./setup.ts";

type JsxAttributeItem = ReturnType<typeof js.jsxAttribute>;

/** How one element's listeners and template ref are printed. */
interface ElementListeners {
  /** The synthetic listeners by prop, each group in attribute order. */
  props: Map<string, Array<EventAttribute>>;
  /** The native listeners, those of one event and phase together, in attribute order. */
  native: Array<Array<EventAttribute>>;
  ref?: RefAttribute;
  /** The attribute the element's `ref` is printed at: its first native listener or ref. */
  refAt?: Attribute;
  /** The ref callback declared once in the component's body, by name. */
  callback?: string;
  /** Whether the callback puts a `<textarea>`'s caret after its text (`Caret`, ADR-0060). */
  caret?: boolean;
  /** The directives it applies, in attribute order (ADR-0099), each by its ref callback. */
  directives: Array<{ attribute: DirectiveAttribute; ref: string }>;
}

/** Prints the listeners and template refs of a planned component's elements. */
export class ReactListeners {
  readonly #plan: ReactPlan;
  readonly #code: ReactCode;
  readonly #elements = new WeakMap<ElementNode, ElementListeners>();
  readonly #heads = new WeakMap<ElementNode, Map<string, (event: string) => Array<string>>>();
  #composer: ReactComposer | undefined;

  constructor(plan: ReactPlan, code: ReactCode) {
    this.#plan = plan;
    this.#code = code;
  }

  /** Connects the composer, whose `v-model` handlers run first in a listener's that shares them. */
  connect(composer: ReactComposer): void {
    this.#composer = composer;
  }

  /**
   * The handlers of the element's `v-model` that one of its synthetic listeners shares, by
   * React prop: that listener's handler runs them first, as Vue adds the model's listener before
   * the element's own (ADR-0054). Two `onChange` props would leave only the last.
   */
  modelHeads(
    element: ElementNode,
    context: JsxContext,
  ): Map<string, (event: string) => Array<string>> {
    let heads = this.#heads.get(element);
    if (heads) {
      return heads;
    }
    heads = new Map();
    this.#heads.set(element, heads);
    const { props } = this.#of(element);
    for (const attribute of element.attributes) {
      if (attribute.kind !== "Model") {
        continue;
      }
      const parts = this.#composer!.modelParts(attribute, element, context);
      for (const [prop, handler] of parts.handlers) {
        if (props.has(prop)) {
          heads.set(prop, handler.statements);
        }
      }
    }
    return heads;
  }

  /** The `listen` helper's name, claimed once a native listener needs it. */
  get #listen(): string {
    return (this.#plan.helpers.listen ??= this.#plan.names.claim("listen"));
  }

  #of(element: ElementNode): ElementListeners {
    let found = this.#elements.get(element);
    if (found) {
      return found;
    }
    // The printer's element may be a copy (`rootForReact`): the plan knows its attributes.
    const listened = element.attributes.find((attribute) => attribute.kind === "Event");
    const planned = listened && this.#plan.listeners.get(listened)!.element;
    const native = planned && this.#plan.nativeElements.get(planned);
    found = { props: new Map(), native: native?.groups ?? [], directives: [] };
    if (native?.callback) {
      found.callback = native.callback;
    }
    for (const attribute of element.attributes) {
      if (attribute.kind === "Ref") {
        found.ref = attribute;
        found.refAt ??= attribute;
      } else if (attribute.kind === "Event") {
        if (this.#plan.listeners.get(attribute)!.mode === "native") {
          found.refAt ??= attribute;
        } else {
          const prop = propOf(attribute, element);
          const group = found.props.get(prop);
          if (group) {
            group.push(attribute);
          } else {
            found.props.set(prop, [attribute]);
          }
        }
      }
    }
    const model = element.attributes.find(
      (attribute) => attribute.kind === "Model" && this.#plan.carets.has(attribute),
    );
    if (model?.kind === "Model") {
      found.caret = true;
      found.refAt ??= model;
      const { callback } = this.#plan.carets.get(model)!;
      if (callback) {
        found.callback ??= callback;
      }
    }
    // Each directive's ref callback, which the element's own callback calls where it has one.
    for (const attribute of element.attributes) {
      if (attribute.kind !== "Directive") {
        continue;
      }
      found.directives.push({ attribute, ref: this.#plan.directiveRefs.get(attribute)! });
      found.refAt ??= attribute;
    }
    this.#elements.set(element, found);
    return found;
  }

  /**
   * A directive's attribute (ADR-0099): `ref={focusTrapRef}`, the ref callback its call returns,
   * or the element's own callback, which calls each directive's, where it has one.
   */
  directive(
    attribute: DirectiveAttribute,
    element: ElementNode,
    context: JsxContext,
  ): Array<JsxAttributeItem> {
    const listeners = this.#of(element);
    if (listeners.refAt !== attribute) {
      return [];
    }
    const [only, ...others] = listeners.directives;
    if (
      !listeners.native.length &&
      !listeners.caret &&
      !listeners.ref &&
      !others.length &&
      !this.#plan.elementDirectives.has(only!.attribute)
    ) {
      return [js.jsxAttribute("ref", js.jsxExpressionContainer(js.identifier(only!.ref)))];
    }
    return [this.#refAttribute(listeners, context)];
  }

  /**
   * The ref callbacks declared once, as statements of the component's body, in render order:
   * `const [nameListeners] = useState(() => (element: Element | null) => listen(…));`, then the
   * callbacks of `<textarea>` models alone (`textCaret`).
   */
  declarations(): Array<string> {
    const statements: Array<string> = [];
    const elements = [
      ...this.#plan.nativeElements,
      ...[...this.#plan.carets.values()].map(
        ({ element, callback }) => [element, { callback }] as const,
      ),
    ];
    for (const [element, { callback }] of elements) {
      if (!callback) {
        continue;
      }
      const listeners = this.#of(element);
      const useState = this.#plan.names.add("react", "useState");
      const type = listeners.caret
        ? "HTMLTextAreaElement"
        : listeners.ref
          ? templateRefType(this.#plan, listeners.ref.binding)
          : "Element";
      const arrow = this.#callback(listeners, `${type} | null`);
      statements.push(`const [${callback}] = ${useState}(() => ${arrow});`);
    }
    return statements;
  }

  /**
   * The element what a parent passes a child lands on (ADR-0118), of the child's fallthrough
   * tag, holding all of it: the one its listeners are planned on, which groups them.
   */
  fallthroughElement(
    node: ComponentNode,
    attributes: ReadonlyArray<StaticAttribute | BoundAttribute | EventAttribute>,
  ): ElementNode {
    const listened = attributes.find((attribute) => attribute.kind === "Event");
    if (listened) {
      return this.#plan.listeners.get(listened)!.element;
    }
    return {
      kind: "Element",
      tag: componentFallthroughTag(this.#plan.module, node) ?? "",
      attributes: [...attributes],
      children: [],
      span: node.span,
    };
  }

  /** A listener's attributes: its prop, or the element's ref, or nothing (merged). */
  event(
    attribute: EventAttribute,
    element: ElementNode,
    context: JsxContext,
  ): Array<JsxAttributeItem> {
    const listeners = this.#of(element);
    if (this.#plan.listeners.get(attribute)!.mode === "native") {
      return listeners.refAt === attribute ? [this.#refAttribute(listeners, context)] : [];
    }
    const prop = propOf(attribute, element);
    const group = listeners.props.get(prop)!;
    if (group[0] !== attribute) {
      return [];
    }
    // A consumer's listener of the prop runs after the fallthrough node's own (ADR-0118).
    const consumer = this.#composer!.consumerListener(prop, element.span);
    const handler = this.#synthetic(
      group,
      element,
      this.modelHeads(element, context).get(prop),
      consumer,
    );
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
  ref(attribute: RefAttribute, element: ElementNode, context: JsxContext): Array<JsxAttributeItem> {
    const listeners = this.#of(element);
    if (listeners.refAt !== attribute) {
      return [];
    }
    if (listeners.native.length === 0 && !listeners.caret && !listeners.directives.length) {
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

  /** The `ref` a `<textarea>`'s `v-model` prints, where nothing else on the element does. */
  modelRef(
    attribute: ModelAttribute,
    element: ElementNode,
    context: JsxContext,
  ): Array<JsxAttributeItem> {
    const listeners = this.#of(element);
    return listeners.refAt === attribute ? [this.#refAttribute(listeners, context)] : [];
  }

  /** The `ref` of an element with native listeners: its declared callback, or one in place. */
  #refAttribute(listeners: ElementListeners, context: JsxContext): JsxAttributeItem {
    if (listeners.directives.some(({ attribute }) => this.#plan.elementDirectives.has(attribute))) {
      return js.jsxAttribute(
        "ref",
        js.jsxExpressionContainer(
          context.placeholders.expression(this.#joined(listeners, context)),
        ),
      );
    }
    const value = listeners.callback
      ? js.identifier(listeners.callback)
      : context.placeholders.expression(this.#callback(listeners));
    return js.jsxAttribute("ref", js.jsxExpressionContainer(value));
  }

  /**
   * The `ref` of an element one of whose directives reads the row or a scoped fill's props
   * (ADR-0108): that directive's callback, made as the row renders with the value, where the
   * branches around the element still narrow it, `withTrace(item.label)`. The element's other
   * directives' callbacks, and the callback written in place for its native listeners and its
   * template ref, join it through `mergeRefs`, in attribute order.
   */
  #joined(listeners: ElementListeners, context: JsxContext): string {
    const parts = listeners.directives.map(({ attribute, ref }) =>
      this.#plan.elementDirectives.has(attribute)
        ? `${ref}(${expressionCode(attribute.value, context)})`
        : ref,
    );
    if (listeners.native.length || listeners.ref) {
      parts.push(this.#callback({ ...listeners, directives: [] }));
    }
    if (parts.length === 1) {
      return parts[0]!;
    }
    const merge = (this.#plan.helpers.mergeRefs ??= this.#plan.names.claim("mergeRefs"));
    return `${merge}(${parts.join(", ")})`;
  }

  /**
   * The handler of one synthetic prop: its listeners, guarded, in attribute order, after what a
   * `v-model` on the element writes there (`model`), and before the consumer's listener of the
   * prop, its local `consumer`, where the element is the fallthrough node (ADR-0118).
   */
  #synthetic(
    group: Array<EventAttribute>,
    element: ElementNode,
    model?: (event: string) => Array<string>,
    consumer?: string,
  ): string {
    const [first] = group;
    const guarded = targetGuarded(first!, element);
    if (group.length === 1 && !first!.once && !guarded && !model && consumer === undefined) {
      return this.#handler(first!, "synthetic");
    }
    // A listener of an event that does not bubble runs, as in the DOM, only at its target.
    return this.#wrapped(
      group,
      "synthetic",
      (event) => {
        const lines = [
          ...(guarded ? [`if (${event}.target !== ${event}.currentTarget) return;`] : []),
          ...(model ? model(event).map((line) => `${line};`) : []),
        ];
        return lines.length ? lines.join("\n") : undefined;
      },
      consumer,
    );
  }

  /**
   * One handler that runs `group`'s listeners in attribute order, each that runs once behind its
   * guard, after `head`'s statement. A listener's own code is written out where it can stand among
   * the others: one that is async, or returns early other than through guards at its top level,
   * is a local function the handler calls, so every listener after it starts as the DOM runs
   * them, in the dispatch, and none is skipped by its `return`. `consumer` is the prop of the
   * consumer's listener it calls last (ADR-0118).
   */
  #wrapped(
    group: Array<EventAttribute>,
    mode: ListenerMode,
    head: (event: string) => string | undefined,
    consumer?: string,
  ): string {
    // The listeners' own code: only the handler's parameter is printed with a type, so only its
    // annotation is React's, whose import an unprinted one would leave unused (L5).
    const own = group.map((listener) =>
      listener.handler.kind === "Inline" ? listener.handler.function : undefined,
    );
    const first = own.find((fn) => fn?.parameters[0]?.name);
    const named =
      first &&
      (consumer === undefined ? withEventTypes(this.#plan, first, new Set([mode]), true) : first)
        .parameters[0];
    const handlers = group.map((listener) => this.#text(listener));
    const event =
      named?.name ??
      locals(consumer === undefined ? handlers : [...handlers, consumer], ["event"]).event;
    // A consumer's listener runs last, so no early return of the node's own may skip it.
    const single = group.length === 1 && consumer === undefined;
    const lines = [head(event)].filter((line) => line !== undefined);
    const taken = [...handlers, event];
    let awaits = false;
    for (const [index, listener] of group.entries()) {
      const fn = own[index];
      const later = [...handlers.slice(index + 1), ...(consumer === undefined ? [] : [consumer])];
      const statements =
        single && fn
          ? this.#body(fn)
          : this.#statements(listener, fn, handlers[index]!, event, later, taken);
      // A single listener's own code is the handler's: an async one makes it async.
      awaits ||= single && fn?.async === true;
      if (!listener.once) {
        lines.push(statements);
      } else if (single) {
        lines.push(`if (!${this.#once(listener)}(${event})) return;`, statements);
      } else {
        lines.push(`if (${this.#once(listener)}(${event})) {\n${statements}\n}`);
      }
    }
    if (consumer !== undefined) {
      lines.push(`${consumer}?.(${event});`);
    }
    const async = awaits ? "async " : "";
    // A handler whose code never reads its event takes none (an unused parameter fails L5).
    const reads = new RegExp(`(?<![\\w$.])${event.replace(/\$/g, String.raw`\$`)}(?![\\w$])`).test(
      lines.join("\n"),
    );
    // The consumer's listener takes the event React gives its prop, which may be narrower than
    // the source's annotation (`Event` where `onInput` gives an `InputEvent`): the handler takes
    // the prop's type, which the source's annotation, a DOM interface the event's extends, holds.
    const parameter = named
      ? consumer === undefined
        ? parameterText(named)
        : untyped(parameterText(named))
      : reads
        ? event
        : "";
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
    later: ReadonlyArray<string>,
    taken: Array<string>,
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
      if (written !== undefined && !captures) {
        return written;
      }
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
    // A `<textarea>`'s caret alone needs no `listen`: the helper is claimed where it is called.
    const listen = listeners.native.length ? this.#listen : "";
    const handlers = listeners.native.map((group) => this.#nativeHandler(group));
    const ref = listeners.ref && this.#plan.bindings.get(listeners.ref.binding)!.name;
    const local = locals(
      [...handlers, listen, ref ?? ""],
      ["element", "stop", "cleanups", "cleanup", "text", "detaches", "detach"],
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
    if (!ref && !listeners.caret && !listeners.directives.length && calls.length === 1) {
      return `${parameter} => ${calls[0]!}`;
    }
    const lines = ref ? [`${ref}.current = ${local.element};`] : [];
    if (listeners.caret) {
      // Set as Vue's `vModelText` sets it, on a field that holds no text: the caret ends after the
      // text, and no `select` fires, as `setSelectionRange` would make it.
      const { element, text } = local;
      lines.push(
        `if (${element}) {\nconst ${text} = ${element}.value;\n${element}.value = "";\n${element}.value = ${text};\n}`,
      );
    }
    // Each directive's callback records the element, and forgets that element once the
    // element's own callback is cleaned up, through the cleanup it returns (ADR-0099).
    const [onlyDirective, ...otherDirectives] = listeners.directives;
    if (onlyDirective !== undefined && !otherDirectives.length) {
      lines.push(`const ${local.detach} = ${onlyDirective.ref}(${local.element});`);
    } else if (onlyDirective !== undefined) {
      const calls = listeners.directives.map(
        ({ ref: directive }) => `${directive}(${local.element})`,
      );
      lines.push(`const ${local.detaches} = [${calls.join(", ")}];`);
    }
    const stops = [
      ref ? `${ref}.current = null;` : undefined,
      onlyDirective === undefined
        ? undefined
        : otherDirectives.length
          ? `for (const ${local.detach} of ${local.detaches}) ${local.detach}();`
          : `${local.detach}();`,
    ];
    if (calls.length === 1) {
      lines.push(`const ${local.stop} = ${calls[0]!};`);
      stops.push(`${local.stop}();`);
    } else if (calls.length) {
      lines.push(`const ${local.cleanups} = [${calls.join(", ")}];`);
      stops.push(`for (const ${local.cleanup} of ${local.cleanups}) ${local.cleanup}();`);
    }
    const cleanup = stops.filter((line) => line !== undefined).join("\n");
    const stop = cleanup ? `return () => {\n${cleanup}\n};\n` : "";
    return `${parameter} => {\n${lines.join("\n")}\n${stop}}`;
  }

  /** The handler of one native event and phase: its listeners in attribute order, guarded. */
  #nativeHandler(group: Array<EventAttribute>): string {
    const [first] = group;
    if (group.length === 1 && !first!.once) {
      return this.#handler(first!, "native");
    }
    return this.#wrapped(group, "native", () => undefined);
  }

  /** A listener's handler as code: the function it names, or the one it writes. */
  #handler(listener: EventAttribute, mode: "synthetic" | "native"): string {
    const { handler } = listener;
    if (handler.kind === "Function") {
      return handlerText(handler, this.#plan.owner, this.#code.rules, "client");
    }
    const typed = withEventTypes(this.#plan, handler.function, new Set([mode]), true);
    return this.#code.fn(typed, "client");
  }

  /**
   * A listener's handler as the source writes it, which a handler the target writes reads only
   * for the names it holds: the function it names, or the one it writes, with its own types.
   */
  #text(listener: EventAttribute): string {
    const { handler } = listener;
    if (handler.kind === "Function") {
      return handlerText(handler, this.#plan.owner, this.#code.rules, "client");
    }
    return this.#code.fn(handler.function, "client");
  }

  /** A function's body as the statements of a function the target writes around it. */
  #body(fn: FunctionCode): string {
    return this.#code.statements(fn, "client");
  }

  /** The setup function a listener names. */
  #function(listener: EventAttribute): FunctionCode | undefined {
    if (listener.handler.kind !== "Function") {
      return undefined;
    }
    const { binding } = listener.handler;
    const item = this.#plan.owner.setup.find(
      (entry) => entry.kind === "Function" && entry.binding === binding,
    );
    return item?.kind === "Function" ? item.function : undefined;
  }

  /** The guard of a listener that runs once. */
  #once(listener: EventAttribute): string {
    return this.#plan.onceGuards.get(listener)!;
  }
}

/**
 * The React prop a synthetic listener is printed under. Beside a text field's \`v-model\`, whose
 * \`onChange\` fires on \`input\` too, an \`input\` listener joins it: it runs after the model's write,
 * as on Vue, where React would run \`onInput\` first.
 */
function propOf(attribute: EventAttribute, element: ElementNode): string {
  const prop = reactProp(attribute);
  if (prop !== "onInput") {
    return prop;
  }
  const text = element.attributes.some(
    (other) =>
      other.kind === "Model" &&
      (other.control === "text" || other.control === "textarea" || other.control === "number"),
  );
  return text ? "onChange" : prop;
}

/** A parameter without its annotation, which the prop's own type gives it: `event?`. */
function untyped(parameter: string): string {
  return parameter.replace(/^([\w$]+\??)[\s\S]*$/, "$1");
}

/** The helpers the listeners of a planned component need, after it is printed. */
export function listenerHelpers(plan: ReactPlan): Array<string> {
  const helpers: Array<string> = [];
  if (plan.helpers.listen) {
    helpers.push(listenHelper(plan.helpers.listen));
  }
  if (plan.helpers.once) {
    helpers.push(onceHelper(plan.helpers.once, plan.names.add("react", "useRef")));
  }
  return helpers;
}

/**
 * A listener's statements with its early returns written as conditions: each guard at its top
 * level, `if (test) return;`, becomes `if (!test) { …the rest… }`. `undefined` where it returns
 * otherwise (in a loop, a branch or a `switch`, with a value that does work, or as its last
 * statement), which only a function of its own can hold.
 */
function withoutGuards(statements: string): string | undefined {
  if (!/\breturn\b/.test(statements)) {
    return statements;
  }
  const { statements: parsed } = parseStatementsSource(statements);
  const guards = parsed.filter(isGuard);
  let returns = 0;
  visitNodes(parsed, (node) => {
    if (node.type === "ReturnStatement" && !insideFunction(parsed, node)) {
      returns++;
    }
  });
  if (returns !== guards.length || guards.at(-1) === parsed.at(-1)) {
    return undefined;
  }
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
  if (!isNode(statement) || statement.type !== "IfStatement") {
    return false;
  }
  const { consequent, alternate } = statement as unknown as {
    consequent: Node;
    alternate: unknown;
  };
  if (alternate) {
    return false;
  }
  const inner =
    consequent.type === "BlockStatement"
      ? (consequent as unknown as { body: Array<Node> }).body
      : [consequent];
  const [only] = inner;
  if (inner.length !== 1 || only?.type !== "ReturnStatement") {
    return false;
  }
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
function declaresRead(statements: string, later: ReadonlyArray<string>): boolean {
  if (!later.length) {
    return false;
  }
  const { statements: parsed } = parseStatementsSource(statements);
  const declared: Array<string> = [];
  for (const statement of parsed) {
    if (statement.type === "VariableDeclaration") {
      for (const declarator of statement.declarations) {
        visitNodes(declarator.id, (node) => {
          if (node.type === "Identifier") {
            declared.push((node as unknown as { name: string }).name);
          }
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
      new RegExp(`(?<![\\w$.])${name.replace(/\$/g, String.raw`\$`)}(?![\\w$])`).test(code),
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
    for (const item of root) {
      visitNodes(item, visit);
    }
    return;
  }
  if (!isNode(root)) {
    return;
  }
  visit(root);
  for (const [key, value] of Object.entries(root)) {
    if (key !== "type" && key !== "parent" && typeof value === "object") {
      visitNodes(value, visit);
    }
  }
}
