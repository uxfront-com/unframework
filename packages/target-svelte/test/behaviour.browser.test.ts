// What the Svelte output does in Chromium (ADR-0045 to ADR-0049): the fixtures are the
// emitter's output for the M2 shapes (emit.test.ts pins them), mounted by the toolchain's adapter
// with the test's listeners. Setup runs once, a read after a write sees it, a watcher calls back
// once per run with the previous value and cleans up before its next call and at unmount, effects
// and hooks run in the browser after mount, listeners keep their options and their order, a
// template ref is empty once its element is gone, and nothing is logged.
import type { MountedComponent } from "@unframework/codegen";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { mount } from "../src/toolchain/client.ts";
import Chip from "./fixtures/Chip.svelte";
import Closing from "./fixtures/Closing.svelte";
import Disclosure from "./fixtures/Disclosure.svelte";
import Pager from "./fixtures/Pager.svelte";
import Panel from "./fixtures/Panel.svelte";
import Stepper from "./fixtures/Stepper.svelte";
import Ticker from "./fixtures/Ticker.svelte";
import WatchEdges from "./fixtures/WatchEdges.svelte";

const logged: unknown[][] = [];
let container: HTMLElement;
let mounted: MountedComponent | undefined;

beforeEach(() => {
  logged.length = 0;
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
  expect(logged).toEqual([]);
});

/** Listeners for the given events, each recording its argument lists, and every emit in order. */
function listen<Name extends string>(...names: Name[]) {
  const emitted = Object.fromEntries(names.map((name) => [name, []])) as unknown as Record<
    Name,
    unknown[][]
  >;
  const order: Name[] = [];
  const on = Object.fromEntries(
    names.map((name) => [
      name,
      (...args: unknown[]) => {
        emitted[name].push(args);
        order.push(name);
      },
    ]),
  ) as Record<Name, (...args: unknown[]) => void>;
  return { emitted, order, on };
}

/** Clicks a button by its text, then lets the component settle. */
async function click(text: string): Promise<void> {
  const button = [...container.querySelectorAll("button")].find(
    (each) => each.textContent === text,
  );
  if (!button) throw new Error(`No button "${text}".`);
  await userEvent.click(button);
  await mounted!.settle();
}

const text = (selector: string) => container.querySelector(selector)?.textContent;

