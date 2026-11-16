// The inline runner Angular and Qwik call (ADR-0099), run as an output declares it, with a fake
// `MutationObserver`: an element that leaves leaves its caller's list, comes back if it returns,
// and its watch ends once it is collected, so a long-lived page keeps no element it dropped.
import { stripTypeScriptTypes } from "node:module";

import { describe, expect, it } from "vitest";

import { directiveRunnerCode } from "../src/index.ts";

interface FakeElement {
  name: string;
  isConnected: boolean;
}

type Follow = { leave(element: FakeElement): void; back(element: FakeElement): void };

type Run = (directive: object, element: FakeElement, value: string, follow?: Follow) => () => void;

/** The runner's code with its types stripped, its globals faked, and what a test reads of it. */
function runner() {
  const observers: { callback: () => void; disconnected: boolean }[] = [];
  class FakeObserver {
    readonly #entry: { callback: () => void; disconnected: boolean };
    constructor(callback: () => void) {
      this.#entry = { callback, disconnected: false };
      observers.push(this.#entry);
    }
    observe(): void {}
    disconnect(): void {
      this.#entry.disconnected = true;
    }
  }
  /** Whether the fake `WeakRef`s report their element collected. */
  const collected = { now: false };
  class FakeWeakRef<T> {
    readonly #value: T;
    constructor(value: T) {
      this.#value = value;
    }
    deref(): T | undefined {
      return collected.now ? undefined : this.#value;
    }
  }
  const calls: string[] = [];
  const queueHook = (element: FakeElement, run: () => void, hook: string) => {
    calls.push(`${hook} ${element.name}`);
    run();
  };
  const code = stripTypeScriptTypes(
    directiveRunnerCode({
      run: "runDirective",
      hooks: "DirectiveHooks",
      states: "directiveStates",
      watch: "watchDocument",
      watches: "documentWatches",
      queue: "queueHook",
    }).join("\n\n"),
  );
  const make = new Function(
    "MutationObserver",
    "WeakRef",
    "document",
    "queueHook",
    `${code}\nreturn { runDirective, documentWatches };`,
  ) as (
    observer: typeof FakeObserver,
    weakRef: typeof FakeWeakRef,
    document: object,
    queue: typeof queueHook,
  ) => { runDirective: Run; documentWatches: { checks: Set<() => void> } };
  const made = make(FakeObserver, FakeWeakRef, {}, queueHook);
  /** A change of the document: every observer's callback runs. */
  const mutate = () => {
    for (const observer of observers) if (!observer.disconnected) observer.callback();
  };
  return { ...made, calls, collected, mutate, observers };
}

describe("the directive runner", () => {
  const hooks = {};

  it("takes a left element out of its caller's list, and back in when it returns", () => {
    const { runDirective, calls, mutate } = runner();
    const listed: string[] = [];
    const follow: Follow = {
      leave: (element) => listed.push(`leave ${element.name}`),
      back: (element) => listed.push(`back ${element.name}`),
    };
    const row = { name: "row", isConnected: true };
    runDirective(hooks, row, "a", follow);
    row.isConnected = false;
    mutate();
    row.isConnected = true;
    mutate();
    expect(calls).toEqual(["mounted row", "unmounted row", "mounted row"]);
    expect(listed).toEqual(["leave row", "back row"]);
  });

  it("ends a left element's watch once it is collected, and the observer with the last watch", () => {
    const { runDirective, documentWatches, collected, mutate, observers } = runner();
    const follow: Follow = { leave() {}, back() {} };
    const rows = [1, 2, 3].map((index) => ({ name: `row ${index}`, isConnected: true }));
    for (const row of rows) runDirective(hooks, row, "a", follow);
    expect(documentWatches.checks.size).toBe(3);
    for (const row of rows) row.isConnected = false;
    mutate();
    // Gone from the document, each is watched weakly until it is collected.
    expect(documentWatches.checks.size).toBe(3);
    collected.now = true;
    mutate();
    expect(documentWatches.checks.size).toBe(0);
    expect(observers.every((observer) => observer.disconnected)).toBe(true);
  });

  it("keeps watching an element without `follow`, as Angular's projected content comes back", () => {
    const { runDirective, calls, documentWatches, collected, mutate } = runner();
    const body = { name: "body", isConnected: true };
    runDirective(hooks, body, "a");
    body.isConnected = false;
    mutate();
    collected.now = true;
    mutate();
    expect(documentWatches.checks.size).toBe(1);
    body.isConnected = true;
    mutate();
    expect(calls).toEqual(["mounted body", "unmounted body", "mounted body"]);
  });
});
