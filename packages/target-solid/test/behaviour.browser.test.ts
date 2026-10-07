// What the setup's lowering does in Chromium (ADR-0045 to ADR-0049, the semantics contract v1):
// the fixtures are the emitter's own output for test/sources.ts (test/output.test.ts pins them),
// mounted by the toolchain's adapter with listeners for every event they declare. The corpus
// checks the same contract against Vue's traces; these pin the shapes that give it on Solid: the
// watchers' scheduler (one callback per synchronous run of client code, whatever its shape), the
// watcher helper's previous value and cleanups, `createWatchEffect`, `onMount` and its cleanup,
// template refs emptied with their element, options as native listeners.
import type { MountedComponent } from "@unframework/codegen";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { mount } from "../src/toolchain/client.ts";

/** A fixture's component, loaded by URL: its Solid TSX is not this package's to type-check. */
async function fixture(name: string): Promise<unknown> {
  const url = new URL(`./fixtures/${name}.tsx`, import.meta.url).href;
  const { default: component }: { default: unknown } = await import(/* @vite-ignore */ url);
  return component;
}

const logged: unknown[][] = [];
let container: HTMLElement;
let mounted: MountedComponent | undefined;
/** Every emit, in order, as `[event, ...payload]`. */
let events: unknown[][] = [];

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

/** Listeners that record every one of `names`' emits. */
function listeners(...names: string[]) {
  return Object.fromEntries(
    names.map((name) => [name, (...args: unknown[]) => void events.push([name, ...args])]),
  );
}

/** The emits since the last call, and clears them. */
function drain(): unknown[][] {
  const drained = events;
  events = [];
  return drained;
}

const button = (name: string) =>
  [...container.querySelectorAll("button")].find(
    (element) => element.textContent?.trim() === name,
  )!;

it("runs a watcher once per synchronous run of writes, only on a change, with its previous value", async () => {
  mounted = await mount(await fixture("Watchers"), container, {
    props: { label: "L" },
    on: listeners("queryRun", "pageRun", "left", "span", "labelled", "effect", "released"),
  });
  await mounted.settle();
  // The immediate watcher runs once at first, without a previous value; `watchEffect` runs once.
  expect(drain()).toEqual([
    ["labelled", "L", undefined],
    ["effect", " L"],
  ]);

  // Two writes in one handler: one callback, with the value before both.
  await userEvent.click(button("Boots"));
  await mounted.settle();
  expect(drain()).toEqual([
    ["queryRun", "boots", ""],
    ["released", " L"],
    ["effect", "boots L"],
  ]);

  // Written away and back in one run: no callback, and no cleanup, though `watchEffect`, which
  // tracks what it reads, runs again, as Vue's does.
  await userEvent.click(button("Boots"));
  await mounted.settle();
  expect(drain()).toEqual([
    ["released", "boots L"],
    ["effect", "boots L"],
  ]);

  // A getter's value, twice written: one callback.
  await userEvent.click(button("Turn"));
  await mounted.settle();
  expect(drain()).toEqual([["pageRun", 6, 2]]);

  // An array of sources: one callback for both writes, with the arrays before and after.
  await userEvent.click(button("Shift"));
  await mounted.settle();
  expect(drain()).toEqual([["span", [20, 60], [10, 50]]]);
  // One of them written away and back: nothing.
  await userEvent.click(button("Wobble"));
  await mounted.settle();
  expect(drain()).toEqual([]);

  // A prop the immediate watcher and `watchEffect` read.
  await mounted.rerender({ label: "M" });
  expect(drain()).toEqual([
    ["labelled", "M", "L"],
    ["released", "boots L"],
    ["effect", "boots M"],
  ]);

  // At unmount, each watcher's and effect's cleanups run.
  await mounted.unmount();
  mounted = undefined;
  expect(drain().toSorted((a, b) => String(a[0]).localeCompare(String(b[0])))).toEqual([
    ["left", "boots"],
    ["released", "boots M"],
  ]);
  expect(container.textContent).toBe("");
  expect(logged).toEqual([]);
});

