// Listeners and template refs as Solid 2 writes them (ADR-0047, ADR-0049, ADR-0102).
//
// - A listener is Solid's event prop, by its own spelling (`onClick`, `onKeyDown`,
//   `onDblClick`): Solid delegates the events it lists to the document and listens natively to
//   the others (`focus`, `blur`, `change`, `submit`, `wheel`), which keeps the DOM's semantics
//   (`event-semantics`, native). Solid 2 has no `on:` namespace, so a listener with an option is
//   added from the element's `ref` callback with its options, as `addEventListener` takes them
//   (`event-capture`, `event-once` and `event-passive`, native), which Solid 2 names the way to
//   give one. A delegated listener runs when the event reaches the document, after every native
//   one: where the component also listens to a delegated event natively after its target
//   (`once`, `passive`), its other listeners of that event are added natively too, so they all
//   run in the DOM's order and `stopPropagation()` stops them alike (ADR-0047). A capture
//   listener needs no such care: it runs before the event reaches its target in any case.
// - Solid takes one listener of an event on an element: the element's others of that event are
//   added from its `ref` callback, with their options, and so are all its listeners of one event
//   and phase where it has more than one (`onClick` and `onClickOnce`), in attribute order, so
//   they run in that order (ADR-0047). So is one of an event Solid's types give no prop on that
//   element (`encrypted` but on `<audio>` and `<video>`).
// - A template ref is a `let` the element's `ref` callback sets, and clears when the element is
//   removed, through an inline helper, `clearedRef`, that registers the cleanup as the `ref` is
//   evaluated in the element's branch, since Solid 2 refuses `onCleanup` in a `ref` callback:
//   empty again, as the other targets' refs are (ADR-0049).
import { jsxExpression, js, parseStatementsSource, rewriteCode } from "@unframework.dev/codegen";
import type { ImportSet, JsxContext, Placeholders } from "@unframework.dev/codegen";
import type {
  DirectiveAttribute,
  ElementNode,
  EventAttribute,
  FunctionCode,
  FunctionItem,
  Handler,
  ListenerAttribute,
  RefAttribute,
  UfComponent,
} from "@unframework.dev/ir";
import { walk } from "@unframework.dev/ir";

import type { Narrowings } from "./narrowing.ts";
import { eventProp } from "./props.ts";
import type { SolidCode } from "./setup.ts";

type JsxAttributeItem = ReturnType<typeof js.jsxAttribute>;

/**
 * Solid's event prop for each DOM event the IR's vocabulary holds (`DOM_EVENTS`), as @solidjs/web
 * 2.0's types spell it (`EventHandlersElement`): Solid reads the event's name in lower case, so
 * only the types care how it is spelled. `encrypted` has a prop only on media elements; elsewhere
 * its listener is added from the `ref`. Pinned by test/listeners.test.ts.
 */
