// The mount adapter's listeners in Chromium (ADR-0050): a hand-written Svelte component
// (./fixtures/Counter.svelte) calls the `onchange` callback prop the adapter passes for the
// test's `change` listener, and `onvaluechange` for `valueChange`; a rerender, which replaces
// the props, keeps them.
import type { MountedComponent } from "@unframework/codegen";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { mount } from "../src/toolchain/client.ts";
import Counter from "./fixtures/Counter.svelte";

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

it("passes the test's listeners as lower-case callback props, kept across a rerender", async () => {
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
  expect(logged).toEqual([]);
});
