// React's spelling of the DOM's events (ADR-0047): a total table over the IR's vocabulary
// (`DOM_EVENTS`), and the rule that decides where React's synthetic event keeps the DOM's
// semantics and where the output listens natively. React dispatches most events from one root
// listener with its own synthetic event; where that differs from the DOM (a `change` on a text
// field fires per keystroke, `focusin` is React's `onFocus`, its root `wheel` and touch listeners
// are passive, it has no prop for some events), the output listens natively through a ref
// callback (`listen`), and every listener of that event in the component does too, so their
// order stays the DOM's. `test/events.test.ts` pins the table against react-dom's registrations
// and @types/react's props.
import { EVENT_INTERFACES, isVoidElement } from "@unframework/ir";
import type { ElementNode, EventAttribute } from "@unframework/ir";

/** How React declares an event's listener prop, where it has one that keeps the DOM's semantics. */
export interface ReactEventProp {
  /** The prop for the bubble phase: `onClick`, `onDoubleClick`, `onKeyDown`. */
  prop: string;
  /** Whether @types/react declares a capture-phase prop (`onClickCapture`). */
  capture: boolean;
  /** The element the prop is declared on, when only one has it (`<dialog>`'s `onCancel`). */
  element?: string;
}

/**
 * Each DOM event's React prop, from react-dom 19.3's registrations (`simpleEventPluginEvents`
 * and `registerSimpleEvent`) as @types/react 19.3 declares them; `null` where the output listens
 * natively whatever the element: React has no prop for the event (`animationcancel`, `command`,
 * `formdata`, `securitypolicyviolation`, the fullscreen events, which react-dom registers but
 * @types/react does not declare), or its prop is another event (`onFocus` is `focusin`,
 * `onSelect` and `onBeforeInput` are synthesised from several, `focusin` and `focusout` have
 * none of their own).
 */
export const REACT_EVENTS: ReadonlyMap<string, ReactEventProp | null> = new Map(
  Object.entries({
    abort: prop("onAbort"),
    animationcancel: null,
    animationend: prop("onAnimationEnd"),
    animationiteration: prop("onAnimationIteration"),
    animationstart: prop("onAnimationStart"),
    auxclick: prop("onAuxClick"),
    beforeinput: null,
    beforetoggle: prop("onBeforeToggle", false),
    blur: prop("onBlur"),
    cancel: prop("onCancel", false, "dialog"),
    canplay: prop("onCanPlay"),
    canplaythrough: prop("onCanPlayThrough"),
    change: prop("onChange"),
    click: prop("onClick"),
    close: prop("onClose", false, "dialog"),
    command: null,
    compositionend: prop("onCompositionEnd"),
    compositionstart: prop("onCompositionStart"),
    compositionupdate: prop("onCompositionUpdate"),
    contextmenu: prop("onContextMenu"),
    copy: prop("onCopy"),
    cut: prop("onCut"),
    dblclick: prop("onDoubleClick"),
    drag: prop("onDrag"),
    dragend: prop("onDragEnd"),
    dragenter: prop("onDragEnter"),
    dragleave: prop("onDragLeave"),
    dragover: prop("onDragOver"),
    dragstart: prop("onDragStart"),
    drop: prop("onDrop"),
    durationchange: prop("onDurationChange"),
    emptied: prop("onEmptied"),
    encrypted: prop("onEncrypted"),
    ended: prop("onEnded"),
    error: prop("onError"),
    focus: prop("onFocus"),
    focusin: null,
    focusout: null,
    formdata: null,
    fullscreenchange: null,
    fullscreenerror: null,
    gotpointercapture: prop("onGotPointerCapture"),
    input: prop("onInput"),
    invalid: prop("onInvalid"),
    keydown: prop("onKeyDown"),
    keypress: prop("onKeyPress"),
    keyup: prop("onKeyUp"),
    load: prop("onLoad"),
    loadeddata: prop("onLoadedData"),
    loadedmetadata: prop("onLoadedMetadata"),
    loadstart: prop("onLoadStart"),
    lostpointercapture: prop("onLostPointerCapture"),
    mousedown: prop("onMouseDown"),
    mouseenter: prop("onMouseEnter", false),
    mouseleave: prop("onMouseLeave", false),
    mousemove: prop("onMouseMove"),
    mouseout: prop("onMouseOut"),
    mouseover: prop("onMouseOver"),
    mouseup: prop("onMouseUp"),
    paste: prop("onPaste"),
    pause: prop("onPause"),
    play: prop("onPlay"),
    playing: prop("onPlaying"),
    pointercancel: prop("onPointerCancel"),
    pointerdown: prop("onPointerDown"),
    pointerenter: prop("onPointerEnter", false),
    pointerleave: prop("onPointerLeave", false),
    pointermove: prop("onPointerMove"),
    pointerout: prop("onPointerOut"),
    pointerover: prop("onPointerOver"),
    pointerup: prop("onPointerUp"),
    progress: prop("onProgress"),
    ratechange: prop("onRateChange"),
    reset: prop("onReset"),
    scroll: prop("onScroll"),
    scrollend: prop("onScrollEnd"),
    securitypolicyviolation: null,
    seeked: prop("onSeeked"),
    seeking: prop("onSeeking"),
    select: null,
    stalled: prop("onStalled"),
    submit: prop("onSubmit"),
    suspend: prop("onSuspend"),
    timeupdate: prop("onTimeUpdate"),
    toggle: prop("onToggle", false),
    touchcancel: prop("onTouchCancel"),
    touchend: prop("onTouchEnd"),
    touchmove: prop("onTouchMove"),
    touchstart: prop("onTouchStart"),
    transitioncancel: prop("onTransitionCancel"),
    transitionend: prop("onTransitionEnd"),
    transitionrun: prop("onTransitionRun"),
    transitionstart: prop("onTransitionStart"),
    volumechange: prop("onVolumeChange"),
    waiting: prop("onWaiting"),
    wheel: prop("onWheel"),
  }),
);

