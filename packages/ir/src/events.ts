// The DOM event vocabulary (ADR-0047): the events an element listener may take, the interface
// each is dispatched with, and the members of those interfaces every target's event object
// carries. The analyser reports a listener or a member outside them (UF3006, UF3032), and
// `checkInvariants` rejects one in any IR; each target maps the names by a total table over
// `DOM_EVENTS` (P6).
//
// Sources: TypeScript 7.0.2's `lib.dom.d.ts` (`GlobalEventHandlersEventMap`, `ElementEventMap`,
// `HTMLMediaElementEventMap`, `WindowEventHandlersEventMap` and the interfaces), the authoring
// types (`@vue/runtime-dom`'s JSX `Events`, vendored in `packages/unframework`), and react-dom
// 19.3.0's synthetic events (`*EventInterface` and `extractEvents` in
// `cjs/react-dom-client.development.js`) with @types/react 19.3.0's declarations of them.

import { table, words } from "./tables.ts";

/**
 * The events an element listener may take (`onClick` → `click`), each with the interface lib.dom
 * dispatches it with. They are the element events lib.dom knows (its `GlobalEventHandlersEventMap`,
 * with `fullscreenchange` and `fullscreenerror` from `ElementEventMap` and `encrypted` from
 * `HTMLMediaElementEventMap`) that the authoring types declare, with `cancel`, `close` and
 * `command`, which a `<dialog>` needs and the package types itself. Window-only events are apart
 * ({@link WINDOW_EVENTS}), and so are the element events no target can listen to alike
 * ({@link UNSUPPORTED_EVENTS}).
 */
export const DOM_EVENTS: ReadonlyMap<string, string> = table({
  abort: "UIEvent",
  animationcancel: "AnimationEvent",
  animationend: "AnimationEvent",
  animationiteration: "AnimationEvent",
  animationstart: "AnimationEvent",
  auxclick: "PointerEvent",
  beforeinput: "InputEvent",
  beforetoggle: "ToggleEvent",
  blur: "FocusEvent",
  cancel: "Event",
  canplay: "Event",
  canplaythrough: "Event",
  change: "Event",
  click: "PointerEvent",
  close: "Event",
  command: "Event",
  compositionend: "CompositionEvent",
  compositionstart: "CompositionEvent",
  compositionupdate: "CompositionEvent",
  contextmenu: "PointerEvent",
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
  encrypted: "MediaEncryptedEvent",
  ended: "Event",
  error: "ErrorEvent",
  focus: "FocusEvent",
  focusin: "FocusEvent",
  focusout: "FocusEvent",
  formdata: "FormDataEvent",
  fullscreenchange: "Event",
  fullscreenerror: "Event",
  gotpointercapture: "PointerEvent",
  input: "InputEvent",
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
  progress: "ProgressEvent",
  ratechange: "Event",
  reset: "Event",
  scroll: "Event",
  scrollend: "Event",
  securitypolicyviolation: "SecurityPolicyViolationEvent",
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
});

/**
 * The events only the window receives (lib.dom's `WindowEventHandlersEventMap`): HTML lets
 * `<body>` name them, but a listener on any element of a component never runs (UF3006).
 */
export const WINDOW_EVENTS: ReadonlyMap<string, string> = table({
  afterprint: "Event",
  beforeprint: "Event",
  beforeunload: "BeforeUnloadEvent",
  gamepadconnected: "GamepadEvent",
  gamepaddisconnected: "GamepadEvent",
  hashchange: "HashChangeEvent",
  languagechange: "Event",
  message: "MessageEvent",
  messageerror: "MessageEvent",
  offline: "Event",
  online: "Event",
  pagehide: "PageTransitionEvent",
  pagereveal: "PageRevealEvent",
  pageshow: "PageTransitionEvent",
  pageswap: "PageSwapEvent",
  popstate: "PopStateEvent",
  rejectionhandled: "PromiseRejectionEvent",
  storage: "StorageEvent",
  unhandledrejection: "PromiseRejectionEvent",
  unload: "Event",
});

/**
 * Element events HTML or lib.dom knows that are not in the vocabulary, and why: the analyser
 * reads `onX` as an event by them too, so it reports such a listener as an unsupported event
 * (UF3006) rather than as an unknown attribute.
 */