it("keeps the DOM's order, phases and options for every listener", async () => {
  mounted = await mount(await fixture("Listeners"), container, { on: listeners("logged") });
  const log = () => container.querySelector("p")!.textContent.split(", ").filter(Boolean);
  // A capture listener runs before the target's, a container's bubble listener after it.
  await userEvent.click(button("Inside"));
  await mounted.settle();
  expect(log()).toEqual(["capture", "inside", "bubble"]);
  // `stopPropagation()` in a native target listener stops the container's.
  await userEvent.click(button("Stop"));
  await mounted.settle();
  expect(log().slice(3)).toEqual(["capture", "stopped"]);
  // A once listener runs once.
  await userEvent.click(button("Once"));
  await userEvent.click(button("Once"));
  await mounted.settle();
  expect(log().slice(5)).toEqual(["capture", "once", "bubble", "capture", "bubble"]);
  // Two listeners of one event on one element: the capture one (from its `ref`) first.
  await userEvent.click(button("Report"));
  await mounted.settle();
  expect(log().slice(10)).toEqual(["own capture", "report"]);
  expect(drain()).toEqual([["logged", [...log()]]]);
  // A passive wheel listener.
  const output = container.querySelector("output")!;
  await userEvent.hover(output);
  output.parentElement!.dispatchEvent(new WheelEvent("wheel", { deltaY: -10, bubbles: true }));
  await mounted.settle();
  expect(output.textContent).toBe("1");
  // `focus`, a key's capture and target listeners, `change` when the field commits, `blur`.
  const field = container.querySelector("input")!;
  await userEvent.click(field);
  await userEvent.keyboard("ab{Enter}");
  field.blur();
  await mounted.settle();
  expect(log().slice(12)).toEqual([
    "focus",
    "key capture",
    "key capture",
    "key capture",
    "enter",
    "change ab",
    "blur",
  ]);
  // A plain and a once listener of one event and phase run in attribute order, in either order
  // (both from the element's `ref` callback).
  await userEvent.click(button("Pair"));
  await userEvent.click(button("Pair"));
  await userEvent.click(button("Swap"));
  await userEvent.click(button("Swap"));
  await mounted.settle();
  expect(log().slice(19)).toEqual(["plain", "first", "plain", "first swap", "swap", "swap"]);
  expect(logged).toEqual([]);
});

/** Waits for timers and promise continuations the component started. */
const tasks = () => new Promise((resolve) => setTimeout(resolve, 20));

it("coalesces each synchronous run where it runs, and runs a post watcher after a pre watcher's render", async () => {
  mounted = await mount(await fixture("Runs"), container, {
    props: { label: "L" },
    on: listeners("moved", "rendered", "saved"),
  });
  await tasks();
  // The async `watchEffect` emits after its `await`; a continuation `onMounted` starts writes two
  // watched refs in one run: one callback.
  expect(drain()).toEqual([
    ["saved", "L "],
    ["moved", 1, 11],
  ]);

  // A pre watcher's write renders before the post watcher measures the list.
  await userEvent.click(button("Search"));
  await tasks();
  expect(drain().toSorted((a, b) => String(a[0]).localeCompare(String(b[0])))).toEqual([
    ["rendered", 2],
    ["saved", "L a"],
  ]);

  // A timer's callback writes both in one run.
  await userEvent.click(button("Later"));
  await tasks();
  expect(drain()).toEqual([["moved", 2, 12]]);

  // So does a promise continuation, which reads the latest values: its emit runs as it is made,
  // the watcher once the run ends.
  await userEvent.click(button("Chained"));
  await tasks();
  expect(drain()).toEqual([
    ["saved", "L 7"],
    ["moved", 7, 17],
  ]);

  // An async function's runs, one of which declares between its changes: one callback each.
  await userEvent.click(button("Save"));
  await tasks();
  expect(drain()).toEqual([
    ["moved", 8, 18],
    ["moved", 18, 25],
  ]);
  expect(container.querySelector("p")!.textContent).toBe("18-25");
  expect(logged).toEqual([]);
});