describe("state", () => {
  it("seeds state from a prop once, reads it right after a write, and emits", async () => {
    const { emitted, on } = listen("change", "cleared");
    mounted = await mount(Stepper, container, { props: { initial: 2, step: 3 }, on });
    expect(text("output")).toBe("2");
    expect(container.querySelector(".stepper")?.getAttribute("data-parity")).toBe("even");
    await click("+3");
    await click("+3");
    expect(text("output")).toBe("8");
    expect(text("span")).toBe("Big");
    expect([...container.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["5", "8"]);
    expect(emitted.change).toEqual([
      [5, 1],
      [8, 2],
    ]);
    // A new seed does not reach the state; a new step does.
    await mounted.rerender({ initial: 10, step: 5 });
    expect(text("output")).toBe("8");
    await click("+5");
    expect(text("output")).toBe("13");
    expect(container.querySelector(".stepper")?.getAttribute("data-parity")).toBe("odd");
    await click("Reset");
    expect(text("output")).toBe("0");
    expect(emitted.cleared).toEqual([[]]);
  });

  it("calls a callback prop through the props object", async () => {
    const { emitted, on } = listen("remove");
    mounted = await mount(Chip, container, { props: { label: "Ada" }, on });
    await click("Ada");
    expect(emitted.remove).toEqual([["Ada"]]);
  });
});

describe("watchers", () => {
  it("calls back once per run with the previous value, and cleans up before the next call", async () => {
    const { emitted, on } = listen("turn", "left", "span", "range", "resize");
    // What the page shows when the post watcher calls back.
    let rendered: string | null | undefined;
    const range = on.range;
    on.range = (...args: unknown[]) => {
      range(...args);
      rendered = text("p");
    };
    mounted = await mount(Pager, container, { props: { size: 20 }, on });
    // Only the immediate watcher calls back at mount, with no previous value.
    expect(emitted).toEqual({ turn: [], left: [], span: [], range: [], resize: [[20, undefined]] });
    await click("Next");
    expect(emitted.turn).toEqual([[2, 1]]);
    expect(emitted.left).toEqual([]);
    await click("Next");
    expect(emitted.turn).toEqual([
      [2, 1],
      [3, 2],
    ]);
    expect(emitted.left).toEqual([[2]]);
    // Two writes in one handler: the array watcher calls back once, after the DOM updated; the
    // getter's value is the same, so its watcher does not call back.
    await click("Shift");
    expect(emitted.range).toEqual([[10, 20]]);
    expect(rendered).toBe("Page 3, 10 to 20 of 20");
    expect(emitted.span).toEqual([]);
    await mounted.rerender({ size: 30 });
    expect(emitted.resize).toEqual([
      [20, undefined],
      [30, 20],
    ]);
    await mounted.unmount();
    mounted = undefined;
    expect(emitted.left).toEqual([[2], [3]]);
  });
});

describe("watchers at their edges", () => {
  it("calls an immediate array watcher with [] first, and an async callback after its await", async () => {
    const { emitted, on } = listen("pair", "total");
    mounted = await mount(WatchEdges, container, { on });
    // `[before]` of the first call's `[]` is undefined: `before ?? 0`.
    expect(emitted.pair).toEqual([[1, 2, 0]]);
    await click("1 2 0");
    expect(emitted.pair).toEqual([
      [1, 2, 0],
      [2, 2, 1],
    ]);
    await expect.poll(() => emitted.total).toEqual([[2]]);
  });

  it("tracks what an async watchEffect reads before its await, and cleans up before each run", async () => {
    const { emitted, on } = listen("pair", "total", "seen", "unseen");
    mounted = await mount(WatchEdges, container, { on });
    await expect.poll(() => emitted.seen).toEqual([[1]]);
    await click("1 2 0");
    await expect.poll(() => emitted.seen).toEqual([[1], [2]]);
    expect(emitted.unseen).toEqual([[1]]);
    await mounted.unmount();
    mounted = undefined;
    expect(emitted.unseen).toEqual([[1], [2]]);
  });
});

describe("effects and lifecycle", () => {
  it("runs every cleanup before an onUnmounted hook declared before its watcher, as Vue does", async () => {
    const { emitted, on } = listen("step");
    mounted = await mount(Closing, container, { on });
    await click("Type");
    expect(emitted.step).toEqual([["watch cleanup "], ["effect cleanup "]]);
    emitted.step.length = 0;
    await mounted.unmount();
    mounted = undefined;
    expect(emitted.step).toEqual([
      ["effect cleanup a"],
      ["watch cleanup a"],
      ["unmounted"],
      ["closed"],
    ]);
  });

  it("runs effects and hooks after mount, cleans up before each run and at unmount", async () => {
    const { emitted, on } = listen("title", "released", "ready", "stopped");
    mounted = await mount(Ticker, container, { props: { label: "A" }, on });
    expect(emitted.title).toEqual([["A: 0"], ["A"]]);
    expect(emitted.ready).toEqual([[2]]);
    await expect.poll(() => text("li:last-child"), { timeout: 3000 }).toBe("1");
    expect(emitted.title).toEqual([["A: 0"], ["A"], ["A: 1"]]);
    expect(emitted.released).toEqual([["A: 0"]]);
    await mounted.rerender({ label: "B" });
    // Both effects rerun; the order of different effects is not the contract's (ADR-0048).
    expect(emitted.released).toHaveLength(3);
    expect(emitted.released).toEqual(expect.arrayContaining([["A"], ["A: 1"]]));
    await mounted.unmount();
    mounted = undefined;
    expect(emitted.stopped).toEqual([[]]);
    const titles = emitted.title.length;
    // The interval is cleared: no tick comes after unmount.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(emitted.title).toHaveLength(titles);
  });

  // The adapter assigns only the props that changed, as a parent does: re-assigning a callback
  // prop no code read yet would hand the teardown Svelte's value from before the flush,
  // `undefined` (`props.svelte.ts`).
  it("calls a callback prop from a teardown that runs on the first rerender", async () => {
    const { emitted, on } = listen("title", "released", "ready", "stopped");
    mounted = await mount(Ticker, container, { props: { label: "A" }, on });
    await mounted.rerender({ label: "B" });
    expect(emitted.released).toHaveLength(2);
    expect(emitted.released).toEqual(expect.arrayContaining([["A"], ["A: 0"]]));
    expect(emitted.title).toHaveLength(4);
    expect(emitted.title).toEqual(expect.arrayContaining([["B"], ["B: 0"]]));
  });
});

describe("listeners", () => {
  it("keeps the phases, the once option and the order of one element's listeners", async () => {
    mounted = await mount(Panel, container, {});
    await click("Go");
    expect(text("p")).toBe("capture, button 0, once, bubble");
    await click("Go");
    expect(text("p")).toBe("capture, button 0, once, bubble, capture, button 0, bubble");
  });

  // `on` runs the handlers Svelte delegated below the element inside its own listener: a click
  // the button stopped still reaches the section's listener, which must not be used up by it.
  it("keeps a container's once listener for the first click a descendant does not stop", async () => {
    mounted = await mount(Panel, container, {});
    await click("Stop");
    expect(text("p")).toBe("capture, stopped");
    await click("Pass");
    expect(text("p")).toBe("capture, stopped, capture, passed, claimed, bubble");
    await click("Pass");
    expect(text("p")).toBe(
      "capture, stopped, capture, passed, claimed, bubble, capture, passed, bubble",
    );
  });

  it("listens to wheel passively and to touchstart actively, as the DOM does", async () => {
    // The spy calls through: it records each listener's element and options.
    const spy = vi.spyOn(EventTarget.prototype, "addEventListener");
    mounted = await mount(Panel, container, {});
    const options = (event: string) =>
      spy.mock.calls.find(
        ([type], index) =>
          type === event && container.contains(spy.mock.contexts[index] as Node | null),
      )?.[2];
    expect(options("wheel")).toEqual({ passive: true });
    expect(options("touchstart")).toEqual({});
    const panel = container.querySelector("p")!.parentElement!;
    panel.dispatchEvent(new WheelEvent("wheel", { deltaY: 100, bubbles: true }));
    panel.dispatchEvent(new AnimationEvent("animationcancel", { bubbles: true }));
    await mounted.settle();
    expect(text("p")).toBe("wheel 100, cancelled");
  });

  it("reads a field's value through an Event handler, and a key through an inline one", async () => {
    mounted = await mount(Panel, container, {});
    const field = container.querySelector("input")!;
    await userEvent.type(field, "hi{Enter}");
    await mounted.settle();
    expect(text("p")).toBe("hi");
  });
});

describe("template refs and ids", () => {
  it("reads the DOM after nextTick, and finds a ref empty once its element is gone", async () => {
    const { emitted, on } = listen("toggled");
    mounted = await mount(Disclosure, container, { on });
    await click("Toggle");
    expect(emitted.toggled).toEqual([[2]]);
    expect(document.activeElement).toBe(container.querySelector("input"));
    await click("Toggle");
    expect(emitted.toggled).toEqual([[2], [0]]);
  });

  it("ties ids from one $props.id(), each starting uf-id- and ending in its own suffix", async () => {
    mounted = await mount(Disclosure, container, {});
    const field = container.querySelector("input")!;
    expect(field.id).toMatch(/^uf-id-.+-0$/);
    expect(container.querySelector("label")?.getAttribute("for")).toBe(field.id);
    const controls = container.querySelector("button")!.getAttribute("aria-controls");
    expect(controls).toBe(field.id.replace(/-0$/, "-1"));
    // The source's `${fieldId}-1` never spells the second id.
    expect(`${field.id}-1`).not.toBe(controls);
    await click("Toggle");
    expect(container.querySelector("ul")?.id).toBe(controls);
  });
});