export const SOLID_EVENT_PROPS: ReadonlyMap<string, string> = new Map(
  Object.entries({
    abort: "onAbort",
    animationcancel: "onAnimationCancel",
    animationend: "onAnimationEnd",
    animationiteration: "onAnimationIteration",
    animationstart: "onAnimationStart",
    auxclick: "onAuxClick",
    beforeinput: "onBeforeInput",
    beforetoggle: "onBeforeToggle",
    blur: "onBlur",
    cancel: "onCancel",
    canplay: "onCanPlay",
    canplaythrough: "onCanPlayThrough",
    change: "onChange",
    click: "onClick",
    close: "onClose",
    command: "onCommand",
    compositionend: "onCompositionEnd",
    compositionstart: "onCompositionStart",
    compositionupdate: "onCompositionUpdate",
    contextmenu: "onContextMenu",
    copy: "onCopy",
    cut: "onCut",
    dblclick: "onDblClick",
    drag: "onDrag",
    dragend: "onDragEnd",
    dragenter: "onDragEnter",
    dragleave: "onDragLeave",
    dragover: "onDragOver",
    dragstart: "onDragStart",
    drop: "onDrop",
    durationchange: "onDurationChange",
    emptied: "onEmptied",
    ended: "onEnded",
    error: "onError",
    focus: "onFocus",
    focusin: "onFocusIn",
    focusout: "onFocusOut",
    formdata: "onFormData",
    fullscreenchange: "onFullscreenChange",
    fullscreenerror: "onFullscreenError",
    gotpointercapture: "onGotPointerCapture",
    input: "onInput",
    invalid: "onInvalid",
    keydown: "onKeyDown",
    keypress: "onKeyPress",
    keyup: "onKeyUp",
    load: "onLoad",
    loadeddata: "onLoadedData",
    loadedmetadata: "onLoadedMetadata",
    loadstart: "onLoadStart",
    lostpointercapture: "onLostPointerCapture",
    mousedown: "onMouseDown",
    mouseenter: "onMouseEnter",
    mouseleave: "onMouseLeave",
    mousemove: "onMouseMove",
    mouseout: "onMouseOut",
    mouseover: "onMouseOver",
    mouseup: "onMouseUp",
    paste: "onPaste",
    pause: "onPause",
    play: "onPlay",
    playing: "onPlaying",
    pointercancel: "onPointerCancel",
    pointerdown: "onPointerDown",
    pointerenter: "onPointerEnter",
    pointerleave: "onPointerLeave",
    pointermove: "onPointerMove",
    pointerout: "onPointerOut",
    pointerover: "onPointerOver",
    pointerup: "onPointerUp",
    progress: "onProgress",
    ratechange: "onRateChange",
    reset: "onReset",
    scroll: "onScroll",
    scrollend: "onScrollEnd",
    securitypolicyviolation: "onSecurityPolicyViolation",
    seeked: "onSeeked",
    seeking: "onSeeking",
    select: "onSelect",
    stalled: "onStalled",
    submit: "onSubmit",
    suspend: "onSuspend",
    timeupdate: "onTimeUpdate",
    toggle: "onToggle",
    touchcancel: "onTouchCancel",
    touchend: "onTouchEnd",
    touchmove: "onTouchMove",
    touchstart: "onTouchStart",
    transitioncancel: "onTransitionCancel",
    transitionend: "onTransitionEnd",
    transitionrun: "onTransitionRun",
    transitionstart: "onTransitionStart",
    volumechange: "onVolumeChange",
    waiting: "onWaiting",
    wheel: "onWheel",
  }),
);

/**
 * The events Solid's compiler delegates to the document (@solidjs/web 2.0's `DelegatedEvents`,
 * which @solidjs/compiler delegates): a listener of one runs when the event reaches the document.
 * Pinned by test/listeners.test.ts.
 */
export const DELEGATED_EVENTS: ReadonlySet<string> = new Set([
  "beforeinput",
  "click",
  "contextmenu",
  "dblclick",
  "focusin",
  "focusout",
  "input",
  "keydown",
  "keyup",
  "mousedown",
  "mousemove",
  "mouseout",
  "mouseover",
  "mouseup",
  "pointerdown",
  "pointermove",
  "pointerout",
  "pointerover",
  "pointerup",
  "touchend",
  "touchmove",
  "touchstart",
]);

/** How one element's listeners and template ref print. */
interface ElementPlan {
  /** The listeners its `ref` callback adds, in attribute order: all of an event's but its prop. */
  added: readonly EventAttribute[];
  /**
   * The attribute the `ref` callback prints at: the template ref, the first added listener, or
   * its first directive, whose callback calls each directive and a `v-model`'s helper (ADR-0099).
   * An element with one directive and nothing else for a callback prints `ref={vX(() => value)}`.
   */
  carrier: RefAttribute | EventAttribute | DirectiveAttribute | undefined;
  /** The directives it applies, in attribute order (ADR-0099). */
  directives: readonly DirectiveAttribute[];
}

