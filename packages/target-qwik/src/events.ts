// The names of Qwik's listener and event props (ADR-0047, P6). Qwik's JSX types name a DOM
// event's listener `on` + its name in PascalCase + `$` (`onClick$`), with the capitals of the
// multi-word events it lists (`onKeyDown$`, `onDblClick$`); any other spelling still runs, since
// the runtime lower-cases it, but types the event as a plain `Event` (`onKeydown$` has no `key`,
// TS2339). A component's events are QRL props named the same way (`onChange$`), which a parent's
// `onChange$={…}` sets (ADR-0012).
import { DOM_EVENTS } from "@unframework/ir";

/**
 * The multi-word event names Qwik's JSX types capitalise (`PascalCaseNames` in
 * `@qwik.dev/core`'s `core-internal.d.ts`, 2.0.0-beta.47), by their DOM name. Every other event
 * takes a capital first letter only (`onScrollend$`, `onBeforeinput$`), as Qwik's
 * `Capitalize<T>` does.
 */
const QWIK_PASCAL_CASE_NAMES: readonly string[] = [
  "AnimationEnd",
  "AnimationIteration",
  "AnimationStart",
  "AuxClick",
  "BeforeToggle",
  "CanPlay",
  "CanPlayThrough",
  "CompositionEnd",
  "CompositionStart",
  "CompositionUpdate",
  "ContextMenu",
  "DblClick",
  "DragEnd",
  "DragEnter",
  "DragExit",
  "DragLeave",
  "DragOver",
  "DragStart",
  "DurationChange",
  "FocusIn",
  "FocusOut",
  "FullscreenChange",
  "FullscreenError",
  "GotPointerCapture",
  "KeyDown",
  "KeyPress",
  "KeyUp",
  "LoadedData",
  "LoadedMetadata",
  "LoadEnd",
  "LoadStart",
  "LostPointerCapture",
  "MouseDown",
  "MouseEnter",
  "MouseLeave",
  "MouseMove",
  "MouseOut",
  "MouseOver",
  "MouseUp",
  "PointerCancel",
  "PointerDown",
  "PointerEnter",
  "PointerLeave",
  "PointerMove",
  "PointerOut",
  "PointerOver",
  "PointerUp",
  "RateChange",
  "SecurityPolicyViolation",
  "SelectionChange",
  "SelectStart",
  "TimeUpdate",
  "TouchCancel",
  "TouchEnd",
  "TouchMove",
  "TouchStart",
  "TransitionCancel",
  "TransitionEnd",
  "TransitionRun",
  "TransitionStart",
  "VisibilityChange",
  "VolumeChange",
];

const PASCAL_CASE: ReadonlyMap<string, string> = new Map(
  QWIK_PASCAL_CASE_NAMES.map((name) => [name.toLowerCase(), name]),
);

/** `click` → `Click`, `keydown` → `KeyDown`: an event's name as Qwik's JSX types spell it. */
function pascalName(event: string): string {
  return PASCAL_CASE.get(event) ?? `${event.charAt(0).toUpperCase()}${event.slice(1)}`;
}

/**
 * The listener prop of every DOM event a source may listen to (`DOM_EVENTS`): `click` →
 * `onClick$`, `keydown` → `onKeyDown$`, `dblclick` → `onDblClick$`. Total over the vocabulary,
 * so a listener the analyser accepts always has a name here (test/events.test.ts pins each name
 * against Qwik's JSX types and its runtime's lower-casing).
 */
export const QWIK_EVENT_PROPS: ReadonlyMap<string, string> = new Map(
  [...DOM_EVENTS.keys()].map((event) => [event, `on${pascalName(event)}$`]),
);

/** The listener prop of a DOM event (`QWIK_EVENT_PROPS`), in a scope: `window:onClick$`. */
export function qwikListenerProp(event: string, scope: "element" | "window" = "element"): string {
  const prop = QWIK_EVENT_PROPS.get(event);
  if (prop === undefined) throw new Error(`"${event}" is not an event a listener may take.`);
  return scope === "window" ? `window:${prop}` : prop;
}

/**
 * The QRL prop a component's event sets: `change` → `onChange$`, `valueChange` →
 * `onValueChange$`. The name a parent writes (`<Counter onChange$={…} />`) and the mount adapter
 * passes (ADR-0012).
 */
export function qwikEventProp(event: string): string {
  return `on${event.charAt(0).toUpperCase()}${event.slice(1)}$`;
}
