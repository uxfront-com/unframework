// React's event table (ADR-0047): total over the IR's vocabulary, every prop react-dom's own
// registration name for its DOM event and declared by @types/react (with its capture prop where
// the table says), and the rule that decides where a listener goes native.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import {
  createElement as element,
  createEventAttribute,
  createFunctionHandler,
  createStaticAttribute,
  DOM_EVENTS,
  EVENT_INTERFACES,
} from "@unframework/ir";
import type { EventAttribute } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import {
  REACT_EVENTS,
  reactEventType,
  reactProp,
  synthetic,
  targetGuarded,
} from "../src/events.ts";

const require = createRequire(import.meta.url);
const reactDom = readFileSync(
  join(dirname(require.resolve("react-dom/package.json")), "cjs/react-dom-client.development.js"),
  "utf8",
);
const types = readFileSync(
  join(dirname(require.resolve("@types/react/package.json")), "index.d.ts"),
  "utf8",
);

/** react-dom's registrations: each React prop and the DOM events it listens to. */
function registrations(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  const simple = /simpleEventPluginEvents =\s*"([^"]+)"\.split/.exec(reactDom)![1]!.split(" ");
  simple.push(
    ...[...reactDom.matchAll(/simpleEventPluginEvents\.push\("(\w+)"\)/g)].map((m) => m[1]!),
  );
  for (const name of simple) {
    found.set(`on${name[0]!.toUpperCase()}${name.slice(1)}`, [name.toLowerCase()]);
  }
  const constants = new Map(
    [
      ...reactDom.matchAll(
        /(ANIMATION_\w+|TRANSITION_\w+) = getVendorPrefixedEventName\("(\w+)"\)/g,
      ),
    ].map((m) => [m[1]!, m[2]!.toLowerCase()]),
  );
  for (const [, dom, prop] of reactDom.matchAll(
    /registerSimpleEvent\(\s*("?\w+"?),\s*"(\w+)"\)/g,
  )) {
    const event = dom!.startsWith('"') ? dom!.slice(1, -1) : constants.get(dom!);
    if (event) found.set(prop!, [event]);
  }
  for (const [, prop, dependencies] of reactDom.matchAll(
    /register(?:TwoPhase|Direct)Event\(\s*"(\w+)",\s*(\[[^\]]*\]|"[^"]*"\.split\(\s*" "\s*\))/g,
  )) {
    const events = dependencies!.startsWith("[")
      ? [...dependencies!.matchAll(/"(\w+)"/g)].map((m) => m[1]!)
      : /"([^"]*)"/.exec(dependencies!)![1]!.split(" ");
    found.set(prop!, events);
  }
  return found;
}

/** Whether @types/react declares a listener prop on every element (or on `element`'s attributes). */
function declared(prop: string, on?: string): boolean {
  const scope = on
    ? types.slice(types.indexOf(`interface ${on}HTMLAttributes<T>`))
    : types.slice(types.indexOf("interface DOMAttributes<T>"));
  const block = scope.slice(0, scope.indexOf("\n    }\n"));
  return new RegExp(`\\b${prop}\\?:`).test(block);
}

const listener = (event: string, options: Partial<EventAttribute> = {}): EventAttribute => ({
  ...createEventAttribute(event, createFunctionHandler("save@0", { start: 0, end: 4 }), {
    start: 0,
    end: 4,
  }),
  ...options,
});
const at = { start: 0, end: 1 };
const tag = (name: string, attributes: Record<string, string> = {}) =>
  element(
    name,
    Object.entries(attributes).map(([key, value]) => createStaticAttribute(key, value, at)),
    [],
    at,
  );