/** The dialect hooks that print listeners and template refs, for one output file. */
export interface SolidListeners {
  eventAttribute(
    attribute: EventAttribute,
    element: ElementNode,
    context: JsxContext,
  ): JsxAttributeItem[];
  refAttribute(
    attribute: RefAttribute,
    element: ElementNode,
    context: JsxContext,
  ): JsxAttributeItem[];
  /** A directive (ADR-0099): `ref={vFocusTrap(() => open())}`, or a call in the `ref` callback. */
  directiveAttribute(
    attribute: DirectiveAttribute,
    element: ElementNode,
    context: JsxContext,
  ): JsxAttributeItem[];
  /**
   * Whether an element prints a `ref` callback of its own (a template ref, an added listener),
   * which a `v-model`'s helper then joins.
   */
  carries(element: ElementNode): boolean;
  /** A listener of a child's event, `onClear={clear}`: the handler takes its payload. */
  componentEvent(attribute: ListenerAttribute): JsxAttributeItem[];
  /**
   * A component ref (ADR-0054): a `let` the `ref` callback sets to what the child exposes, and
   * clears when the child is disposed, as an element's (ADR-0049). On a child that exposes
   * nothing, it holds the child's root element (`element`, ADR-0118), which the child's spread
   * hands it from a `ref` callback, where Solid 2 refuses `onCleanup`: it is emptied as an
   * element's template ref is, through `clearedRef`. `forwarded` reads the component's own
   * consumer's `ref`, which a root component hands the element too.
   */
  componentRef(attribute: RefAttribute, element: boolean, forwarded?: string): JsxAttributeItem[];
  /**
   * A listener of the element that takes what falls through, which calls the consumer's of the
   * same event after its own (ADR-0118): `onClick={(event) => { save(); props.onClick?.(event);
   * }}`. `passed` reads the consumer's, `props.onClick`, which `omit` leaves out of the others,
   * so it does not replace this one.
   */
  composedEventAttribute(
    attribute: EventAttribute,
    element: ElementNode,
    prop: string,
    passed: string,
    typed?: boolean,
  ): JsxAttributeItem[];
}

/** What a `ref` does besides the element's own: hand the element to the consumer's `ref`. */
export type ForwardedRef = (element: ElementNode) => string | undefined;