it("coalesces a run past an await, a try, a guard and a local arrow's calls, and tears down in Vue's order", async () => {
  mounted = await mount(await fixture("AsyncRuns"), container, {
    on: listeners("pair", "gone", "stopped"),
  });
  await tasks();
  expect(drain()).toEqual([]);
  const pairs = async (name: string) => {
    await userEvent.click(button(name));
    await tasks();
    return drain();
  };
  // A write of the awaited value and the write after it: one run, one callback each side.
  expect(await pairs("Fetched")).toEqual([
    ["pair", 1, 0],
    ["pair", 2, 10],
  ]);
  // The write after a `try` joins the run of the block's end, or of the `catch`'s.
  expect(await pairs("Tried")).toEqual([
    ["pair", 3, 10],
    ["pair", 4, 30],
  ]);
  expect(await pairs("Failed")).toEqual([
    ["pair", 3, 30],
    ["pair", 4, -1],
  ]);
  // A guard's return after a change, and the run past the guard: one callback each.
  expect(await pairs("Skipped")).toEqual([["pair", 5, 50]]);
  expect(await pairs("Guarded")).toEqual([
    ["pair", 5, 51],
    ["pair", 6, 51],
  ]);
  // A local arrow's two calls are one run with what follows them.
  expect(await pairs("Twice")).toEqual([
    ["pair", 8, 51],
    ["pair", 9, 52],
  ]);
  // A continuation's writes, read through `filter`'s callback.
  expect(await pairs("Filtered")).toEqual([["pair", 9, 2]]);
  await userEvent.click(button("Arm"));
  expect(await pairs("Halt")).toEqual([["stopped", 9]]);
  expect(container.querySelector("p")!.textContent).toBe("9/2");
  // Every watcher's and effect's cleanup, then the hooks in source order.
  await mounted.unmount();
  mounted = undefined;
  const gone = drain().map(([, what]) => what);
  expect(gone.slice(-2)).toEqual(["first", "last"]);
  expect(gone.slice(0, -2).toSorted((a, b) => String(a).localeCompare(String(b)))).toEqual([
    "effect 3",
    "watch 3",
  ]);
  expect(logged).toEqual([]);
});

it("calls a watcher back once per synchronous run of every shape, as Vue does", async () => {
  // Each step's emits are Vue 3.5's for the same source, run through the corpus harness on both
  // targets: one state per synchronous run (ADR-0048).
  mounted = await mount(await fixture("Coalesced"), container, { on: listeners("state", "saved") });
  await tasks();
  expect(drain()).toEqual([]);
  const step = async (name: string) => {
    await userEvent.click(button(name));
    await tasks();
    return drain();
  };
  // Two `x.value = await …` statements in one function.
  expect(await step("Load")).toEqual([
    ["state", "user", 0, false],
    ["state", "posts", 1, false],
    ["state", "done", 2, false],
  ]);
  // A validating guard after a change: one callback for both writes.
  expect(await step("Validate")).toEqual([["state", "Name is required", 2, false]]);
  // A guard's `return` returns from the function: no `saved` for an empty name.
  expect(await step("Save")).toEqual([["state", "", 2, false]]);
  expect(await step("Name")).toEqual([]);
  expect(await step("Save")).toEqual([
    ["state", "", 2, true],
    ["state", "", 2, false],
    ["saved", "Ada"],
  ]);
  // A payload declared before the awaited call, read after it.
  expect(await step("Submit")).toEqual([
    ["state", "", 2, true],
    ["state", "", 2, false],
    ["saved", "Ada"],
  ]);
  expect(await step("Validate")).toEqual([
    ["state", "", 2, true],
    ["saved", "Ada"],
    ["state", "", 2, false],
  ]);
  // An `await` that does not run when the value is cached: one run, one callback.
  expect(await step("Cached")).toEqual([
    ["state", "", 2, true],
    ["state", "", 3, false],
  ]);
  expect(await step("Clear")).toEqual([["state", "", 0, false]]);
  expect(await step("Cached")).toEqual([["state", "", 3, false]]);
  // A throw after a write in a `try`: the `catch`'s write joins the run, and the component lives.
  expect(await step("Check")).toEqual([["state", "invalid", 3, false]]);
  expect(container.querySelector("p")!.textContent).toBe("invalid 3 idle");
  expect(await step("Fix")).toEqual([]);
  expect(await step("Check")).toEqual([
    ["state", "checking", 5, false],
    ["state", "checked", 5, false],
  ]);
  expect(container.querySelector("p")!.textContent).toBe("checked 5 idle");
  // A callback parameter, and an object's arrows, called after an `await`.
  expect(await step("Busy")).toEqual([
    ["state", "checked", 5, true],
    ["state", "checked", 7, false],
  ]);
  expect(await step("Loud")).toEqual([["state", "DONE", 8, false]]);
  expect(await step("Quiet")).toEqual([["state", "done", 9, false]]);
  // A `catch` that returns, and the writes after the `try`.
  expect(await step("Report")).toEqual([
    ["state", "done", 9, true],
    ["saved", "3"],
    ["state", "done", 3, false],
  ]);
  expect(await step("Fail")).toEqual([
    ["state", "done", 3, true],
    ["state", "Error: no", 3, false],
  ]);
  // A statement whose `await` is not the first thing it evaluates.
  expect(await step("Sum")).toEqual([
    ["state", "summing", 3, false],
    ["state", "summed", 3, false],
  ]);
  expect(logged).toEqual([]);
});

