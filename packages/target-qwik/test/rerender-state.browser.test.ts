// A rerender keeps the component's instance, as a parent's template renders it again under its
// key (ADR-0050): its state stays, and its lazily loaded handlers read the new props. A
// component mounted without any props gets its first ones as a new instance: Qwik keeps empty
// props as one object shared by every element (core's `EMPTY_OBJ`), and new props written into
// it would reach every later element (./fixtures/Emitter.tsx counts by its `step` prop).
import type { MountedComponent } from "@unframework/codegen";
import { afterEach, beforeEach, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import { mount } from "../src/toolchain/client.ts";

const load = async (name: string): Promise<{ default: unknown }> =>
  import(`./fixtures/${name}.tsx`);
const Emitter = (await load("Emitter")).default;

let container: HTMLElement;
let mounted: MountedComponent | undefined;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
});

afterEach(async () => {
  await mounted?.unmount();
  mounted = undefined;
  container.remove();
});

const count = () => container.querySelector("p")?.textContent;
const add = async () => {
  await mounted!.interact!(() => userEvent.click(page.getByRole("button", { name: "Add" })));
  await mounted!.settle();
};

it.each([
  ["a prop's new value", { step: 1 }, { step: 5 }],
  ["a prop given beside another", { other: 1 }, { step: 5 }],
])("keeps the instance and its state across a rerender: %s", async (_, first, next) => {
  mounted = await mount(Emitter, container, { props: first });
  await add();
  expect(count()).toBe("1");
  await mounted.rerender(next);
  expect(count()).toBe("1");
  await add();
  expect(count()).toBe("6");
});

it("renders a component's first props on a new instance, and leaks them nowhere", async () => {
  mounted = await mount(Emitter, container, {});
  await add();
  await mounted.rerender({ step: 5 });
  // A new instance: its state starts again.
  expect(count()).toBe("0");
  await add();
  expect(count()).toBe("5");
  await mounted.unmount();
  // A component mounted without props afterwards counts by its default step. Qwik renders into
  // a container once.
  container.remove();
  container = document.createElement("div");
  document.body.append(container);
  mounted = await mount(Emitter, container, {});
  await add();
  expect(count()).toBe("1");
});
