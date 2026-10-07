import { describe, expect, it } from "vitest";

import {
  ALLOWED_GLOBALS,
  BROWSER_GLOBALS,
  CLIENT_GLOBALS,
  isIdentifier,
  LIB_DOM_GLOBALS,
  PROP_NAME_PATTERN,
  PURE_GLOBALS,
  readsDom,
  RESERVED_PROP_NAMES,
  RESERVED_TYPE_NAMES,
  reservedEventName,
  reservedParameterName,
  reservedPropName,
  reservedPropsParameterName,
  reservedSetupName,
  SCHEDULING_GLOBALS,
  WINDOW_MEMBER_GLOBALS,
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
    ["onClick", "declares its events with `defineEmits`"],
    ["ngIf", "Angular reserves"],
    ["Fragment", "Astro's output renders `<>`"],
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

  it("reserves the type names the outputs declare or import", () => {
    expect([...RESERVED_TYPE_NAMES.keys()]).toEqual([
      "Props",
      "CSSProperties",
      "Component",
      "Partial",
      "Record",
      "Required",
      "Pick",
      "Exclude",
    ]);
    for (const name of RESERVED_TYPE_NAMES.keys()) expect(isIdentifier(name)).toBe(true);
  });

  // Each context reads what the one before it does, and more (ADR-0045).
  it("nests the globals of each context: render, pure, then client", () => {
    for (const name of ALLOWED_GLOBALS) expect(PURE_GLOBALS.has(name), name).toBe(true);
    for (const name of [...PURE_GLOBALS, ...BROWSER_GLOBALS, ...SCHEDULING_GLOBALS]) {
      expect(CLIENT_GLOBALS.has(name), name).toBe(true);
    }
    for (const name of CLIENT_GLOBALS) expect(isIdentifier(name), name).toBe(true);
    expect([...PURE_GLOBALS].filter((name) => !ALLOWED_GLOBALS.has(name)).toSorted()).toEqual([
      "Error",
      "Map",
      "RangeError",
      "Set",
      "Symbol",
      "TypeError",
      "WeakMap",
      "WeakSet",
      "structuredClone",
    ]);
    // What depends on time, locale, randomness or the browser is client code's alone.
    for (const name of ["Date", "Intl", "crypto", "performance", "console", "Promise"]) {
      expect(PURE_GLOBALS.has(name), name).toBe(false);
      expect(CLIENT_GLOBALS.has(name), name).toBe(true);
    }
    for (const name of ["globalThis", "eval", "process", "require", "Function", "Buffer"]) {
      expect(CLIENT_GLOBALS.has(name), name).toBe(false);
    }
    for (const name of BROWSER_GLOBALS) expect(SCHEDULING_GLOBALS.has(name), name).toBe(false);
  });

  // Client code runs only in the browser, on every target, which prints a global as written: it
  // reads every global lib.dom declares (async#2, inter#6), but the `window` members whose bare
  // name reads like a component's own, which it reads through `window`.
  it("let client code read the browser's globals, and `window`'s confusing members through it", () => {
    for (const name of [
      "fetch",
      "location",
      "history",
      "URL",
      "URLSearchParams",
      "FormData",
      "AbortController",
      "IntersectionObserver",
      "ResizeObserver",
      "HTMLInputElement",
      "KeyboardEvent",
      "localStorage",
      "navigator",
      "matchMedia",
      "confirm",
      "alert",
      "devicePixelRatio",
    ]) {
      expect(BROWSER_GLOBALS.has(name), name).toBe(true);
      expect(CLIENT_GLOBALS.has(name), name).toBe(true);
    }
    for (const name of ["name", "status", "top", "length", "event", "open", "scrollY", "onclick"]) {
      expect(WINDOW_MEMBER_GLOBALS.has(name), name).toBe(true);
      expect(CLIENT_GLOBALS.has(name), name).toBe(false);
    }
    for (const name of LIB_DOM_GLOBALS) {
      expect(CLIENT_GLOBALS.has(name) !== WINDOW_MEMBER_GLOBALS.has(name), name).toBe(true);
    }
    for (const name of WINDOW_MEMBER_GLOBALS) expect(LIB_DOM_GLOBALS.has(name), name).toBe(true);
  });

  // UF2018 and the `post` invariant judge only what a render changes (analyzer#8).
  it.each<[string, string, boolean]>([
    ["document", ".querySelector('li')", true],
    ["document", "?.activeElement", true],
    ["document", "", true],
    ["document", ".title = value", false],
    ["document", ".addEventListener('keydown', onKey)", false],
    ["window", ".scrollY", true],
    ["window", ".getComputedStyle(element)", true],
    ["window", "", true],
    ["window", ".localStorage.setItem('a', 'b')", false],
    ["window", ".history.replaceState(null, '', url)", false],
    ["window", ".addEventListener('resize', onResize)", false],
    ["getComputedStyle", "(element)", true],
    ["getSelection", "()", true],
    ["localStorage", ".setItem('a', 'b')", false],
    ["navigator", ".clipboard.writeText(text)", false],
    ["history", ".replaceState(null, '', url)", false],
    ["fetch", "(url)", false],
  ])("reads the rendered DOM through %s%s: %s", (name, following, expected) => {
    expect(readsDom(name, following)).toBe(expected);
  });

  it.each([
    ["String", "the global `String`"],
    ["props", "some outputs declare `props`"],
    ["$state", "Angular's `@for` declares"],
    ["_count", "Vue's compiled render functions"],
    ["as", "a keyword in Angular's template expressions"],
    ["arguments", "a reserved word"],
    ["constructor", "the component class's constructor"],
    ["ngOnInit", "Angular reserves"],
    ["ngOnDestroy", "lifecycle hooks"],
    ["useCounter", "as a hook"],
    ["use2", "as a hook"],
    ["save$", "Qwik's optimizer"],
    ["café", "not an ASCII identifier"],
    ["a-b", "not an ASCII identifier"],
  ])("keeps a setup binding from the name %j", (name, reason) => {
    expect(reservedSetupName(name)).toContain(reason);
  });

  it.each(["count", "emit", "timer", "user", "used", "useful", "ng", "_", "x$y", "onClick", "Map"])(
    "leaves the setup binding name %j free",
    (name) => {
      expect(reservedSetupName(name)).toBeUndefined();
    },
  );

  // Angular declares a member for each event, which its template statements read by name with
  // its own grammar: only its expression keywords are no names there.
  it.each([
    ["if", "a keyword in Angular's template expressions"],
    ["this", "a keyword in Angular's template expressions"],
    ["as", "a keyword in Angular's template expressions"],
    ["typeof", "a keyword in Angular's template expressions"],
    ["parseInt", "a global expressions may read"],
    ["constructor", "the Angular component class's constructor"],
  ])("keeps an event from the name %j", (name, reason) => {
    expect(reservedEventName(name)).toContain(reason);
    expect(reservedPropName(name)).toBeDefined();
  });

  it.each([
    "change",
    "select",
    "key",
    "close",
    "levelChange",
    "ngChange",
    "delete",
    "export",
    "continue",
    "new",
    "default",
    "import",
    "class",
  ])("leaves the event name %j free", (name) => {
    expect(reservedEventName(name)).toBeUndefined();
  });

  it.each(["toString", "valueOf", "hasOwnProperty", "__proto__"])(
    "finds nothing for %s on a prototype",
    (name) => {
      expect(ALLOWED_GLOBALS.has(name)).toBe(false);
      expect(CLIENT_GLOBALS.has(name)).toBe(false);
      expect(RESERVED_PROP_NAMES.get(name)).toBeUndefined();
      expect(reservedPropName(name)).toBe(
        name === "__proto__"
          ? `\`${name}\` is not ASCII letters and digits starting with a letter, which every target can declare.`
          : undefined,
      );
    },
  );

  it.each([
    ["String", "the global `String`"],
    ["undefined", "the global `undefined`"],
    ["props", "some outputs declare `props`"],
    ["rawProps", "some outputs declare `rawProps`"],
    ["Fragment", "Astro's output renders `<>`"],
    ["$index", "Angular's `@for` declares"],
    ["$item", "Angular's `@for` declares"],
    ["_ctx", "Vue's compiled render functions"],
    ["__props", "Vue's compiled render functions"],
    ["as", "a keyword in Angular's template expressions"],
  ])("keeps a list's or an arrow's parameter from the name %j", (name, reason) => {
    expect(reservedParameterName(name)).toContain(reason);
  });

  it.each(["item", "_", "index", "label", "x$"])("leaves the parameter name %j free", (name) => {
    expect(reservedParameterName(name)).toBeUndefined();
  });

  it("keeps the object form's parameter from the names Astro's compiled component declares", () => {
    expect(reservedPropsParameterName("$$props")).toContain("Astro's compiled component");
    expect(reservedPropsParameterName("$$p")).toBeDefined();
    expect(reservedPropsParameterName("$")).toBeUndefined();
    expect(reservedPropsParameterName("props")).toBeUndefined();
    expect(reservedPropsParameterName("Astro")).toBeUndefined();
  });
});
