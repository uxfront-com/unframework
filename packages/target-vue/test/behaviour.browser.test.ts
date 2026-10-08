// What the Vue output does in Chromium (ADR-0045 to ADR-0049): the components this target emits
// for ./behaviour-sources.ts, compiled by @vitejs/plugin-vue and mounted by the toolchain's
// adapter, keep the semantics contract the corpus relies on Vue, the reference, to define. Each
// test also fails on any warning or error Vue logs.
import type { MountedComponent } from "@unframework/codegen";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { mount } from "../src/toolchain/client.ts";
import { components } from "./behaviour-manifest.ts";

const logged: unknown[][] = [];
let container: HTMLElement;
let mounted: MountedComponent | undefined;
let unmounted = false;
/** Every emit the test listened to, in order, as `[event, ...args]`. */
let events: unknown[][] = [];

beforeEach(() => {
  logged.length = 0;
  events = [];
  unmounted = false;
  vi.spyOn(console, "warn").mockImplementation((...args) => void logged.push(args));
  vi.spyOn(console, "error").mockImplementation((...args) => void logged.push(args));
  container = document.createElement("div");
  document.body.append(container);
});

afterEach(async () => {
  if (!unmounted) await mounted?.unmount();
  mounted = undefined;
  container.remove();
  vi.restoreAllMocks();
  expect(logged).toEqual([]);
});

/** Mounts a behaviour component, listening to `names`; returns what its events log. */
async function render(
  name: string,
  names: readonly string[],
  props: Record<string, unknown> = {},
): Promise<MountedComponent> {
  const { default: component } = await components[name]!();
  mounted = await mount(component, container, {
    props,
    on: Object.fromEntries(
      names.map((event) => [event, (...args: unknown[]) => void events.push([event, ...args])]),
    ),
  });
  return mounted;
}

/** Clicks the button named `name`, then settles. */
async function click(name: string): Promise<void> {
  const button = [...container.querySelectorAll("button")].find(
    (each) => each.textContent === name,
  );
  if (!button) throw new Error(`No button is named ${name}.`);
  await userEvent.click(button);
  await mounted!.settle();
}

/** The listeners' log, which the component renders in its paragraph. */
function text(): string | null | undefined {
  return container.querySelector("p")?.textContent;
}

/** The events logged since the last call. */
function taken(): unknown[][] {
  return events.splice(0);
}

/**
 * Events in a stable order, for the runs whose order across watchers is not part of the
 * contract (ADR-0048).
 */
function sorted(run: readonly unknown[][]): unknown[][] {
  return run.toSorted((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1));
}

describe("reads after writes (Tally)", () => {
  it("reads a ref and a computed right after writing in one handler", async () => {
    await render("Tally", ["report"]);
    await click("Add two");
    expect(taken()).toEqual([
      ["report", "count", 2],
      ["report", "doubled", 4],
    ]);
    expect(container.querySelector("output")?.textContent).toBe("2");
  });

  it("sees the updated DOM after `await nextTick()`, and reads the latest value after it", async () => {
    await render("Tally", ["report"]);
    await click("Add later");
    expect(taken()).toEqual([
      ["report", "rendered", 1],
      ["report", "after await", 2],
    ]);
    expect(container.querySelector("output")?.textContent).toBe("2");
  });
});

describe("watchers (Watchers)", () => {
  const names = ["counted", "cleanup", "pair", "parity", "items", "effect"];

  it("runs an immediate watcher during setup, and `watchEffect` once the component mounted", async () => {
    await render("Watchers", names);
    expect(taken()).toEqual([
      ["parity", true],
      ["effect", 0],
    ]);
  });

  it("runs each watcher once for two writes in one handler, with the previous value at its last run", async () => {
    await render("Watchers", names);
    taken();
    await click("Add two");
    // The relative order of different watchers is not part of the contract (ADR-0048): sorted.
    expect(sorted(taken())).toEqual(
      sorted([
        ["counted", 2, 0],
        ["pair", 2, 0],
        ["items", 2],
        ["effect", 2],
      ]),
    );
    await click("Add two");
    expect(sorted(taken())).toEqual(
      sorted([
        ["cleanup", 2],
        ["counted", 4, 2],
        ["pair", 4, 0],
        ["items", 4],
        ["effect", 4],
      ]),
    );
  });

  it("runs a cleanup right before its watcher's next callback, and at unmount", async () => {
    await render("Watchers", names);
    await click("Add two");
    await click("Add two");
    const run = taken();
    const second = run.findIndex(([name, value]) => name === "counted" && value === 4);
    expect(run.findIndex(([name]) => name === "cleanup")).toBe(second - 1);
    await mounted!.unmount();
    unmounted = true;
    expect(taken()).toEqual([["cleanup", 4]]);
  });

  it("skips a watcher whose source did not change, and fires an array source for any element", async () => {
    await render("Watchers", names);
    taken();
    await click("Touch other");
    expect(taken()).toEqual([["pair", 0, 1]]);
  });

  it("reads the updated DOM in a post watcher", async () => {
    await render("Watchers", names);
    await click("Add two");
    expect(taken().filter(([name]) => name === "items")).toEqual([["items", 2]]);
    expect(container.querySelectorAll("li")).toHaveLength(2);
  });
});

