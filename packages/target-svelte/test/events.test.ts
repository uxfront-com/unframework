// The Svelte target's event table (ADR-0047): total over the IR's vocabulary, read back from
// Svelte's own element types, and the interfaces a handler's parameter takes there.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import {
  createElement,
  createEventAttribute,
  createFunctionCode,
  createCode,
  createInlineHandler,
  DOM_EVENTS,
  extendsEventInterface,
  PORTABLE_EVENT_INTERFACES,
} from "@unframework/ir";
import type { EventAttribute } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import {
  commonInterface,
  handlerInterface,
  isAttached,
  SVELTE_EVENT_INTERFACES,
} from "../src/events.ts";

const at = { start: 0, end: 0 };

/** Svelte's `svelte/elements` declarations, as the installed package has them. */
function svelteElementTypes(): string {
  const require = createRequire(import.meta.url);
  return readFileSync(
    join(dirname(require.resolve("svelte/package.json")), "elements.d.ts"),
    "utf8",
  );
}

/** Each `on<event>` attribute `svelte/elements` declares, with the interface its handler gets. */
function declaredAttributes(): Map<string, string> {
  const text = svelteElementTypes();
  const aliases = new Map<string, string>();
  for (const [, name, event] of text.matchAll(
    /export type (\w+EventHandler)<T extends EventTarget> = EventHandler<(\w+), T>/g,
  )) {
    aliases.set(name!, event!);
  }
  const declared = new Map<string, string>();
  for (const [, event, alias, generic, plain] of text.matchAll(
    /\n\s+on([a-z]+)\?: (?:(\w+EventHandler)<T>|EventHandler<(\w+), T>|(EventHandler)) \| undefined \| null;/g,
  )) {
    if (declared.has(event!)) continue;
    declared.set(event!, alias ? aliases.get(alias)! : (generic ?? (plain ? "Event" : "?")));
  }
  return declared;
}

/** A listener of `event` with options, on a fresh element whose other listeners are `others`. */
function listener(
  event: string,
  options: { capture?: boolean; once?: boolean; passive?: boolean } = {},
  others: EventAttribute[] = [],
) {
  const handler = createInlineHandler(createFunctionCode([], createCode("{}", at, []), at), at);
  const attribute = createEventAttribute(event, handler, at, options);
  const element = createElement("button", [...others, attribute], [], at);
  return { attribute, element };
}

describe("svelte events", () => {
  it("has a cell for every event of the IR's vocabulary, and no other", () => {
    expect([...SVELTE_EVENT_INTERFACES.keys()]).toEqual([...DOM_EVENTS.keys()]);
  });

  it("reads each event's handler type from svelte/elements, where it declares an attribute", () => {
    const declared = declaredAttributes();
    expect(declared.size).toBeGreaterThan(80);
    for (const [event, svelte] of SVELTE_EVENT_INTERFACES) {
      expect(declared.get(event), event).toBe(svelte);
    }
  });

  // A handler may use the members every target's event carries (UF3032): Svelte's interface must
  // have them, or a handler the analyser accepts fails svelte-check.
  it("hands every handler an interface with the members a portable handler uses", () => {
    for (const [event, svelte] of SVELTE_EVENT_INTERFACES) {
      const portable = PORTABLE_EVENT_INTERFACES.get(event)!;
      expect(extendsEventInterface(svelte ?? DOM_EVENTS.get(event)!, portable), event).toBe(true);
    }
  });

  it.each([
    [{}, false],
    [{ capture: true }, false],
    [{ once: true }, true],
    [{ passive: true }, true],
  ])("writes a click listener with %o as an attachment: %s", (options, attached) => {
    const { attribute, element } = listener("click", options);
    expect(isAttached(attribute, element)).toBe(attached);
  });

  it("writes the events Svelte types no attribute for, or makes passive, as attachments", () => {
    for (const event of ["animationcancel", "command", "securitypolicyviolation", "touchstart"]) {
      const { attribute, element } = listener(event);
      expect(isAttached(attribute, element), event).toBe(true);
    }
    const { attribute, element } = listener("touchstart", { capture: true });
    expect(isAttached(attribute, element)).toBe(false);
  });

  it("writes a bubbling listener beside an attached one of its event as an attachment too", () => {
    const once = listener("click", { once: true }).attribute;
    const { attribute, element } = listener("click", {}, [once]);
    expect(isAttached(attribute, element)).toBe(true);
    const capture = listener("click", { capture: true }, [once]);
    expect(isAttached(capture.attribute, capture.element)).toBe(false);
  });

  it("hands an attribute's handler Svelte's interface, and an attachment's lib.dom's", () => {
    const plain = listener("click");
    expect(handlerInterface(plain.attribute, plain.element)).toBe("MouseEvent");
    const once = listener("click", { once: true });
    expect(handlerInterface(once.attribute, once.element)).toBe("PointerEvent");
    const input = listener("input");
    expect(handlerInterface(input.attribute, input.element)).toBe("Event");
  });

  it.each([
    [["MouseEvent"], "MouseEvent"],
    [["PointerEvent", "MouseEvent"], "MouseEvent"],
    [["InputEvent", "Event"], "Event"],
    [["KeyboardEvent", "MouseEvent"], "UIEvent"],
    [["WheelEvent", "PointerEvent"], "MouseEvent"],
    [["SubmitEvent", "FocusEvent"], "Event"],
    [[], "Event"],
  ])("takes %o as %s", (names, common) => {
    expect(commonInterface(names)).toBe(common);
  });
});
