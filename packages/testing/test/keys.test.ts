// The keys `view.user.type` and `view.user.keyboard` press (ADR-0050): each key's press and
// release is an input of its own, so the text names each key once, and what the syntax cannot
// say is refused before any input is dispatched.
import { describe, expect, it } from "vitest";

import { parseKeys } from "../src/browser/keys.ts";

const both = (key: string, text = key.length === 1) => ({ key, text, press: true, release: true });

describe("parseKeys", () => {
  it("presses and releases each character, and each key in braces", () => {
    expect(parseKeys("al", "type")).toEqual([both("a"), both("l")]);
    expect(parseKeys("a{Enter}", "type")).toEqual([both("a"), both("Enter")]);
    expect(parseKeys("{ArrowDown}{ArrowDown}", "keyboard")).toEqual([
      both("ArrowDown"),
      both("ArrowDown"),
    ]);
  });

  it("holds a key until its release, and checks both against the keys held", () => {
    expect(parseKeys("{Control>}s{/Control}", "keyboard")).toEqual([
      { key: "Control", text: false, press: true, release: false },
      both("s"),
      { key: "Control", text: false, press: false, release: true },
    ]);
    // Held by an earlier action: released here.
    expect(parseKeys("{/Shift}", "keyboard", new Set(["Shift"]))).toEqual([
      { key: "Shift", text: false, press: false, release: true },
    ]);
    expect(() => parseKeys("{/Shift}", "view.user.keyboard")).toThrow(
      /^view\.user\.keyboard: \{\/Shift\} releases Shift, which is not held in "\{\/Shift\}": /,
    );
    expect(() => parseKeys("{Shift>}{Shift}", "view.user.keyboard")).toThrow(
      /\{Shift\} presses Shift, which is held already/,
    );
    expect(() => parseKeys("a", "view.user.type", new Set(["a"]))).toThrow(
      /a presses a, which is held already/,
    );
  });

  it("types a brace or a bracket written twice, and a character outside the layout as text", () => {
    expect(parseKeys("{{x[[", "type")).toEqual([both("{"), both("x"), both("[")]);
    // One input per character a person types, not per UTF-16 unit.
    expect(parseKeys("é👍", "type")).toEqual([both("é", true), both("👍", true)]);
    expect(parseKeys("{a}", "type")).toEqual([both("a", true)]);
  });

  it("refuses an empty text and the syntax it does not take", () => {
    expect(() => parseKeys("", "view.user.keyboard")).toThrow(
      'view.user.keyboard: no key to press in "": a character types itself, {Enter} presses and releases a key as Playwright names it',
    );
    expect(() => parseKeys("[ShiftLeft]", "view.user.keyboard")).toThrow(
      /a key code in brackets \(\[KeyA\]\) is not supported/,
    );
    expect(() => parseKeys("{a>3}", "view.user.keyboard")).toThrow(/\{a>3\} is not a key/);
    expect(() => parseKeys("{/a>}", "view.user.keyboard")).toThrow(/\{\/a>\} is not a key/);
    expect(() => parseKeys("{}", "view.user.keyboard")).toThrow(/\{\} is not a key/);
    expect(() => parseKeys("{Enter", "view.user.keyboard")).toThrow(
      /the "\{" at 0 is never closed/,
    );
  });
});