export const UNSUPPORTED_EVENTS: ReadonlyMap<string, string> = table({
  beforematch:
    "the authoring types (Vue's JSX types) do not declare it, and it fires only on content hidden `until-found`",
  contextlost: "the authoring types do not declare it: it fires on a `<canvas>` losing its context",
  contextrestored:
    "the authoring types do not declare it: it fires on a `<canvas>` getting its context back",
  cuechange: "the authoring types do not declare it: it fires on a `<track>`",
  dragexit: "no browser fires it any more: HTML removed it",
  pointerrawupdate: "the authoring types do not declare it, and only secure contexts fire it",
  resize:
    "only the window and media elements receive it, and the authoring types do not declare it",
  selectionchange:
    "the document receives it, and text controls only in some browsers; the authoring types do not declare it",
  selectstart: "the authoring types do not declare it",
  slotchange: "it fires on a `<slot>`, which a component does not render",
});

/**
 * The events a listener may be passive on (`onWheelPassive`): the ones a passive listener makes
 * cheaper, as scrolling need not wait for it. React registers its root listeners for them
 * passive, so a non-passive one is a native listener there (ADR-0047); on any other event
 * `passive` changes nothing a component can observe, so it is not written (UF3006).
 */
export const PASSIVE_EVENTS: ReadonlySet<string> = words("wheel touchstart touchmove");

/**
 * The interfaces {@link DOM_EVENTS} dispatches with, each with the interface it extends in
 * lib.dom; `Event` extends none. A handler's parameter may be annotated with the event's own
 * interface or one it extends (`MouseEvent` for a `click`, whose interface is `PointerEvent`).
 */
export const EVENT_INTERFACES: ReadonlyMap<string, string | null> = table<string | null>({
  Event: null,
  UIEvent: "Event",
  MouseEvent: "UIEvent",
  PointerEvent: "MouseEvent",
  DragEvent: "MouseEvent",
  WheelEvent: "MouseEvent",
  KeyboardEvent: "UIEvent",
  FocusEvent: "UIEvent",
  InputEvent: "UIEvent",
  CompositionEvent: "UIEvent",
  TouchEvent: "UIEvent",
  AnimationEvent: "Event",
  TransitionEvent: "Event",
  ClipboardEvent: "Event",
  SubmitEvent: "Event",
  ToggleEvent: "Event",
  ErrorEvent: "Event",
  ProgressEvent: "Event",
  FormDataEvent: "Event",
  SecurityPolicyViolationEvent: "Event",
  MediaEncryptedEvent: "Event",
});

/** Whether an event interface is `ancestor` or extends it (`PointerEvent` extends `MouseEvent`). */
export function extendsEventInterface(name: string, ancestor: string): boolean {
  for (let current: string | null | undefined = name; current;) {
    if (current === ancestor) return true;
    current = EVENT_INTERFACES.get(current);
  }
  return false;
}

/** The members both the DOM's `Event` and every React synthetic event carry. */
const EVENT_MEMBERS = `
  bubbles cancelable currentTarget defaultPrevented isTrusted preventDefault stopPropagation target
  timeStamp type
`;
const UI_EVENT_MEMBERS = `${EVENT_MEMBERS} detail`;
const MOUSE_EVENT_MEMBERS = `
  ${UI_EVENT_MEMBERS} altKey button buttons clientX clientY ctrlKey getModifierState metaKey
  movementX movementY pageX pageY relatedTarget screenX screenY shiftKey
`;

/**
 * The members of each event interface a handler may read or call (UF3032): those the DOM
 * interface has (with what it extends) that React's synthetic event of that interface also
 * carries, at run time (react-dom 19.3.0's `*EventInterface`) and in its types (@types/react
 * 19.3.0), since React hands a handler its synthetic event. Left out: what React does not copy
 * (`composedPath`, `stopImmediatePropagation`, `isComposing`, `offsetX`, `inputType`, …), what
 * it declares with another type (`view`, an `AbstractView`), what it copies only once at its
 * root listener (`eventPhase`), what its types lack (`detail` on a focus event, `source` on a
 * toggle, `getModifierState` on a touch, which the DOM lacks too) and what is deprecated
 * (`keyCode`, `charCode`, `which`). An interface React has no synthetic event of (`FormDataEvent`)
 * has the DOM's own members: React listens to its events natively (ADR-0047).
 *
 * What a handler of one event may use is the set of its {@link PORTABLE_EVENT_INTERFACES} entry,
 * which can hold less than its annotation's (a `click` handler annotated `PointerEvent` still
 * gets React's mouse event).
 */
