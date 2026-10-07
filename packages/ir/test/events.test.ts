import { describe, expect, it } from "vitest";

import {
  DOM_EVENTS,
  EVENT_INTERFACES,
  EVENT_METHODS,
  extendsEventInterface,
  PASSIVE_EVENTS,
  PORTABLE_EVENT_INTERFACES,
  PORTABLE_EVENT_MEMBERS,
  UNSUPPORTED_EVENTS,
  WINDOW_EVENTS,
} from "../src/index.ts";

describe("the event vocabulary", () => {
  it("keeps the element events, the window's and the unsupported ones apart", () => {
    for (const event of DOM_EVENTS.keys()) {
      expect(WINDOW_EVENTS.has(event), event).toBe(false);
      expect(UNSUPPORTED_EVENTS.has(event), event).toBe(false);
      // `addEventListener`'s name, which `EventAttribute.event`'s pattern also holds.
      expect(event, event).toMatch(/^[a-z][a-z0-9]*$/);
    }
    for (const event of WINDOW_EVENTS.keys()) expect(UNSUPPORTED_EVENTS.has(event)).toBe(false);
    expect(DOM_EVENTS.size).toBe(96);
  });

  // The vocabulary the corpus and the targets' tables lean on (ADR-0047).
  it.each([
    ["click", "PointerEvent"],
    ["dblclick", "MouseEvent"],
    ["keydown", "KeyboardEvent"],
    ["input", "InputEvent"],
    ["change", "Event"],
    ["submit", "SubmitEvent"],
    ["focus", "FocusEvent"],
    ["blur", "FocusEvent"],
    ["wheel", "WheelEvent"],
    ["close", "Event"],
    ["cancel", "Event"],
    ["command", "Event"],
    ["fullscreenchange", "Event"],
    ["encrypted", "MediaEncryptedEvent"],
  ])("dispatches %s as a %s", (event, name) => {
    expect(DOM_EVENTS.get(event)).toBe(name);
  });

  it.each(["hashchange", "popstate", "storage", "beforeunload", "message", "online"])(
    "puts the window's %s apart",
    (event) => {
      expect(DOM_EVENTS.has(event)).toBe(false);
      expect(WINDOW_EVENTS.has(event)).toBe(true);
    },
  );

  it.each(["resize", "selectionchange", "dragexit", "slotchange", "beforematch"])(
    "gives a reason for the unsupported %s",
    (event) => {
      expect(DOM_EVENTS.has(event)).toBe(false);
      expect(UNSUPPORTED_EVENTS.get(event)).toBeTruthy();
    },
  );

  it("lets a listener be passive only where it lets scrolling go on", () => {
    expect([...PASSIVE_EVENTS].toSorted()).toEqual(["touchmove", "touchstart", "wheel"]);
    for (const event of PASSIVE_EVENTS) expect(DOM_EVENTS.has(event)).toBe(true);
  });

  it("knows every interface the events are dispatched with, down to Event", () => {
    for (const [event, name] of DOM_EVENTS) {
      expect(EVENT_INTERFACES.has(name), event).toBe(true);
      expect(extendsEventInterface(name, "Event"), name).toBe(true);
    }
    expect(extendsEventInterface("PointerEvent", "MouseEvent")).toBe(true);
    expect(extendsEventInterface("PointerEvent", "UIEvent")).toBe(true);
    expect(extendsEventInterface("MouseEvent", "PointerEvent")).toBe(false);
    expect(extendsEventInterface("KeyboardEvent", "MouseEvent")).toBe(false);
    expect(extendsEventInterface("Unknown", "Event")).toBe(false);
  });

  it("gives each event an interface its DOM interface extends, with members", () => {
    expect([...PORTABLE_EVENT_INTERFACES.keys()]).toEqual([...DOM_EVENTS.keys()]);
    for (const [event, name] of PORTABLE_EVENT_INTERFACES) {
      expect(extendsEventInterface(DOM_EVENTS.get(event)!, name), event).toBe(true);
    }
    expect([...PORTABLE_EVENT_MEMBERS.keys()].toSorted()).toEqual(
      [...EVENT_INTERFACES.keys()].toSorted(),
    );
    for (const [name, members] of PORTABLE_EVENT_MEMBERS) {
      for (const member of PORTABLE_EVENT_MEMBERS.get("Event")!) {
        expect(members.has(member), `${name}.${member}`).toBe(true);
      }
    }
    for (const method of EVENT_METHODS) {
      expect([...PORTABLE_EVENT_MEMBERS.values()].some((members) => members.has(method))).toBe(
        true,
      );
    }
  });

  // React dispatches these as a synthetic event of an interface their DOM one extends
  // (react-dom 19.3.0's `extractEvents`), which a handler's members must fit.
  it.each([
    ["click", "MouseEvent"],
    ["contextmenu", "MouseEvent"],
    ["pointerdown", "PointerEvent"],
    ["input", "Event"],
    ["beforeinput", "InputEvent"],
    ["scroll", "Event"],
    ["transitionrun", "Event"],
    ["transitionend", "TransitionEvent"],
    ["keydown", "KeyboardEvent"],
    ["formdata", "FormDataEvent"],
  ])("lets a %s handler use %s's portable members", (event, name) => {
    expect(PORTABLE_EVENT_INTERFACES.get(event)).toBe(name);
  });

  // What React's synthetic events lack, or differ in (ADR-0047): never portable.
  it.each([
    ["Event", "composedPath"],
    ["Event", "stopImmediatePropagation"],
    ["Event", "eventPhase"],
    ["UIEvent", "view"],
    ["KeyboardEvent", "isComposing"],
    ["KeyboardEvent", "keyCode"],
    ["KeyboardEvent", "locale"],
    ["MouseEvent", "offsetX"],
    ["PointerEvent", "getCoalescedEvents"],
    ["InputEvent", "inputType"],
    ["FocusEvent", "detail"],
    ["TouchEvent", "getModifierState"],
    ["ToggleEvent", "source"],
  ])("keeps %s's %s out", (name, member) => {
    expect(PORTABLE_EVENT_MEMBERS.get(name)!.has(member)).toBe(false);
  });

  it.each([
    ["Event", "preventDefault"],
    ["Event", "currentTarget"],
    ["KeyboardEvent", "key"],
    ["KeyboardEvent", "shiftKey"],
    ["MouseEvent", "clientX"],
    ["PointerEvent", "pointerType"],
    ["SubmitEvent", "submitter"],
    ["WheelEvent", "deltaY"],
    ["InputEvent", "data"],
  ])("lets a handler use %s's %s", (name, member) => {
    expect(PORTABLE_EVENT_MEMBERS.get(name)!.has(member)).toBe(true);
  });

  it.each(["toString", "constructor", "__proto__", "hasOwnProperty"])(
    "finds nothing for %s on a prototype",
    (name) => {
      expect(DOM_EVENTS.get(name)).toBeUndefined();
      expect(WINDOW_EVENTS.get(name)).toBeUndefined();
      expect(UNSUPPORTED_EVENTS.get(name)).toBeUndefined();
      expect(EVENT_INTERFACES.has(name)).toBe(false);
      expect(PORTABLE_EVENT_MEMBERS.get("Event")!.has(name)).toBe(false);
      expect(extendsEventInterface(name, "Event")).toBe(false);
    },
  );
});
