// The adapter's model of an app whose listeners have each run once (src/toolchain/loads.ts,
// ADR-0050), in Chromium, on a hand-written component compiled by the optimizer
// (./fixtures/FirstRun.tsx): the mount loads every segment of the component and resolves its
// QRLs before a test acts, so the handlers of one action run inside the dispatch in the DOM's
// order, whatever their segments' shapes (on a first run the browser would answer a segment
// with no static import first); and a control a `$` handler's body calls while the event is
// dispatched, which on a first run would come too late, is reported on the console, where a
// `sync$` handler's or a `preventdefault:` attribute's is not.
import type { MountedComponent } from "@unframework/codegen";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { mount } from "../src/toolchain/client.ts";

/** The fixture's component, compiled by the optimizer (a computed path: not this tsconfig's). */
const load = async (name: string): Promise<{ default: unknown }> =>
  import(`./fixtures/${name}.tsx`);
const FirstRun = (await load("FirstRun")).default;

const errors: string[] = [];
let container: HTMLElement;
let mounted: MountedComponent | undefined;

beforeEach(() => {
  errors.length = 0;
  vi.spyOn(console, "error").mockImplementation((...args) => void errors.push(String(args[0])));
  container = document.createElement("div");
  document.body.append(container);
});

afterEach(async () => {
  await mounted?.unmount();
  mounted = undefined;
  container.remove();
  vi.restoreAllMocks();
});

/** The segment modules the page has fetched, by the handler each holds. */
const fetchedSegments = () =>
  performance
    .getEntriesByType("resource")
    .map(({ name }) => /FirstRun\.tsx_\w*?_q_e_([a-z]+(?:_\d+)?)_[\w-]{11}\.js/.exec(name)?.[1])
    .filter((event): event is string => event !== undefined);

async function click(name: string): Promise<void> {
  await mounted!.interact!(() => userEvent.click(page.getByRole("checkbox", { name })));
  await mounted!.settle();
}

const log = () => container.querySelector("output")?.textContent;

it("loads every handler before a test acts, and runs one action's handlers in the DOM's order", async () => {
  mounted = await mount(FirstRun, container, {});
  // Every handler's segment is in the page before anything ran.
  expect(fetchedSegments().sort()).toEqual(["change", "click", "click_1", "click_2"]);
  expect(log()).toBe("");
  // One click dispatches click, input and change. Resolved, the click handler runs inside its
  // event's dispatch, before the change handler, although on a first run the browser would hand
  // over the change handler's segment, which has no static import, first.
  await click("Public");
  expect(log()).toBe("click, change");
  await click("Public");
  expect(log()).toBe("click, change, click, change");
  expect(errors).toEqual([]);
});

it("reports a control a `$` handler's body calls during the dispatch, and no control Qwik runs at dispatch", async () => {
  mounted = await mount(FirstRun, container, {});
  await click("Locked");
  // Resolved, the body's call prevents the toggle; on a first run it would come too late.
  await expect.element(page.getByRole("checkbox", { name: "Locked" })).not.toBeChecked();
  expect(errors).toEqual([
    expect.stringMatching(
      /^\[uf qwik\] A `\$` function's body calls preventDefault\(\) on a `click` event while it is dispatched\. /,
    ),
  ]);
  errors.length = 0;
  await click("Synced");
  await click("Declared");
  await expect.element(page.getByRole("checkbox", { name: "Synced" })).not.toBeChecked();
  await expect.element(page.getByRole("checkbox", { name: "Declared" })).not.toBeChecked();
  expect(log()).toBe("declared");
  expect(errors).toEqual([]);
});
