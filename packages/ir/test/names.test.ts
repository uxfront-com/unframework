import { describe, expect, it } from "vitest";

import {
  ALLOWED_GLOBALS,
  isIdentifier,
  PROP_NAME_PATTERN,
  RESERVED_PROP_NAMES,
  reservedPropName,
} from "../src/index.ts";

describe("the names", () => {
  it("allow identifiers as globals, none of them a prop's name", () => {
    expect([...ALLOWED_GLOBALS].filter((name) => !isIdentifier(name))).toEqual([]);
    expect([...ALLOWED_GLOBALS].filter((name) => !RESERVED_PROP_NAMES.has(name))).toEqual([]);
    // What makes rendering depend on time, locale or randomness is not allowed.
    for (const name of ["Date", "Intl", "crypto", "performance", "globalThis", "window"]) {
      expect(ALLOWED_GLOBALS.has(name), name).toBe(false);
    }
  });

  it.each([
    ["key", "list identity"],
    ["children", "slot content"],
    ["class", "falls through"],
    ["props", "props object"],
    ["rawProps", "merges defaults"],
    ["Astro", "Astro component"],
    ["constructor", "Angular component class"],
    ["eval", "reserved word"],
    ["arguments", "reserved word"],
    ["package", "reserved word"],
    ["await", "reserved word"],
    ["as", "keyword in Angular"],
    ["undefined", "keyword in Angular"],
    ["Math", "declares as a member"],
    ["JSON", "declares as a member"],
    ["onClick", "events land in M2"],
    ["ngIf", "Angular reserves"],
    ["label$", "ASCII letters and digits"],
    ["_label", "ASCII letters and digits"],
    ["étiquette", "ASCII letters and digits"],
    ["ref_for", "ASCII letters and digits"],
    ["1st", "ASCII letters and digits"],
    ["", "ASCII letters and digits"],
  ])("reserves the prop name %j", (name, reason) => {
    expect(reservedPropName(name)).toContain(reason);
  });

  it.each(["label", "tone", "x1", "Props", "keys", "online", "ngram", "classes", "on", "title"])(
    "accepts the prop name %j",
    (name) => {
      expect(reservedPropName(name)).toBeUndefined();
      expect(PROP_NAME_PATTERN.test(name)).toBe(true);
    },
  );

  it("reserves only names the pattern would otherwise accept, and the names it lists", () => {
    const listed = [...RESERVED_PROP_NAMES.keys()].filter((name) => !PROP_NAME_PATTERN.test(name));
    expect(listed.toSorted()).toEqual(["ref_for", "ref_key"]);
  });

  it.each(["toString", "valueOf", "hasOwnProperty", "__proto__"])(
    "finds nothing for %s on a prototype",
    (name) => {
      expect(ALLOWED_GLOBALS.has(name)).toBe(false);
      expect(RESERVED_PROP_NAMES.get(name)).toBeUndefined();
      expect(reservedPropName(name)).toBe(
        name === "__proto__"
          ? `\`${name}\` is not ASCII letters and digits starting with a letter, which every target can declare.`
          : undefined,
      );
    },
  );
});
