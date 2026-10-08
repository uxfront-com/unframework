// Listeners and template refs as Solid writes them (ADR-0047, ADR-0049).
//
// - A listener is Solid's event prop, by solid-js 1.9's own spelling (`onClick`, `onKeyDown`,
//   `onDblClick`): Solid delegates the events it lists to the document and listens natively to
//   the others (`focus`, `blur`, `change`, `submit`, `wheel`), which keeps the DOM's semantics
//   (`event-semantics`, native). A listener with an option is a native listener with its options,
//   `on:click={{ handleEvent, capture: true }}` (`event-capture`, `event-once` and
//   `event-passive`, native). A delegated listener runs when the event reaches the document,
//   after every native one: where the component also listens to a delegated event natively
//   after its target (`once`, `passive`), its other listeners of that event are native too,
//   `on:click={save}`, so they all run in the DOM's order and `stopPropagation()` stops them
//   alike (ADR-0047). A capture listener needs no such care: it runs before the event reaches its
//   target in any case.
// - Solid takes one listener of an event on an element (`solid/jsx-no-duplicate-props` counts
//   `onClick`, `on:click` and `oncapture:click` as one prop): the element's others of that
//   event (`onClickCapture` beside `onClick`) are added from its `ref` callback, with their
//   options, as `addEventListener` takes them, and so are all its listeners of one event and
//   phase where it has more than one (`onClick` and `onClickOnce`), in attribute order, so they
//   run in that order (ADR-0047). So is one of an event Solid's types give no prop on that
//   element (`encrypted` but on `<audio>` and `<video>`).
// - A template ref is a `let` the element's `ref` callback sets, and clears when the element is
//   removed (`onCleanup` in the callback runs when its branch is disposed): empty again, as the
//   other targets' refs are (ADR-0049).
import { js } from "@unframework/codegen";
import type { ImportSet, JsxContext, Placeholders } from "@unframework/codegen";
import type {
  ElementNode,
  EventAttribute,
  FunctionCode,
  FunctionItem,
  RefAttribute,
  UfComponent,
} from "@unframework/ir";
import { walk } from "@unframework/ir";

import type { Narrowings } from "./narrowing.ts";
import type { SolidCode } from "./setup.ts";

type JsxAttributeItem = ReturnType<typeof js.jsxAttribute>;

/**
 * Solid's event prop for each DOM event the IR's vocabulary holds (`DOM_EVENTS`), as solid-js
 * 1.9.15's types spell it (`CustomEventHandlersCamelCase` in `solid-js/types/jsx.d.ts`): Solid
 * reads the event's name in lower case, so only the types care how it is spelled. `encrypted`
 * has none: its listener is `on:encrypted`. Pinned by test/listeners.test.ts.
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
 * The events Solid's compiler delegates to the document (babel-plugin-jsx-dom-expressions
 * 0.40's `DelegatedEvents`): a listener of one runs when the event reaches the document. Pinned
 * by test/listeners.test.ts.
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
  /** The attribute the `ref` callback prints at: the template ref, or the first added listener. */
  carrier: RefAttribute | EventAttribute | undefined;
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
}

/** Listeners and template refs as Solid writes them (see the module comment). */
export function solidListeners(
  code: SolidCode,
  imports: ImportSet,
  placeholders: Placeholders,
  narrowings: Narrowings,
): SolidListeners {
  const native = nativeEvents(code.component);
  const plans = new WeakMap<ElementNode, ElementPlan>();
  const planOf = (element: ElementNode): ElementPlan => {
    let plan = plans.get(element);
    if (!plan) {
      plan = elementPlan(element, code.component);
      plans.set(element, plan);
    }
    return plan;
  };
  let parameter: string | undefined;
  /**
   * A listener's handler. `tracked` where `solid/reactivity` reads it as a handler (an `on…`
   * prop's value, `addEventListener`'s argument), not where it is an options object's
   * `handleEvent`, so an arrow it hands to a function needs no `untrack` (src/untracked.ts).
   */
  const handler = ({ handler: written }: EventAttribute, tracked = true): string => {
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
  /** The `ref` callback of an element: its template ref set and cleared, its added listeners. */
  const refCallback = (element: ElementNode): JsxAttributeItem => {
    parameter ??= imports.claim("element");
    const statements: string[] = [];
    const ref = element.attributes.find((attribute) => attribute.kind === "Ref");
    if (ref) {
      const { name } = code.component.bindings.find((binding) => binding.id === ref.binding)!;
      statements.push(
        `${name} = ${parameter};`,
        `${code.solid("onCleanup")}(() => {\n${name} = null;\n});`,
      );
    }
    for (const added of planOf(element).added) {
      const option = options(added);
      statements.push(
        `${parameter}.addEventListener(${JSON.stringify(added.event)}, ${handler(added)}${option ? `, { ${option} }` : ""});`,
      );
    }
    const [only] = statements;
    const body =
      statements.length === 1 && !ref ? only!.slice(0, -1) : `{\n${statements.join("\n")}\n}`;
    return js.jsxAttribute("ref", expression(`(${parameter}) => ${body}`));
  };
  return {
    eventAttribute(attribute, element) {
      const plan = planOf(element);
      if (plan.added.includes(attribute)) {
        return plan.carrier === attribute ? [refCallback(element)] : [];
      }
      const option = options(attribute);
      if (option) {
        return [
          js.jsxAttribute(
            `on:${attribute.event}`,
            expression(`{ handleEvent: ${handler(attribute, false)}, ${option} }`),
          ),
        ];
      }
      const prop = SOLID_EVENT_PROPS.get(attribute.event);
      const name = prop && !native.has(attribute.event) ? prop : `on:${attribute.event}`;
      return [js.jsxAttribute(name, expression(handler(attribute)))];
    },
    refAttribute(_attribute, element) {
      return [refCallback(element)];
    },
  };
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
function elementPlan(element: ElementNode, component: UfComponent): ElementPlan {
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
    const own = [alone(false), alone(true)].find(
      (listener) =>
        listener !== undefined &&
        typedOn(listener.event, element.tag) &&
        !needsDomType(listener, component),
    );
    if (own) props.add(own);
  }
  const added = listeners.filter((listener) => !props.has(listener));
  const ref = element.attributes.find(
    (attribute): attribute is RefAttribute => attribute.kind === "Ref",
  );
  return { added, carrier: ref ?? added[0] };
}

/** The elements whose type in Solid's JSX takes `encrypted` (`MediaHTMLAttributes`). */
const MEDIA_ELEMENTS: ReadonlySet<string> = new Set(["audio", "video"]);

/**
 * Whether Solid's types give an element of a tag a prop for an event: every event of
 * {@link SOLID_EVENT_PROPS} on every element, and `encrypted` (`on:encrypted`) on media ones.
 */
function typedOn(event: string, tag: string): boolean {
  return SOLID_EVENT_PROPS.has(event) || (event === "encrypted" && MEDIA_ELEMENTS.has(tag));
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