function prop(name: string, capture = true, element?: string): ReactEventProp {
  return element ? { prop: name, capture, element } : { prop: name, capture };
}

/**
 * The events whose root listeners react-dom registers passive (`wheel`, `touchstart`,
 * `touchmove`): a passive listener of one is React's prop, and any other listens natively, where
 * `preventDefault()` works.
 */
const ROOT_PASSIVE = new Set(["wheel", "touchstart", "touchmove"]);

/**
 * The DOM events that do not bubble, which React's prop still runs for when a descendant is
 * their target (`focus` through `focusin`; `load`, `error`, `invalid`, `toggle` and the media
 * events through react-dom's walk up from the element that listened): a bubble-phase listener of
 * one tests that its element is the target, as the DOM's listener only runs then. React keeps
 * `mouseenter`, `mouseleave`, `pointerenter`, `pointerleave` and `scroll` to their target itself.
 */
const NON_BUBBLING = new Set([
  "abort",
  "beforetoggle",
  "blur",
  "cancel",
  "canplay",
  "canplaythrough",
  "close",
  "durationchange",
  "emptied",
  "encrypted",
  "ended",
  "error",
  "focus",
  "invalid",
  "load",
  "loadeddata",
  "loadedmetadata",
  "loadstart",
  "pause",
  "play",
  "playing",
  "progress",
  "ratechange",
  "scrollend",
  "seeked",
  "seeking",
  "stalled",
  "suspend",
  "timeupdate",
  "toggle",
  "volumechange",
  "waiting",
]);

/** Elements whose descendants are never the target of a non-bubbling event a listener hears. */
const CHILDLESS_TARGETS = new Set(["input", "select", "textarea", "option"]);

/**
 * Whether React's prop keeps the DOM's semantics for this listener, on this element: it has a
 * prop for the event and phase (`<dialog>` only, for `cancel` and `close`); `change` only on a
 * `<select>` and a file input, where React fires `onChange` from the DOM's `change` (on a text
 * field it fires per keystroke, on a checkbox or a radio from the `click`, before `input` and
 * even when the click is prevented, and on any other element for a descendant's); a passive
 * listener only of a root-passive event, and a non-passive one only of any other.
 */
export function synthetic(listener: EventAttribute, element: ElementNode): boolean {
  const entry = REACT_EVENTS.get(listener.event);
  if (!entry) return false;
  if (entry.element && entry.element !== element.tag) return false;
  if (listener.capture && !entry.capture) return false;
  if (ROOT_PASSIVE.has(listener.event) !== Boolean(listener.passive)) return false;
  if (listener.event === "change") return changeCommits(element);
  return true;
}

/** Whether React's `onChange` fires on this element from the DOM's `change`, and only then. */
function changeCommits(element: ElementNode): boolean {
  if (element.tag === "select") return true;
  if (element.tag !== "input") return false;
  const type = element.attributes.find(
    (attribute) => attribute.kind === "Static" && attribute.name === "type",
  );
  return (
    type?.kind === "Static" && typeof type.value === "string" && type.value.toLowerCase() === "file"
  );
}

/**
 * Whether a synthetic bubble-phase listener tests that its element is the event's target: the
 * event does not bubble in the DOM, and the element may have a descendant that is its target.
 */
export function targetGuarded(listener: EventAttribute, element: ElementNode): boolean {
  return (
    !listener.capture &&
    NON_BUBBLING.has(listener.event) &&
    !isVoidElement(element.tag) &&
    !CHILDLESS_TARGETS.has(element.tag)
  );
}

/** A synthetic listener's prop: `onKeyDown`, `onClickCapture`. */
export function reactProp(listener: EventAttribute): string {
  const entry = REACT_EVENTS.get(listener.event);
  if (!entry) throw new Error(`React has no prop for the \`${listener.event}\` event.`);
  return listener.capture ? `${entry.prop}Capture` : entry.prop;
}

/**
 * The synthetic event types @types/react declares, by the DOM interface of the same name
 * (`Event` is React's `SyntheticEvent`). A handler's parameter annotated with a DOM interface is
 * annotated with React's where React hands it a synthetic event: the DOM's fails L4 (TS2322).
 */
const REACT_EVENT_TYPES: ReadonlyMap<string, string> = new Map([
  ["Event", "SyntheticEvent"],
  ["UIEvent", "UIEvent"],
  ["MouseEvent", "MouseEvent"],
  ["PointerEvent", "PointerEvent"],
  ["DragEvent", "DragEvent"],
  ["WheelEvent", "WheelEvent"],
  ["KeyboardEvent", "KeyboardEvent"],
  ["FocusEvent", "FocusEvent"],
  ["InputEvent", "InputEvent"],
  ["CompositionEvent", "CompositionEvent"],
  ["TouchEvent", "TouchEvent"],
  ["AnimationEvent", "AnimationEvent"],
  ["TransitionEvent", "TransitionEvent"],
  ["ClipboardEvent", "ClipboardEvent"],
  ["SubmitEvent", "SubmitEvent"],
  ["ToggleEvent", "ToggleEvent"],
]);

/**
 * React's synthetic event type for a DOM interface: the one of the same name, or that of the
 * nearest interface it extends that React has (`ErrorEvent` → `SyntheticEvent`).
 */
export function reactEventType(domInterface: string): string {
  for (let current: string | null | undefined = domInterface; current;) {
    const type = REACT_EVENT_TYPES.get(current);
    if (type) return type;
    current = EVENT_INTERFACES.get(current);
  }
  return "SyntheticEvent";
}
