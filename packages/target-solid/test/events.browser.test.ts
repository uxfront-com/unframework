// The mount adapter's listeners in Chromium (ADR-0050): a hand-written Solid component, as the
// target emits one, calls the `onChange` prop the adapter passes for the test's `change`
// listener; a rerender, which replaces the props, keeps it. Written with Solid's tagged
// templates, as the rerender test is.
import type { MountedComponent } from "@unframework/codegen";
import { createSignal, mergeProps } from "solid-js";
import html from "solid-js/html";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { mount } from "../src/toolchain/client.ts";

interface CounterProps {
  step?: number;
  onChange?: (value: number) => void;
}

/** A counter as the target emits one: a signal, and a handler that writes it and emits. */
function Counter(rawProps: CounterProps) {
  const props = mergeProps({ step: 1 }, rawProps);
  const [count, setCount] = createSignal(0);
  const add = () => {
    setCount(count() + props.step);
    props.onChange?.(count());
  };
  return html`<div>
    <p role="status">${count}</p>
    <button type="button" onClick=${add}>Add</button>
  </div>`;
}

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
});

it("passes the test's listeners as event props, and keeps them across a rerender", async () => {
  const changes: unknown[][] = [];
  mounted = await mount(Counter, container, {
    on: { change: (...args) => void changes.push(args) },
  });
  const button = container.querySelector("button")!;
  await userEvent.click(button);
  await mounted.settle();
  await mounted.rerender({ step: 5 });
  await userEvent.click(button);
  await mounted.settle();
  expect(container.querySelector("p")?.textContent).toBe("6");
  expect(changes).toEqual([[1], [6]]);
  expect(logged).toEqual([]);
});
