// What the React target's output does in Chromium (the semantics contract, ADR-0046 to
// ADR-0048), where React's own model differs from the source's: each component is one of
// test/behaviour-sources.ts, compiled through the analyser and this target and mounted with the
// toolchain's adapter. The corpus checks the same contract on every target (L8, L9); these tests
// pin React's shapes on what the corpus does not reach: a listener changed by a rerender,
// StrictMode's second mount, nothing logged, and an app's render without `act`.
import type { MountedComponent, MountListener } from "@unframework/codegen";
import { act as reactAct, createElement, StrictMode } from "react";
import type { ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { mount } from "../src/toolchain/client.ts";

/** A behaviour component, as the browser project serves it (test/behaviour-modules.ts). */
async function component(name: string): Promise<ComponentType<Record<string, unknown>>> {
  const module = (await import(/* @vite-ignore */ `/__uf_behaviour__/${name}.tsx`)) as {
    default: ComponentType<Record<string, unknown>>;
  };
  return module.default;
}

const logged: unknown[][] = [];
let container: HTMLElement;
let mounted: MountedComponent | undefined;
let events: [string, ...unknown[]][];

beforeEach(() => {
  logged.length = 0;
  events = [];
  vi.spyOn(console, "warn").mockImplementation((...args) => void logged.push(args));
  vi.spyOn(console, "error").mockImplementation((...args) => void logged.push(args));
  container = document.createElement("div");
  document.body.append(container);
});

afterEach(async () => {
  await mounted?.unmount();
  mounted = undefined;
  container.remove();
  vi.restoreAllMocks();
});

/** Listeners that record every emit of `names`, in order, as `[name, ...args]`. */
function recording(...names: string[]): Record<string, MountListener> {
  return Object.fromEntries(
    names.map((name) => [name, (...args: unknown[]) => void events.push([name, ...args])]),
  );
}

/** The props a parent passes to record emits of `names` without the adapter: `onChange`. */
function props(...names: string[]): Record<string, MountListener> {
  return Object.fromEntries(
    Object.entries(recording(...names)).map(([name, listener]) => [
      `on${name.charAt(0).toUpperCase()}${name.slice(1)}`,
      listener,
    ]),
  );
}

async function start(
  type: ComponentType<Record<string, unknown>>,
  names: string[],
  props: Record<string, unknown> = {},
): Promise<MountedComponent> {
  mounted = await mount(type, container, { props, on: recording(...names) });
  return mounted;
}

const button = (name: string) =>
  [...container.querySelectorAll("button")].find((element) => element.textContent === name)!;

/**
 * Mounts a component under `<StrictMode>` at the root, inside `act` as the adapter does: React
 * 19 runs each effect, its cleanup and the effect again on mount only for a root's StrictMode, not
 * for one a component renders.
 */
async function startStrict(
  type: ComponentType<Record<string, unknown>>,
  names: string[],
): Promise<MountedComponent> {
  const root = createRoot(container);
  const inAct = async <T>(callback: () => T | Promise<T>): Promise<T> => {
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
    try {
      return await reactAct(callback);
    } finally {
      Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", false);
    }
  };
  await inAct(async () =>
    root.render(createElement(StrictMode, null, createElement(type, props(...names)))),
  );
  mounted = {
    async settle() {
      await inAct(async () => {});
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    },
    rerender: () => Promise.reject(new Error("A StrictMode test does not rerender.")),
    interact: (action) => inAct(action),
    unmount: () => inAct(async () => root.unmount()),
  };
  return mounted;
}

/** Runs a user's action through the adapter, then lets React's scheduled work land. */
async function act(action: () => Promise<unknown>): Promise<void> {
  await mounted!.interact!(action);
  await mounted!.settle();
}

describe("react output in the browser", () => {
  it("reads a write in another listener of the same event and after a called function", async () => {
    await start(await component("Phases"), ["logged", "total"]);
    await act(() => userEvent.click(button("Log")));
    await act(() => userEvent.click(button("Add")));
    expect(events).toEqual([
      ["logged", ["capture", "bubble"]],
      ["total", 12],
    ]);
    expect(container.querySelector("output")!.textContent).toBe("12");
    expect(logged).toEqual([]);
  });

  it("runs a watcher once per handler, with previous values and cleanups, and not for a value written back", async () => {
    await start(await component("Watcher"), ["ran", "cleaned"]);
    await act(() => userEvent.click(button("Twice")));
    await act(() => userEvent.click(button("Twice")));
    await act(() => userEvent.click(button("Back")));
    expect(events).toEqual([
      ["ran", 2, 0],
      ["cleaned", 2],
      ["ran", 4, 2],
    ]);
    await mounted!.unmount();
    mounted = undefined;
    expect(events.at(-1)).toEqual(["cleaned", 4]);
    expect(logged).toEqual([]);
  });

  it("runs onMounted with its element in the document, and onUnmounted when it goes", async () => {
    await start(await component("Ticker"), ["mounted", "tick", "unmounted"]);
    expect(events[0]).toEqual(["mounted", true]);
    // The interval keeps ticking while the poll waits, so a slow runner sees more than two.
    const ticks = () => events.filter(([name]) => name === "tick").map(([, count]) => count);
    await vi.waitFor(() => expect(ticks().length).toBeGreaterThanOrEqual(2));
    await mounted!.unmount();
    expect(ticks()).toEqual(ticks().map((_, index) => index + 1));
    mounted = undefined;
    const count = events.length;
    expect(events.at(-1)).toEqual(["unmounted"]);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(events).toHaveLength(count);
  });

  it("runs a once listener once per element, and lets a later click through", async () => {
    await start(await component("Options"), []);
    await act(() => userEvent.click(button("a")));
    await act(() => userEvent.click(button("a")));
    await act(() => userEvent.click(button("b")));
    expect(container.querySelector("p")!.textContent).toBe("a outer b");
  });

  it("hears a wheel through a passive listener", async () => {
    await start(await component("Options"), []);
    const wheel = container.querySelector<HTMLElement>("[aria-label='Wheel']")!;
    await act(() => userEvent.wheel(wheel, { delta: { y: 100 } }));
    expect(container.querySelector("p")!.textContent).toBe("down");
  });

  it("hears a text field's change when it commits, and a focus only at its target", async () => {
    await start(await component("Fields"), []);
    const name = container.querySelector<HTMLInputElement>("[name='name']")!;
    const log = () => container.querySelector("p")!.textContent;
    await act(() => userEvent.click(name));
    await act(() => userEvent.keyboard("Ada"));
    // Neither the keystrokes (React's own onChange) nor the field's focus (React's onFocus is
    // focusin) reach the listeners.
    expect(log()).toBe("");
    await act(() => userEvent.click(container.querySelector<HTMLElement>("[name='other']")!));
    expect(log()).toBe("change Ada");
  });

  it("emits through the listener and with the props of the latest render after an await", async () => {
    const first = vi.fn();
    const second = vi.fn();
    mounted = await mount(await component("Deferred"), container, {
      props: { label: "A", onDone: first },
    });
    await act(() => userEvent.click(button("Start")));
    await mounted.rerender({ label: "B", onDone: second });
    await act(() => userEvent.click(button("Finish")));
    await vi.waitFor(() => expect(second).toHaveBeenCalledWith("B"));
    expect(first).not.toHaveBeenCalled();
  });

  it("resolves nextTick once React has rendered and the watchers have run", async () => {
    await start(await component("Ticked"), ["watched", "read"]);
    await act(() => userEvent.click(button("Bump")));
    await vi.waitFor(() => expect(events).toHaveLength(2));
    expect(events).toEqual([
      ["watched", 1],
      ["read", "1"],
    ]);
    expect(logged).toEqual([]);
  });

  it("replaces a branch's element, as the other targets do, so focus leaves with it", async () => {
    await start(await component("Branches"), []);
    await act(() => userEvent.click(button("Edit")));
    expect(button("Save")).toBeDefined();
    expect(document.activeElement).not.toBe(button("Save"));
  });

  it("runs two native listeners of one event on one element, when the first writes state", async () => {
    const added = vi.spyOn(EventTarget.prototype, "addEventListener");
    await start(await component("Pair"), ["first"]);
    const field = (label: string) =>
      container.querySelector<HTMLInputElement>(`[aria-label='${label}']`)!;
    await act(() => userEvent.fill(field("Name"), "Ada"));
    await act(() => userEvent.click(field("Row a")));
    await act(() => userEvent.fill(field("Row a"), "Bo"));
    await act(() => userEvent.click(field("Name")));
    expect(events).toEqual([
      ["first", "Ada"],
      ["first", "a Bo"],
    ]);
    expect(container.querySelector("p")!.textContent).toBe("a Bo");
    // The field's ref callback is declared once: React never adds its listener again.
    const name = field("Name");
    const changes = added.mock.calls.filter(
      ([type], index) => type === "change" && added.mock.contexts[index] === name,
    );
    expect(changes).toHaveLength(1);
  });

  it("keeps the DOM's order of focus and focusin, and of a checkbox's click, input and change", async () => {
    await start(await component("Choices"), []);
    const field = (label: string) =>
      container.querySelector<HTMLInputElement>(`[aria-label='${label}']`)!;
    await act(() => userEvent.click(field("Name")));
    await act(() => userEvent.click(field("News")));
    await act(() => userEvent.click(field("Held")));
    expect(container.querySelector("p")!.textContent.split(", ")).toEqual([
      "input focus",
      "group focusin",
      "input blur",
      "group focusout",
      "group focusin",
      "click",
      "input",
      "change",
      "group focusout",
      "group focusin",
    ]);
    // A prevented click leaves the box as it was, and the DOM fires no change.
    expect(field("Held").checked).toBe(false);
  });

  it("replaces a branch's element with a nested branch's, as the other targets do", async () => {
    await start(await component("Modes"), []);
    const first = button("A");
    await act(() => userEvent.click(first));
    expect(button("B")).not.toBe(first);
    expect(document.activeElement).not.toBe(button("B"));
  });

  it("replaces the element of a nested conditional that tests no conflict of its own, as the other targets do", async () => {
    await start(await component("NestKeys"), []);
    const first = button("A");
    const third = button("C");
    await act(() => userEvent.click(first));
    expect(button("B")).not.toBe(first);
    expect(button("E")).not.toBe(third);
    expect(document.activeElement).not.toBe(button("B"));
  });

  it("never carries an element or what was typed into another branch, wherever React would reconcile them", async () => {
    await start(await component("Switches"), []);
    const field = (label: string) =>
      container.querySelector<HTMLInputElement>(`[aria-label='${label}']`)!;
    // A single root against the first of a fragment's, the conditional its parent's only child.
    await act(() => userEvent.fill(field("Password"), "hunter2"));
    await act(() => userEvent.click(button("Switch")));
    expect(field("Email").value).toBe("");
    expect(field("Email").type).toBe("text");
    // Two fragments, position by position, a nested conditional at a position among them.
    const first = button("A");
    await act(() => userEvent.click(first));
    expect(button("B")).not.toBe(first);
    expect(document.activeElement).not.toBe(button("B"));
    // Keyed siblings, and lists as branches, whose rows React reconciles by their own keys.
    await act(() => userEvent.fill(field("Left secret"), "left"));
    await act(() => userEvent.fill(field("Right secret"), "right"));
    await act(() => userEvent.fill(field("Secret row"), "row"));
    await act(() => userEvent.click(button("Flip")));
    expect([field("Left").value, field("Right").value, field("Open row").value]).toEqual([
      "",
      "",
      "",
    ]);
    expect(logged).toEqual([]);
  });

  it("adds and removes one document listener for the instance's life, as a function passed as a value", async () => {
    await start(await component("Shortcuts"), ["shortcut"]);
    for (let toggles = 0; toggles < 3; toggles++) {
      await act(() => userEvent.click(button("Toggle")));
    }
    await act(() => userEvent.keyboard("k"));
    expect(events).toEqual([["shortcut", "k", 1]]);
    expect(container.querySelector("p")!.textContent).toBe("Used: 1");
    await mounted!.unmount();
    mounted = undefined;
    await userEvent.keyboard("j");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "j" }));
    expect(events).toEqual([["shortcut", "k", 1]]);
  });

  it("runs a post watcher once the DOM shows what a pre watcher wrote, declared before it or not", async () => {
    await start(await component("Measured"), ["rendered"]);
    await act(() => userEvent.click(button("Search")));
    expect(events).toEqual([["rendered", 2]]);
  });

  it("passes the value its branch narrows, from the latest render, to a native listener there", async () => {
    mounted = await mount(await component("Narrowed"), container, {
      props: { owner: { name: "Ada" }, value: "x" },
      on: recording("picked"),
    });
    const field = (label: string) =>
      container.querySelector<HTMLInputElement>(`[aria-label='${label}']`)!;
    await act(() => userEvent.fill(field("Owner"), "a"));
    await act(() => userEvent.click(button("Pick")));
    await mounted.rerender({ owner: { name: "Bo" }, value: "y" });
    await act(() => userEvent.fill(field("Owner"), "b"));
    await act(() => userEvent.fill(field("Value"), "c"));
    await act(() => userEvent.click(button("Pick")));
    // Each field's change fires as the next action moves the focus away from it.
    expect(events).toEqual([
      ["picked", "Ada"],
      ["picked", "Ada"],
      ["picked", "Bo"],
      ["picked", "y"],
      ["picked", "Bo"],
    ]);
    expect(logged).toEqual([]);
  });

  describe("under StrictMode", () => {
    it("keeps an onMounted timer running, and stops it at unmount", async () => {
      await startStrict(await component("Ticker"), ["mounted", "tick", "unmounted"]);
      const ticks = () => events.filter(([name]) => name === "tick").length;
      await vi.waitFor(() => expect(ticks()).toBeGreaterThanOrEqual(2));
      await mounted!.unmount();
      mounted = undefined;
      const count = events.length;
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(events).toHaveLength(count);
    });

    it("leaves an immediate watcher joined, and runs its cleanup on a change and at unmount", async () => {
      await startStrict(await component("Channel"), ["join", "leave"]);
      // StrictMode runs the effect, its cleanup and the effect again: the steady state is joined.
      expect(events.at(-1)).toEqual(["join", "general"]);
      await act(() => userEvent.click(button("general")));
      expect(events.slice(-2)).toEqual([
        ["leave", "general"],
        ["join", "random"],
      ]);
      await mounted!.unmount();
      mounted = undefined;
      expect(events.at(-1)).toEqual(["leave", "random"]);
      const balance = (name: string) => events.filter(([, value]) => value === name).length % 2;
      expect([balance("general"), balance("random")]).toEqual([0, 0]);
    });

    it("runs the cleanups of a watcher and a watchEffect that wait for a pre watcher's writes, as many times as their callbacks", async () => {
      await startStrict(await component("Settle"), ["log"]);
      const log = () => events.map(([, entry]) => String(entry));
      // StrictMode runs the effects, their cleanups and the effects again: the steady state ran.
      expect(log().at(-1)).toBe('effect 0 for "" 0');
      await act(() => userEvent.click(button("Search")));
      await act(() => userEvent.click(button("Clear")));
      expect(log().slice(-5)).toEqual([
        "post  vue 2",
        'effect cleanup 0 for ""',
        'effect 2 for "vue" 2',
        'effect cleanup 2 for "vue"',
        'effect 0 for "vue" 0',
      ]);
      await mounted!.unmount();
      mounted = undefined;
      expect(log().slice(-3)).toEqual([
        "post cleanup vue",
        'effect cleanup 0 for "vue"',
        "unmounted",
      ]);
      const runs = (prefix: string) => log().filter((entry) => entry.startsWith(prefix)).length;
      expect(runs("effect cleanup")).toBe(runs("effect ") - runs("effect cleanup"));
      expect(runs("post cleanup")).toBe(runs("post ") - runs("post cleanup"));
    });

    it("runs a watcher once per change", async () => {
      await startStrict(await component("Watcher"), ["ran", "cleaned"]);
      await act(() => userEvent.click(button("Twice")));
      expect(events).toEqual([["ran", 2, 0]]);
    });
  });

  // An app renders without `act`, which drains every update before a promise's continuation
  // runs: these mount with `createRoot` alone and click as a user does.
  describe("outside act", () => {
    it("resolves nextTick once the writes before it, and those of the watchers they run, render", async () => {
      const root = createRoot(container);
      try {
        root.render(createElement(await component("Ready"), props("shown", "measured")));
        await vi.waitFor(() => expect(events).toHaveLength(1));
        await userEvent.click(button("Bump"));
        await vi.waitFor(() => expect(events).toHaveLength(2));
        await userEvent.click(button("Bump"));
        await vi.waitFor(() => expect(events).toHaveLength(3));
        expect(events).toEqual([
          ["shown", "Ready"],
          ["measured", "2"],
          ["measured", "4"],
        ]);
        expect(logged).toEqual([]);
      } finally {
        root.unmount();
      }
    });

    it("starts every listener of an event in its dispatch, after an async one awaits", async () => {
      const root = createRoot(container);
      const log = () => events.map(([, entry]) => entry);
      try {
        root.render(createElement(await component("AsyncPair"), props("log")));
        await vi.waitFor(() => expect(button("Save")).toBeDefined());
        await userEvent.click(button("Save"));
        await vi.waitFor(() => expect(log()).toContain("save done"));
        expect(log()).toEqual(["save start", "first click", "save done"]);
        events.length = 0;
        await userEvent.fill(container.querySelector<HTMLInputElement>("input")!, "Ada");
        await userEvent.keyboard("{Tab}");
        await vi.waitFor(() => expect(log()).toContain("change done"));
        expect(log()).toEqual(["change start", "change second", "change done"]);
        events.length = 0;
        // The link's second listener prevents the navigation, though the first one awaits.
        await userEvent.click(container.querySelector("a")!);
        await vi.waitFor(() => expect(log()).toContain("first done"));
        expect(log()).toEqual(["first", "held", "first done"]);
        expect(location.hash).toBe("");
      } finally {
        root.unmount();
        history.replaceState(null, "", location.pathname + location.search);
      }
    });

    it("runs post watchers and watchEffect once what pre watchers wrote has rendered, and each cleanup only before its next run", async () => {
      const root = createRoot(container);
      const log = () => events.map(([, entry]) => entry);
      try {
        root.render(createElement(await component("Settle"), props("log")));
        await vi.waitFor(() => expect(log()).toHaveLength(1));
        await userEvent.click(button("Search"));
        await vi.waitFor(() => expect(log()).toContain('effect 2 for "vue" 2'));
        await userEvent.click(button("Clear"));
        await vi.waitFor(() => expect(log()).toContain('effect 0 for "vue" 0'));
      } finally {
        root.unmount();
      }
      // Vue runs every watcher's cleanup as it stops the component's effects, then `onUnmounted`.
      expect(log()).toEqual([
        'effect 0 for "" 0',
        "post  vue 2",
        'effect cleanup 0 for ""',
        'effect 2 for "vue" 2',
        'effect cleanup 2 for "vue"',
        'effect 0 for "vue" 0',
        "post cleanup vue",
        'effect cleanup 0 for "vue"',
        "unmounted",
      ]);
      expect(logged).toEqual([]);
    });

    it("runs post watchers and watchEffect, and resumes after nextTick, when a pre watcher's writes end where they were", async () => {
      const root = createRoot(container);
      try {
        root.render(
          createElement(await component("Checked"), props("saved", "summary", "focused")),
        );
        await vi.waitFor(() => expect(events).toHaveLength(1));
        await userEvent.click(button("Suggest"));
        await vi.waitFor(() => expect(events.map(([name]) => name)).toContain("focused"), {
          timeout: 2000,
        });
        // As on Vue: the flag the pre watcher sets around its `await` is back where it was, and
        // nothing else it wrote changed, yet the post effects run and `nextTick` resolves.
        expect(events).toEqual([
          ["summary", "ada@example.com is valid"],
          ["saved", "ada@lovelace.dev"],
          ["summary", "ada@lovelace.dev is valid"],
          ["focused", "Email"],
        ]);
        expect(document.activeElement).toBe(container.querySelector("input"));
        expect(logged).toEqual([]);
      } finally {
        root.unmount();
      }
    });

    it("runs post watchers and watchEffect when a pre watcher's writes end where they were, with no nextTick to wait", async () => {
      const root = createRoot(container);
      try {
        root.render(createElement(await component("CheckedPlain"), props("saved", "summary")));
        await vi.waitFor(() => expect(events).toHaveLength(1));
        await userEvent.click(button("Suggest"));
        await vi.waitFor(() => expect(events).toHaveLength(3));
        // A later commit would let them run late: none comes on its own.
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(events).toEqual([
          ["summary", "ada@example.com is valid"],
          ["saved", "ada@lovelace.dev"],
          ["summary", "ada@lovelace.dev is valid"],
        ]);
        expect(logged).toEqual([]);
      } finally {
        root.unmount();
      }
    });

    it("resumes after nextTick when a watcher's writes end where they were, with no effect waiting", async () => {
      const root = createRoot(container);
      try {
        root.render(createElement(await component("TickFlag"), props("focused")));
        await vi.waitFor(() => expect(button("Suggest")).toBeDefined());
        await userEvent.click(button("Suggest"));
        await vi.waitFor(() => expect(events).toEqual([["focused", "Email"]]), { timeout: 2000 });
        expect(document.activeElement).toBe(container.querySelector("input"));
      } finally {
        root.unmount();
      }
    });

    it("reads a state a handler writes after its write, under a condition on that state that narrows nothing", async () => {
      const root = createRoot(container);
      try {
        root.render(createElement(await component("Pager"), props("moved")));
        await vi.waitFor(() => expect(button("Next")).toBeDefined());
        await userEvent.click(button("Next"));
        await userEvent.click(button("Next"));
        await userEvent.click(button("Previous"));
        await userEvent.click(button("Remove two"));
        await vi.waitFor(() => expect(events).toHaveLength(4));
        // As on Vue: each emit carries the value the handler just wrote.
        expect(events).toEqual([
          ["moved", 2],
          ["moved", 3],
          ["moved", 2],
          ["moved", 0],
        ]);
      } finally {
        root.unmount();
      }
    });

    it("runs a listener that removes itself through the helper it calls, and the helper from a button", async () => {
      const root = createRoot(container);
      try {
        root.render(createElement(await component("Escapable"), props("closed")));
        await vi.waitFor(() => expect(button("Options")).toBeDefined());
        await userEvent.click(button("Options"));
        await userEvent.keyboard("{Escape}");
        await vi.waitFor(() => expect(events).toEqual([["closed", "escape"]]));
        await userEvent.keyboard("{Escape}");
        await userEvent.click(button("Options"));
        await userEvent.click(button("Close"));
        await userEvent.keyboard("{Escape}");
        await vi.waitFor(() => expect(events).toHaveLength(2));
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(events).toEqual([
          ["closed", "escape"],
          ["closed", "button"],
        ]);
        expect(logged).toEqual([]);
      } finally {
        root.unmount();
      }
    });

    it("resumes after nextTick in the task of the key that wrote, before the key's next event", async () => {
      const root = createRoot(container);
      try {
        root.render(createElement(await component("Editor"), props("focused", "renamed")));
        await vi.waitFor(() => expect(button("Rename")).toBeDefined());
        await userEvent.click(button("Rename"));
        await vi.waitFor(() => expect(events).toHaveLength(1));
        await userEvent.keyboard("Budget{Enter}");
        await vi.waitFor(() => expect(events).toHaveLength(4));
        // As on Vue: the focus is on the button before Enter's keypress, whose activation clicks
        // it, so the editor opens again.
        expect(events).toEqual([
          ["focused", "Name"],
          ["renamed", "Budget"],
          ["focused", "Rename"],
          ["focused", "Name"],
        ]);
        expect(container.querySelector("input")).not.toBeNull();
      } finally {
        root.unmount();
      }
    });

    it("resolves nextTick when its component unmounts with the writes before it", async () => {
      const root = createRoot(container);
      const type = await component("TickClose");
      const render = (open: boolean) =>
        root.render(
          open
            ? createElement(type, {
                onClose: () => render(false),
                onDone: (open: boolean) => void events.push(["done", open]),
              })
            : null,
        );
      try {
        render(true);
        await vi.waitFor(() => expect(button("Dismiss")).toBeDefined());
        await userEvent.click(button("Dismiss"));
        await vi.waitFor(() => expect(events).toEqual([["done", false]]));
        expect(container.childElementCount).toBe(0);
      } finally {
        root.unmount();
      }
    });

    it("runs a listener that returns early beside another of its event, each as written", async () => {
      const root = createRoot(container);
      const log = () => events.map(([, entry]) => entry);
      try {
        root.render(createElement(await component("Guards"), props("log")));
        await vi.waitFor(() => expect(button("Save")).toBeDefined());
        await userEvent.click(button("Save"));
        await userEvent.click(button("Tag"));
        await userEvent.click(button("Save"));
        await vi.waitFor(() => expect(log()).toHaveLength(2));
        const name = container.querySelector<HTMLInputElement>("input")!;
        await userEvent.fill(name, "Ada");
        await userEvent.keyboard("{Tab}");
        await userEvent.fill(name, "");
        await userEvent.keyboard("{Tab}");
        await userEvent.fill(name, "Bo");
        await userEvent.keyboard("{Tab}");
        await vi.waitFor(() => expect(log()).toHaveLength(5));
        expect(log()).toEqual(["first save", "saved 1", "named Ada", "first name Ada", "named Bo"]);
        expect(logged).toEqual([]);
      } finally {
        root.unmount();
      }
    });
  });
});
