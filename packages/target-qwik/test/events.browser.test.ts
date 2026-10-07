// The mount adapter's listeners and interactions in Chromium (ADR-0050): a hand-written Qwik
// component (./fixtures/Emitter.tsx), compiled by the optimizer like the output, whose click
// handler is a lazily loaded segment, calls the `onChange$` QRL the adapter passes for the
// test's `change` listener; a click run through `interact` has loaded and run the handler, and
// the render it scheduled settles with `settle()`; a rerender, which replaces the props, keeps
// the listener.
import type { MountedComponent } from "@unframework/codegen";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { mount } from "../src/toolchain/client.ts";

/** The fixture's component, compiled by the optimizer (a computed path: not this tsconfig's). */
const load = async (name: string): Promise<{ default: unknown }> =>
  import(`./fixtures/${name}.tsx`);
const Emitter = (await load("Emitter")).default;

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

it("passes the test's listeners as QRL props, and waits for the handlers an action loads", async () => {
  const changes: unknown[][] = [];
  mounted = await mount(Emitter, container, {
    on: { change: (...args) => void changes.push(args) },
  });
  // A locator, as the testing API acts on: Vitest builds no selector for an element that carries
  // Qwik's `:` attribute.
  const add = page.getByRole("button", { name: "Add" });
  await mounted.interact!(() => userEvent.click(add));
  await mounted.settle();
  // No retrying: the handler's segment loaded and ran before `interact` resolved.
  expect(container.querySelector("p")?.textContent).toBe("1");
  expect(changes).toEqual([[1]]);
  await mounted.rerender({ step: 5 });
  await mounted.interact!(() => userEvent.click(add));
  await mounted.settle();
  expect(container.querySelector("p")?.textContent).toBe("6");
  expect(changes).toEqual([[1], [6]]);
  // The handlers are the component's own again once the action is done.
  const button = container.querySelector("button") as { _qDispatch?: Record<string, unknown> };
  expect(typeof button._qDispatch?.["e:click"]).toBe("function");
  expect(logged).toEqual([]);
});