describe("react events", () => {
  it("names every event of the IR's vocabulary", () => {
    expect([...REACT_EVENTS.keys()].toSorted()).toEqual([...DOM_EVENTS.keys()].toSorted());
  });

  it("uses react-dom's registration name for each event it has a prop for", () => {
    const registered = registrations();
    // React's `onFocus` and `onBlur` listen to `focusin` and `focusout` (a target guard keeps the
    // DOM's semantics), its enter and leave props to `over` and `out`, which it keeps to their
    // target as the DOM does, its `onChange` to more than `change` (native where it differs).
    const synthesised = new Map([
      ["focus", "focusin"],
      ["blur", "focusout"],
      ["mouseenter", "mouseover"],
      ["mouseleave", "mouseout"],
      ["pointerenter", "pointerover"],
      ["pointerleave", "pointerout"],
    ]);
    for (const [event, entry] of REACT_EVENTS) {
      if (!entry) continue;
      const events = registered.get(entry.prop);
      expect(events, `${event} → ${entry.prop}`).toBeDefined();
      expect(events, `${event} → ${entry.prop}`).toContain(synthesised.get(event) ?? event);
    }
  });

  it("listens natively to what React has no prop of its own for", () => {
    const registered = registrations();
    const props = new Map(
      [...registered].flatMap(([prop, events]) =>
        events.length === 1 ? [[events[0]!, prop] as const] : [],
      ),
    );
    for (const [event, entry] of REACT_EVENTS) {
      if (entry) continue;
      // Either react-dom has no prop for it, @types/react declares none, or the prop is another
      // event's (`onSelect`, `onBeforeInput` are synthesised; `focusin` is `onFocus`).
      const prop = props.get(event);
      if (prop) expect(declared(prop) && prop.toLowerCase() === `on${event}`, event).toBe(false);
    }
  });

  it("declares every prop, and its capture prop where it has one, as @types/react does", () => {
    for (const [event, entry] of REACT_EVENTS) {
      if (!entry) continue;
      const on = entry.element
        ? entry.element[0]!.toUpperCase() + entry.element.slice(1)
        : undefined;
      expect(declared(entry.prop, on), `${event}: ${entry.prop}`).toBe(true);
      expect(declared(`${entry.prop}Capture`, on), `${event}: ${entry.prop}Capture`).toBe(
        entry.capture,
      );
    }
  });

  it("keeps React's prop where its synthetic event keeps the DOM's semantics", () => {
    expect(synthetic(listener("click"), tag("button"))).toBe(true);
    expect(synthetic(listener("click", { capture: true }), tag("div"))).toBe(true);
    expect(reactProp(listener("click", { capture: true }))).toBe("onClickCapture");
    expect(reactProp(listener("dblclick"))).toBe("onDoubleClick");
    expect(reactProp(listener("keydown"))).toBe("onKeyDown");
    expect(synthetic(listener("input"), tag("input"))).toBe(true);
    expect(synthetic(listener("focus"), tag("input"))).toBe(true);
    // `change`: React's fires from the DOM's on a select and a file input.
    expect(synthetic(listener("change"), tag("select"))).toBe(true);
    expect(synthetic(listener("change"), tag("input", { type: "file" }))).toBe(true);
    // Its root listeners of `wheel`, `touchstart` and `touchmove` are passive.
    expect(synthetic(listener("wheel", { passive: true }), tag("div"))).toBe(true);
    expect(synthetic(listener("touchmove", { passive: true }), tag("div"))).toBe(true);
    expect(synthetic(listener("cancel"), tag("dialog"))).toBe(true);
  });

  it("listens natively where React's synthetic event differs from the DOM's", () => {
    // A text field's `change` fires per keystroke in React, and so does an ancestor's.
    expect(synthetic(listener("change"), tag("input"))).toBe(false);
    expect(synthetic(listener("change"), tag("input", { type: "text" }))).toBe(false);
    expect(synthetic(listener("change"), tag("textarea"))).toBe(false);
    expect(synthetic(listener("change"), tag("form"))).toBe(false);
    // A checkbox's and a radio's fires from the click: before `input`, and for a prevented click.
    expect(synthetic(listener("change"), tag("input", { type: "checkbox" }))).toBe(false);
    expect(synthetic(listener("change"), tag("input", { type: "RADIO" }))).toBe(false);
    // React synthesises these from other events, or has no prop for them.
    for (const event of ["select", "beforeinput", "focusin", "focusout", "command", "formdata"]) {
      expect(synthetic(listener(event), tag("div")), event).toBe(false);
    }
    // A non-passive listener of a root-passive event, where `preventDefault()` must work.
    expect(synthetic(listener("wheel"), tag("div"))).toBe(false);
    expect(synthetic(listener("touchstart"), tag("div"))).toBe(false);
    // Props @types/react declares without a capture variant, or on `<dialog>` only.
    expect(synthetic(listener("mouseenter", { capture: true }), tag("div"))).toBe(false);
    expect(synthetic(listener("toggle", { capture: true }), tag("details"))).toBe(false);
    expect(synthetic(listener("cancel"), tag("input", { type: "file" }))).toBe(false);
  });

  it("tests the target where React runs a listener of an event that does not bubble for a descendant", () => {
    expect(targetGuarded(listener("focus"), tag("div"))).toBe(true);
    expect(targetGuarded(listener("load"), tag("div"))).toBe(true);
    expect(targetGuarded(listener("invalid"), tag("form"))).toBe(true);
    // Not on an element no target can be inside, nor in the capture phase, which hears them in
    // the DOM too, nor where React keeps the event to its target itself.
    expect(targetGuarded(listener("focus"), tag("input"))).toBe(false);
    expect(targetGuarded(listener("focus", { capture: true }), tag("div"))).toBe(false);
    expect(targetGuarded(listener("mouseenter"), tag("div"))).toBe(false);
    expect(targetGuarded(listener("click"), tag("div"))).toBe(false);
  });

  it("types an event parameter with React's synthetic event of its interface", () => {
    expect(reactEventType("Event")).toBe("SyntheticEvent");
    expect(reactEventType("KeyboardEvent")).toBe("KeyboardEvent");
    expect(reactEventType("PointerEvent")).toBe("PointerEvent");
    expect(reactEventType("SubmitEvent")).toBe("SubmitEvent");
    expect(reactEventType("ErrorEvent")).toBe("SyntheticEvent");
    // Every interface of the vocabulary has one, which @types/react declares.
    for (const name of EVENT_INTERFACES.keys()) {
      expect(types, name).toMatch(new RegExp(`interface ${reactEventType(name)}<`));
    }
  });
});