/** Listeners and template refs as Solid writes them (see the module comment). */
export function solidListeners(
  code: SolidCode,
  imports: ImportSet,
  placeholders: Placeholders,
  narrowings: Narrowings,
  modelRef: (element: ElementNode, context: JsxContext) => string[] | undefined,
  forwardedRef: ForwardedRef = () => undefined,
): SolidListeners {
  const native = nativeEvents(code.component);
  const plans = new WeakMap<ElementNode, ElementPlan>();
  const planOf = (element: ElementNode): ElementPlan => {
    let plan = plans.get(element);
    if (!plan) {
      plan = elementPlan(element, code.component, native);
      plans.set(element, plan);
    }
    return plan;
  };
  let parameter: string | undefined;
  let api: string | undefined;
  /**
   * A listener's handler. `tracked` where `solid/reactivity` reads it as a handler (an `on…`
   * prop's value, `addEventListener`'s argument), not where it is an options object's
   * `handleEvent`, so an arrow it hands to a function needs no `untrack` (src/untracked.ts).
   */
  const handler = ({ handler: written }: { handler: Handler }, tracked = true): string => {
    switch (written.kind) {
      case "Function":
        return code.component.bindings.find((entry) => entry.id === written.binding)!.name;
      case "Inline":
        // Inside a branch, what its test narrows is read through the branch's accessor.
        return code.client(narrowings.client(written.function), undefined, tracked);
      default:
        return unreachable(written);
    }
  };
  const expression = (text: string) => js.jsxExpressionContainer(placeholders.expression(text));
  /**
   * The `ref` of an element: its template ref set and cleared, its added listeners, a `v-model`'s
   * helpers and its directives. Solid 2 creates no computation in a `ref` callback, so what makes
   * one (a directive's factory, `modelText`) is evaluated with the `ref`, and the element's `ref`
   * is an array of callbacks, which Solid calls in order.
   */
  const refCallback = (element: ElementNode, context: JsxContext): JsxAttributeItem => {
    parameter ??= imports.claim("element");
    const entries: string[] = [];
    const ref = element.attributes.find((attribute) => attribute.kind === "Ref");
    const refName = ref
      ? code.component.bindings.find((binding) => binding.id === ref.binding)!.name
      : undefined;
    const statements: string[] = [];
    if (refName) statements.push(`${refName} = ${parameter};`);
    for (const added of planOf(element).added) {
      const option = options(added);
      statements.push(
        `${parameter}.addEventListener(${JSON.stringify(added.event)}, ${handler(added)}${option ? `, { ${option} }` : ""});`,
      );
    }
    if (statements.length) {
      const [only] = statements;
      const body =
        statements.length === 1 && !ref ? only!.slice(0, -1) : `{\n${statements.join("\n")}\n}`;
      const callback = `(${parameter}) => ${body}`;
      // A template ref is emptied once its element is removed, from the `ref`'s own branch.
      entries.push(
        refName ? `${code.clearedRef()}(${callback}, () => {\n${refName} = null;\n})` : callback,
      );
    }
    // A `v-model`'s helpers that need the element (src/models.ts).
    entries.push(...(modelRef(element, context) ?? []));
    // Each directive's factory, evaluated as the element renders, as its own `ref` would be.
    for (const directive of planOf(element).directives) {
      const value = rewriteCode(directive.value, code.component, code.rules, "pure");
      entries.push(`${directive.name}(() => ${value})`);
    }
    // The consumer's `ref`, where the element takes it beside its own (ADR-0118): Solid 2 calls
    // each callback of a `ref` array, and skips an absent one.
    const forwarded = forwardedRef(element);
    if (forwarded) entries.push(forwarded);
    const [only] = entries;
    return js.jsxAttribute(
      "ref",
      expression(entries.length === 1 ? only! : `[${entries.join(", ")}]`),
    );
  };
  return {
    eventAttribute(attribute, element, context) {
      // A native listener on a component falls through to its root (ADR-0118): the event prop
      // Solid's types give the element it lands on, which its spread listens with.
      if (isComponentTag(element.tag)) {
        const prop = SOLID_EVENT_PROPS.get(attribute.event) ?? eventProp(attribute.event);
        return [js.jsxAttribute(prop, expression(handler(attribute)))];
      }
      const plan = planOf(element);
      if (plan.added.includes(attribute)) {
        return plan.carrier === attribute ? [refCallback(element, context)] : [];
      }
      // The plan adds every listener but those Solid's own props carry.
      return [
        js.jsxAttribute(SOLID_EVENT_PROPS.get(attribute.event)!, expression(handler(attribute))),
      ];
    },
    refAttribute(_attribute, element, context) {
      return [refCallback(element, context)];
    },
    directiveAttribute(attribute, element, context) {
      const plan = planOf(element);
      if (plan.carrier !== attribute) return [];
      // The element's one ref is the factory's callback itself, unless a `v-model`'s helper or
      // another directive needs the element too: then one callback calls each.
      if (plan.directives.length === 1 && !modelRef(element, context) && !forwardedRef(element)) {
        const value = jsxExpression(attribute.value, context);
        return [
          js.jsxAttribute(
            "ref",
            js.jsxExpressionContainer(
              js.callExpression(js.identifier(attribute.name), [js.arrowFunction([], value)]),
            ),
          ),
        ];
      }
      return [refCallback(element, context)];
    },
    carries: (element) => planOf(element).carrier !== undefined,
    componentEvent(attribute) {
      return [js.jsxAttribute(eventProp(attribute.event), expression(handler(attribute)))];
    },
    componentRef(attribute, element, forwarded) {
      const { name } = code.component.bindings.find((binding) => binding.id === attribute.binding)!;
      if (element) {
        parameter ??= imports.claim("element");
        const own = `${code.clearedRef()}(\n(${parameter}) => {\n${name} = ${parameter};\n},\n() => {\n${name} = null;\n},\n)`;
        return [js.jsxAttribute("ref", expression(forwarded ? `[${own}, ${forwarded}]` : own))];
      }
      api ??= imports.claim("api");
      const body = `${name} = ${api};\n${code.solid("onCleanup")}(() => {\n${name} = null;\n});`;
      return [js.jsxAttribute("ref", expression(`(${api}) => {\n${body}\n}`))];
    },
    composedEventAttribute(attribute, _element, prop, passed, typed) {
      // On a `<component is>` root, Solid types the listener as each tag's, which no one
      // parameter type fits: it is checked as the consumer's, which takes the event of whichever
      // tag renders (ADR-0122).
      const handler = composedHandler(attribute, passed);
      return [
        js.jsxAttribute(
          prop,
          expression(typed ? `(${handler}) satisfies typeof ${passed}` : handler),
        ),
      ];
    },
  };

  /**
   * The handler that runs a listener's own, then the consumer's, as Vue chains them (ADR-0118).
   * An inline handler's statements come first, then the call: in a `finally` where they may
   * return early, and an async one, whose statements after an `await` run later, is called as it
   * is.
   */
  function composedHandler(attribute: EventAttribute, passed: string): string {
    const written = attribute.handler;
    const then = (event: string) => `${passed}?.(${event});`;
    switch (written.kind) {
      case "Function": {
        const { name } = code.component.bindings.find((entry) => entry.id === written.binding)!;
        const fn = code.component.setup.find(
          (item): item is FunctionItem =>
            item.kind === "Function" && item.binding === written.binding,
        )?.function;
        const event = eventName([name]);
        const argument = fn && fn.parameters.length === 0 ? "" : event;
        return `(${event}) => {\n${name}(${argument});\n${then(event)}\n}`;
      }
      case "Inline": {
        const fn = narrowings.client(written.function);
        const [first, ...others] = fn.parameters;
        const simple =
          !fn.async &&
          others.length === 0 &&
          (first === undefined || (first.name !== undefined && !first.rest && !first.default));
        const body = code.body(fn, true);
        if (simple) {
          const event = first?.name ?? eventName([body]);
          // Untyped, so Solid types it as the consumer's listener takes it, which the own
          // listener's type, Solid's or the DOM's, takes too.
          if (fn.expression) {
            return `(${event}) => {\n${statementExpression(body)};\n${then(event)}\n}`;
          }
          const statements = body.slice(1, -1).trim();
          return returnsEarly(body)
            ? `(${event}) => {\ntry {\n${statements}\n} finally {\n${then(event)}\n}\n}`
            : `(${event}) => {\n${statements}\n${then(event)}\n}`;
        }
        const own = code.client(fn, undefined, true);
        const event = eventName([own]);
        return `(${event}) => {\n(${own})(${fn.parameters.length ? event : ""});\n${then(event)}\n}`;
      }
      default:
        return unreachable(written);
    }
  }

  /** The composed handler's parameter: `event`, unless the code it holds reads that name. */
  function eventName(texts: readonly string[]): string {
    return texts.some((text) => /(?<![\w$.])event(?![\w$])/.test(text))
      ? imports.claim("event")
      : "event";
  }
}

