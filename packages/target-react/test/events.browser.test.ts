// The mount adapter's listeners and interactions in Chromium (ADR-0050): a hand-written React
// component, as the target emits one, calls the `onChange` prop the adapter passes for the
// test's `change` listener, on the first render and after a rerender; a click run through
// `interact` is flushed when it resolves; and an update an async handler makes after `act` has
// ended renders without React reporting it, because the adapter declares the act environment
// only around its own `act` calls.
import type { MountedComponent } from "@unframework/codegen";
import { createElement, useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { mount } from "../src/toolchain/client.ts";

interface CounterProps {
  step?: number;
  onChange?: (value: number) => void;
}

/** A counter as the target emits one: state, a handler that writes and emits, an event prop. */
function Counter({ step = 1, onChange }: CounterProps) {
  const [count, setCount] = useState(0);
  return createElement(
    "div",
    null,
    createElement("p", { role: "status" }, count),
    createElement(
      "button",
      {
        type: "button",
        onClick: () => {
          const next = count + step;
          setCount(next);
          onChange?.(next);
        },
      },
      "Add",
    ),
    createElement(
      "button",
      {
        type: "button",
        onClick: async () => {
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
          setCount(100);
          onChange?.(100);
        },
      },
      "Later",
    ),
  );
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

const status = () => container.querySelector("p")?.textContent;
const button = (name: string) =>
  [...container.querySelectorAll("button")].find((element) => element.textContent === name)!;

it("passes the test's listeners as event props, and keeps them across a rerender", async () => {
  const changes: unknown[][] = [];
  mounted = await mount(Counter, container, {
    on: { change: (...args) => void changes.push(args) },
    events: [{ name: "change", optional: [false] }],
  });
  await mounted.interact!(() => userEvent.click(button("Add")));
  // Flushed by the `act` the action ran in: no waiting.
  expect(status()).toBe("1");
  await mounted.rerender({ step: 5 });
  await mounted.interact!(() => userEvent.click(button("Add")));
  expect(status()).toBe("6");
  expect(changes).toEqual([[1], [6]]);
  expect(logged).toEqual([]);
});

it("declares the act environment only inside its own act calls", async () => {
  const changes: unknown[][] = [];
  mounted = await mount(Counter, container, {
    on: { change: (...args) => void changes.push(args) },
  });
  expect(Reflect.get(globalThis, "IS_REACT_ACT_ENVIRONMENT")).toBe(false);
  await mounted.interact!(() => userEvent.click(button("Later")));
  // The handler's write lands after `act` resolved, on React's own scheduler.
  await vi.waitFor(() => expect(status()).toBe("100"));
  await mounted.settle();
  expect(changes).toEqual([[100]]);
  expect(Reflect.get(globalThis, "IS_REACT_ACT_ENVIRONMENT")).toBe(false);
  // React reports no update outside `act`: the flag was off when it happened.
  expect(logged).toEqual([]);
});
