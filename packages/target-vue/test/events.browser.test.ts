// The mount adapter's listeners in Chromium (ADR-0050): a hand-written Vue component that
// declares its events, as the target emits one, reaches the test's `change` listener through the
// `onChange` the adapter passes beside the props; a rerender, which replaces the props, keeps it.
import type { MountedComponent } from "@unframework/codegen";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineComponent, h, ref } from "vue";

import { mount } from "../src/toolchain/client.ts";

/** A counter as the target emits one: state, a handler that writes and emits a declared event. */
const Counter = defineComponent({
  props: { step: { type: Number, default: 1 } },
  emits: { change: (_value: number) => true, valueChange: (_value: number) => true },
  setup(props, { emit }) {
    const count = ref(0);
    return () =>
      h("div", [
        h("p", { role: "status" }, String(count.value)),
        h(
          "button",
          {
            type: "button",
            onClick: () => {
              count.value += props.step;
              emit("change", count.value);
              emit("valueChange", count.value);
            },
          },
          "Add",
        ),
      ]);
  },
});

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

it("passes the test's listeners beside the props, and keeps them across a rerender", async () => {
  const changes: unknown[][] = [];
  const values: unknown[][] = [];
  mounted = await mount(Counter, container, {
    on: {
      change: (...args) => void changes.push(args),
      valueChange: (...args) => void values.push(args),
    },
  });
  const button = container.querySelector("button")!;
  await userEvent.click(button);
  await mounted.settle();
  await mounted.rerender({ step: 5 });
  await userEvent.click(button);
  await mounted.settle();
  expect(container.querySelector("p")?.textContent).toBe("6");
  expect(changes).toEqual([[1], [6]]);
  expect(values).toEqual([[1], [6]]);
  // A declared event's listener is no attribute of the root.
  expect(container.firstElementChild?.getAttributeNames()).toEqual([]);
  expect(logged).toEqual([]);
});
