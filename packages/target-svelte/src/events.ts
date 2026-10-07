// Listeners in Svelte 5 (ADR-0047): an `on<event>` attribute, `on<event>capture` in the
// capture phase, and, where Svelte has no attribute, an attachment that listens with `on` from
// `svelte/events`, which takes `addEventListener`'s options and keeps the order of the listeners
// Svelte delegates (its wrapper runs them first, then its own handler unless one stopped the
// propagation). Svelte's handler types are its own (`svelte/elements`): `oninput` hands a
// handler an `Event`, where lib.dom dispatches an `InputEvent`, so a handler's parameter is
// annotated with what Svelte gives it.
import { DOM_EVENTS, extendsEventInterface, EVENT_INTERFACES } from "@unframework/ir";
import type { ElementNode, EventAttribute } from "@unframework/ir";

/**
 * The interface Svelte's element types (`svelte/elements`, 5.57) hand each event's attribute
 * handler, for every event of `DOM_EVENTS`; `undefined` where they declare no attribute for it
 * (`onanimationcancel`, `oncommand`, `onsecuritypolicyviolation`), which svelte-check would reject
 * (L4). test/events.test.ts reads them back from `svelte/elements`.
 */
export const SVELTE_EVENT_INTERFACES: ReadonlyMap<string, string | undefined> = new Map(
  Object.entries({
    abort: "Event",
    animationcancel: undefined,
    animationend: "AnimationEvent",
    animationiteration: "AnimationEvent",
    animationstart: "AnimationEvent",
    auxclick: "MouseEvent",
    beforeinput: "InputEvent",
    beforetoggle: "ToggleEvent",
    blur: "FocusEvent",
    cancel: "Event",
    canplay: "Event",
    canplaythrough: "Event",
    change: "Event",
    click: "MouseEvent",
    close: "Event",
    command: undefined,
    compositionend: "CompositionEvent",
    compositionstart: "CompositionEvent",
    compositionupdate: "CompositionEvent",
    contextmenu: "MouseEvent",
    copy: "ClipboardEvent",
    cut: "ClipboardEvent",
    dblclick: "MouseEvent",
    drag: "DragEvent",
    dragend: "DragEvent",
    dragenter: "DragEvent",
    dragleave: "DragEvent",
    dragover: "DragEvent",
    dragstart: "DragEvent",
    drop: "DragEvent",
    durationchange: "Event",
    emptied: "Event",
    encrypted: "Event",
    ended: "Event",
    error: "Event",
    focus: "FocusEvent",
    focusin: "FocusEvent",
    focusout: "FocusEvent",
    formdata: "FormDataEvent",
    fullscreenchange: "Event",
    fullscreenerror: "Event",
    gotpointercapture: "PointerEvent",
    input: "Event",
    invalid: "Event",
    keydown: "KeyboardEvent",
    keypress: "KeyboardEvent",
    keyup: "KeyboardEvent",
    load: "Event",
    loadeddata: "Event",
    loadedmetadata: "Event",
    loadstart: "Event",
    lostpointercapture: "PointerEvent",
    mousedown: "MouseEvent",
    mouseenter: "MouseEvent",
    mouseleave: "MouseEvent",
    mousemove: "MouseEvent",
    mouseout: "MouseEvent",
    mouseover: "MouseEvent",
    mouseup: "MouseEvent",
    paste: "ClipboardEvent",
    pause: "Event",
    play: "Event",
    playing: "Event",
    pointercancel: "PointerEvent",
    pointerdown: "PointerEvent",
    pointerenter: "PointerEvent",
    pointerleave: "PointerEvent",
    pointermove: "PointerEvent",
    pointerout: "PointerEvent",
    pointerover: "PointerEvent",
    pointerup: "PointerEvent",
    progress: "Event",
    ratechange: "Event",
    reset: "Event",
    scroll: "UIEvent",
    scrollend: "UIEvent",
    securitypolicyviolation: undefined,
    seeked: "Event",
    seeking: "Event",
    select: "Event",
    stalled: "Event",
    submit: "SubmitEvent",
    suspend: "Event",
    timeupdate: "Event",
    toggle: "ToggleEvent",
    touchcancel: "TouchEvent",
    touchend: "TouchEvent",
    touchmove: "TouchEvent",
    touchstart: "TouchEvent",
    transitioncancel: "TransitionEvent",
    transitionend: "TransitionEvent",
    transitionrun: "TransitionEvent",
    transitionstart: "TransitionEvent",
    volumechange: "Event",
    waiting: "Event",
    wheel: "WheelEvent",
  }),
);

/**
 * Events Svelte's attribute listens to passively, though the DOM's `addEventListener` does not
 * on an element (Svelte's `PASSIVE_EVENTS`, 5.57): a listener of one that the source does not
 * mark passive listens through `on`, so `preventDefault()` keeps working (ADR-0047's DOM
 * semantics).
 */
const SVELTE_PASSIVE_EVENTS: ReadonlySet<string> = new Set(["touchstart", "touchmove"]);

/**
 * Whether a listener is written as an attachment, `{@attach (node) => on(node, …)}`, rather than
 * as an attribute: one with the `once` or `passive` option, which Svelte's attributes do not
 * take; one of an event Svelte types no attribute for; one Svelte's attribute would make passive;
 * and every bubbling listener of an event that another listener of the same element listens to
 * through `on`, so the two run in the order the source writes them.
 */
export function isAttached(attribute: EventAttribute, element: ElementNode): boolean {
  if (needsAttachment(attribute)) return true;
  if (attribute.capture) return false;
  return element.attributes.some(
    (other) =>
      other !== attribute &&
      other.kind === "Event" &&
      other.event === attribute.event &&
      !other.capture &&
      needsAttachment(other),
  );
}

function needsAttachment(attribute: EventAttribute): boolean {
  return (
    attribute.once === true ||
    attribute.passive === true ||
    SVELTE_EVENT_INTERFACES.get(attribute.event) === undefined ||
    (SVELTE_PASSIVE_EVENTS.has(attribute.event) && !attribute.capture)
  );
}

/**
 * The interface a handler of a listener receives in the Svelte output: Svelte's attribute type
 * for an attribute, and lib.dom's (`HTMLElementEventMap`, which `on` reads) for an attachment.
 */
export function handlerInterface(attribute: EventAttribute, element: ElementNode): string {
  const dom = DOM_EVENTS.get(attribute.event) ?? "Event";
  if (isAttached(attribute, element)) return dom;
  return SVELTE_EVENT_INTERFACES.get(attribute.event) ?? dom;
}

/**
 * The nearest interface every one of `names` extends (`Event` at the latest): the type a
 * handler's parameter must accept to take each of them.
 */
export function commonInterface(names: Iterable<string>): string {
  let common: string | undefined;
  for (const name of names) {
    if (common === undefined) common = name;
    else {
      while (common !== "Event" && !extendsEventInterface(name, common)) {
        common = EVENT_INTERFACES.get(common) ?? "Event";
      }
    }
  }
  return common ?? "Event";
}