/** An expression as a statement: one that would read as a block or a declaration is wrapped. */
function statementExpression(code: string): string {
  return /^\s*(?:\{|function\b|class\b|let\s*\[)/.test(code) ? `(${code})` : code;
}

/** Whether a block body returns before its end: a `return` outside the functions it holds. */
function returnsEarly(body: string): boolean {
  return holdsReturn(parseStatementsSource(body.slice(1, -1)).statements);
}

/** Whether part of an AST holds a `return` of its own function: not one of a function it holds. */
function holdsReturn(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(holdsReturn);
  if (!node || typeof node !== "object") return false;
  const { type } = node as { type?: unknown };
  if (type === "ReturnStatement") return true;
  if (
    type === "FunctionDeclaration" ||
    type === "FunctionExpression" ||
    type === "ArrowFunctionExpression" ||
    type === "ClassDeclaration" ||
    type === "ClassExpression"
  ) {
    return false;
  }
  return Object.entries(node).some(([key, value]) => key !== "parent" && holdsReturn(value));
}

/** Whether a tag names a component (`Field`, Solid's `Dynamic`): an element's is lower case. */
function isComponentTag(tag: string): boolean {
  return /^[A-Z]/.test(tag);
}

/**
 * The element's own listeners Solid writes as event props (`onClick`): not one its `ref` adds,
 * with an option, of an event its listeners take natively, or of one Solid's types give no prop.
 */
export function eventProps(element: ElementNode, component: UfComponent): EventAttribute[] {
  const { added } = elementPlan(element, component, nativeEvents(component));
  return element.attributes.filter(
    (attribute): attribute is EventAttribute =>
      attribute.kind === "Event" && !added.includes(attribute),
  );
}

/**
 * The delegated events a component's plain listeners listen to natively: those it also listens
 * to natively in the target or bubble phase (`once`, `passive`), which run before a delegated
 * listener would, wherever it is (ADR-0047).
 */
function nativeEvents(component: UfComponent): Set<string> {
  const native = new Set<string>();
  walk(component.render, {
    enter(node) {
      if (node.kind !== "Element") return;
      for (const attribute of node.attributes) {
        if (attribute.kind !== "Event" || !DELEGATED_EVENTS.has(attribute.event)) continue;
        if (attribute.once || attribute.passive || needsDomType(attribute, component)) {
          native.add(attribute.event);
        }
      }
    },
  });
  return native;
}

/**
 * Whether a listener's handler takes its event as the DOM types it where Solid's types say less:
 * `click`'s `PointerEvent` (lib.dom), which Solid's props type a `MouseEvent`. Such a handler
 * fails L4 as any prop's value, so its element's `ref` callback adds it, as `addEventListener`
 * types it; the component's other listeners of the event are native too (see
 * {@link nativeEvents}).
 */
function needsDomType(attribute: EventAttribute, component: UfComponent): boolean {
  const { handler } = attribute;
  let fn: FunctionCode | undefined;
  switch (handler.kind) {
    case "Inline":
      fn = handler.function;
      break;
    case "Function":
      fn = component.setup.find(
        (item): item is FunctionItem =>
          item.kind === "Function" && item.binding === handler.binding,
      )?.function;
      break;
    default:
      unreachable(handler);
  }
  const type = fn?.parameters[0]?.type?.code.trim();
  return type !== undefined && SOLID_NARROWER_TYPES.get(attribute.event) === type;
}

/** The events whose DOM interface Solid's props type as a wider one, by that DOM interface. */
const SOLID_NARROWER_TYPES: ReadonlyMap<string, string> = new Map([["click", "PointerEvent"]]);

/**
 * Which of an element's listeners its `ref` callback adds. Solid takes one prop per event, and
 * its compiler orders an element's `ref` and native listener props by their attributes, in
 * reverse: so where an element listens to one event more than once in one phase (`onClick` and
 * `onClickOnce`), the `ref` callback adds all of them, in attribute order, and they run in that
 * order (ADR-0047). Of an event's listeners, one that is alone in its phase is the prop (a bubble
 * one before a capture one), and the others are added. An event Solid's types give no element of
 * this tag (`encrypted` but on media), or a handler that takes its event as the DOM types it, can
 * only be added.
 */
function elementPlan(
  element: ElementNode,
  component: UfComponent,
  native: ReadonlySet<string>,
): ElementPlan {
  const listeners = element.attributes.filter(
    (attribute): attribute is EventAttribute => attribute.kind === "Event",
  );
  const props = new Set<EventAttribute>();
  for (const event of new Set(listeners.map((listener) => listener.event))) {
    const same = listeners.filter((listener) => listener.event === event);
    const alone = (capture: boolean) => {
      const phase = same.filter((listener) => Boolean(listener.capture) === capture);
      return phase.length === 1 ? phase[0] : undefined;
    };
    // A prop takes no option, and a native listener of a delegated event is added, so it runs in
    // the DOM's order: only a plain listener of an event Solid gives a prop is one.
    const own = [alone(false), alone(true)].find(
      (listener) =>
        listener !== undefined &&
        !options(listener) &&
        !native.has(listener.event) &&
        SOLID_EVENT_PROPS.has(listener.event) &&
        !needsDomType(listener, component),
    );
    if (own) props.add(own);
  }
  const added = listeners.filter((listener) => !props.has(listener));
  const ref = element.attributes.find(
    (attribute): attribute is RefAttribute => attribute.kind === "Ref",
  );
  const directives = element.attributes.filter(
    (attribute): attribute is DirectiveAttribute => attribute.kind === "Directive",
  );
  return {
    added,
    carrier: ref ?? added[0] ?? directives[0],
    directives,
  };
}

/** A listener's option as `addEventListener` takes it, `capture: true`, or none. */
function options(attribute: EventAttribute): string | undefined {
  if (attribute.capture) return "capture: true";
  if (attribute.once) return "once: true";
  if (attribute.passive) return "passive: true";
  return undefined;
}

/** The `never` default of an exhaustive switch: a kind added to a union fails type checking. */
function unreachable(value: never): never {
  throw new Error(`Unexpected IR value: ${JSON.stringify(value)}`);
}