it("narrows state in a branch and reads a branch's value in its handler", async () => {
  mounted = await mount(await fixture("NarrowedState"), container, {
    props: { member: { name: "Ada" } },
    on: listeners("picked"),
  });
  await mounted.settle();
  expect(container.textContent).toBe("NobodyAdaDraft");
  // The handler passes the branch's value: the member the branch shows.
  await userEvent.click(button("Ada"));
  await mounted.settle();
  expect(drain()).toEqual([["picked", "Ada"]]);
  await userEvent.click(button("Draft"));
  await mounted.settle();
  expect(container.textContent).toBe("AdaXAdaDraft");
  // A new member, through the same branch.
  await mounted.rerender({ member: { name: "Grace" } });
  await userEvent.click(button("Grace"));
  await mounted.settle();
  expect(drain()).toEqual([["picked", "Grace"]]);
  expect(container.textContent).toBe("GraceXGraceDraft");
  await mounted.rerender({});
  expect(container.textContent).toBe("GraceXDraft");
  expect(logged).toEqual([]);
});

it("runs lifecycle hooks in the browser, empties a template ref with its element, and coalesces between awaits", async () => {
  mounted = await mount(await fixture("Lifecycle"), container, {
    props: { title: "Title" },
    on: listeners("ready", "ticked", "toggled", "saved"),
  });
  await mounted.settle();
  // `onMounted` reads the element through its template ref, once it is in the document.
  expect(events[0]).toEqual(["ready", 5]);
  const heading = container.querySelector("h2")!;
  expect(heading.id).toMatch(/^uf-id-/);
  expect(container.querySelector("section")!.getAttribute("aria-labelledby")).toBe(heading.id);
  await expect.poll(() => events.filter(([name]) => name === "ticked").length).toBeGreaterThan(1);
  drain();

  // `nextTick`'s callback reads the DOM the write made: the list, then none once removed.
  await userEvent.click(button("Details"));
  await mounted.settle();
  await expect.poll(() => events.filter(([name]) => name === "toggled")).toEqual([["toggled", 2]]);
  await userEvent.click(button("Details"));
  await mounted.settle();
  await expect
    .poll(() => events.filter(([name]) => name === "toggled"))
    .toEqual([
      ["toggled", 2],
      ["toggled", 0],
    ]);

  // Each run between awaits calls back once; the last reads every write before it.
  await userEvent.click(button("Save"));
  await mounted.settle();
  await expect
    .poll(() => events.filter(([name]) => name === "saved"))
    .toEqual([["saved", 2, "saved 2"]]);
  expect(container.querySelector("p")!.textContent).toBe("1s saved 2");

  // `onUnmounted` clears the interval: no tick after the component is gone.
  await mounted.unmount();
  mounted = undefined;
  drain();
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(events).toEqual([]);
  expect(logged).toEqual([]);
});