describe("lifecycle (Lifecycle)", () => {
  it("runs `onMounted` once the DOM is in the document, and `onUnmounted` once removed", async () => {
    await render("Lifecycle", ["mounted", "ticked", "unmounted"], { interval: 20 });
    expect(taken()).toEqual([["mounted", true]]);
    await expect.poll(() => events.length).toBeGreaterThanOrEqual(2);
    await mounted!.unmount();
    unmounted = true;
    const run = taken();
    expect(run.at(-1)).toEqual(["unmounted"]);
    expect(run.slice(0, -1).map(([name]) => name)).toEqual(run.slice(0, -1).map(() => "ticked"));
    // Only proves that nothing more comes once the interval is cleared.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(taken()).toEqual([]);
  });
});

describe("listeners (Listeners)", () => {
  it("runs a capture listener before the target's, and a bubble listener after", async () => {
    await render("Listeners", ["logged"]);
    await click("Inside");
    expect(text()).toBe("capture, target, bubble");
  });

  it("stops propagation through `.stop`, before the handler", async () => {
    await render("Listeners", ["logged"]);
    await click("Stop");
    expect(text()).toBe("capture, stopped");
  });

  it("runs a once listener once", async () => {
    await render("Listeners", ["logged"]);
    await click("Once");
    await click("Once");
    expect(text()).toBe("once");
  });

  it("passes the event to an inline arrow, and runs a handler the template cannot hold", async () => {
    await render("Listeners", ["logged"]);
    await click("Read the event");
    await click("Report");
    expect(taken()).toEqual([["logged", ["named", "hoisted"]]]);
  });

  it("listens to the wheel passively", async () => {
    await render("Listeners", ["logged"]);
    const group = container.querySelector<HTMLElement>('[role="group"]')!;
    const wheel = new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true });
    group.dispatchEvent(wheel);
    await mounted!.settle();
    expect(group.querySelector("output")?.textContent).toBe("1");
    // A passive listener cannot prevent the default (its `preventDefault()` does nothing).
    expect(wheel.defaultPrevented).toBe(false);
  });
});

describe("template refs and ids (Refs)", () => {
  it("sets a ref keyed by its binding's name, and empties it once its element is removed", async () => {
    await render("Refs", ["present", "focused"]);
    await click("Focus");
    expect(document.activeElement).toBe(container.querySelector("input"));
    await click("Toggle");
    await click("Toggle");
    expect(taken().slice(1)).toEqual([
      ["present", false],
      ["present", true],
    ]);
  });

  it("gives each instance its own id, with the generated prefix", async () => {
    await render("Refs", ["present", "focused"]);
    await click("Focus");
    const [[, id] = []] = taken();
    expect(id).toMatch(/^uf-id-/);
    expect(container.querySelector("label")?.getAttribute("for")).toBe(id);
    expect(container.querySelector("input")?.getAttribute("id")).toBe(id);
  });
});

describe("state that holds an object (Identity)", () => {
  const fruits = [
    { id: "a", name: "Apple" },
    { id: "b", name: "Banana" },
  ];

  it("holds the source's own object: identity with a prop's item, and structuredClone", async () => {
    // The adapter passes props from a shallow object, as a parent's `shallowRef` would: the
    // items are the caller's own objects.
    await render("Identity", ["same", "cloned", "moved"], { fruits });
    await click("Banana");
    expect(taken()).toEqual([
      ["same", true],
      ["moved", 1, false],
    ]);
    const pressed = [...container.querySelectorAll("li button")].map((button) =>
      button.getAttribute("aria-pressed"),
    );
    expect(pressed).toEqual(["false", "true"]);
    await click("Clone");
    expect(taken()).toEqual([["cloned", "M red"]]);
  });

  // Two writes in one handler that end on the value the state had change nothing: a watcher of
  // a `shallowRef` alone would call back (`forceTrigger`), one of its getter does not.
  it("calls a watcher of such a state alone back only when its value changed", async () => {
    await render("Reselect", ["chosen", "counted"], { fruits });
    await click("Apple");
    expect(taken()).toEqual([["chosen", "Apple"]]);
    await click("Apple");
    expect(taken()).toEqual([]);
    await click("Recount");
    expect(taken()).toEqual([]);
    await click("Banana");
    expect(taken()).toEqual([["chosen", "Banana"]]);
  });

  it("calls an array watcher over such a state back only when a value changed", async () => {
    await render("Identity", ["same", "cloned", "moved"], { fruits });
    // `count > 1` is still false: no source changed.
    await click("Count");
    expect(taken()).toEqual([]);
    await click("Count");
    expect(taken()).toEqual([["moved", 0, true]]);
  });
});