export const PORTABLE_EVENT_MEMBERS: ReadonlyMap<string, ReadonlySet<string>> = new Map(
  Object.entries({
    Event: EVENT_MEMBERS,
    UIEvent: UI_EVENT_MEMBERS,
    MouseEvent: MOUSE_EVENT_MEMBERS,
    PointerEvent: `${MOUSE_EVENT_MEMBERS} height isPrimary pointerId pointerType pressure tangentialPressure tiltX tiltY twist width`,
    DragEvent: `${MOUSE_EVENT_MEMBERS} dataTransfer`,
    WheelEvent: `${MOUSE_EVENT_MEMBERS} deltaMode deltaX deltaY deltaZ`,
    KeyboardEvent: `${UI_EVENT_MEMBERS} altKey code ctrlKey getModifierState key location metaKey repeat shiftKey`,
    FocusEvent: `${EVENT_MEMBERS} relatedTarget`,
    InputEvent: `${EVENT_MEMBERS} data`,
    CompositionEvent: `${EVENT_MEMBERS} data`,
    TouchEvent: `${UI_EVENT_MEMBERS} altKey changedTouches ctrlKey metaKey shiftKey targetTouches touches`,
    AnimationEvent: `${EVENT_MEMBERS} animationName elapsedTime pseudoElement`,
    TransitionEvent: `${EVENT_MEMBERS} elapsedTime propertyName pseudoElement`,
    ClipboardEvent: `${EVENT_MEMBERS} clipboardData`,
    SubmitEvent: `${EVENT_MEMBERS} submitter`,
    ToggleEvent: `${EVENT_MEMBERS} newState oldState`,
    ErrorEvent: `${EVENT_MEMBERS} colno error filename lineno message`,
    ProgressEvent: `${EVENT_MEMBERS} lengthComputable loaded total`,
    FormDataEvent: `${EVENT_MEMBERS} formData`,
    SecurityPolicyViolationEvent: `${EVENT_MEMBERS} blockedURI columnNumber disposition documentURI effectiveDirective lineNumber originalPolicy referrer sample sourceFile statusCode violatedDirective`,
    MediaEncryptedEvent: `${EVENT_MEMBERS} initData initDataType`,
  }).map(([name, members]) => [name, words(members)]),
);

/** The members of {@link PORTABLE_EVENT_MEMBERS} that are methods: a handler only calls them. */
export const EVENT_METHODS: ReadonlySet<string> = words(
  "preventDefault stopPropagation getModifierState",
);

/**
 * The events React dispatches as a synthetic event of an interface their DOM interface extends:
 * a mouse event for `click`, `auxclick` and `contextmenu` (`PointerEvent`s in the DOM), and a plain
 * one for `input`, `change`, `scroll`, the media events and `transitionrun` (`extractEvents`).
 * `beforeinput`'s synthetic event holds `data` alone, which its `InputEvent` entry reflects.
 */
const PORTABLE_OVERRIDES: ReadonlyMap<string, string> = new Map([
  ...[
    ...words(`
      abort cancel canplay canplaythrough change close durationchange emptied encrypted ended error
      fullscreenchange fullscreenerror input invalid load loadeddata loadedmetadata loadstart pause
      play playing progress ratechange reset scroll scrollend seeked seeking select stalled suspend
      timeupdate transitioncancel transitionrun transitionstart volumechange waiting
    `),
  ].map((event) => [event, "Event"] as const),
  ...[...words("auxclick click contextmenu")].map((event) => [event, "MouseEvent"] as const),
]);

/**
 * For each event of {@link DOM_EVENTS}, the interface whose {@link PORTABLE_EVENT_MEMBERS} its
 * handlers may use: the nearest interface both its DOM interface and the synthetic event React
 * dispatches it as extend. An event React has no prop for (`animationcancel`, `command`,
 * `formdata`, `securitypolicyviolation`) keeps its DOM interface: React listens to it natively.
 */
export const PORTABLE_EVENT_INTERFACES: ReadonlyMap<string, string> = new Map(
  [...DOM_EVENTS].map(([event, dom]) => [event, PORTABLE_OVERRIDES.get(event) ?? dom]),
);
