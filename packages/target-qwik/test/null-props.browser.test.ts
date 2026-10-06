// `null` props on Qwik's client (ADR-0034: `null` is a value), as test/ssr/null-props.test.ts
// checks them on the server: the mount adapter hands the props over as a parent's written
// attributes, on the first render and on a rerender, while a spread or a `jsx()` call loses a
// `null` (Qwik's `_jsxSplit`).
import type { MountedComponent } from "@unframework/codegen";
import { afterEach, describe, expect, it } from "vitest";

import { mount } from "../src/toolchain/client.ts";

/** A fixture's components, compiled by the optimizer (a computed path: not this tsconfig's). */
const load = async (name: string): Promise<Readonly<Record<string, unknown>>> =>
  import(`./fixtures/${name}.tsx`);
const fixtures = await load("NullProps");

let mounted: MountedComponent | undefined;
let container: HTMLElement | undefined;

afterEach(async () => {
  await mounted?.unmount();
  container?.remove();
  mounted = container = undefined;
});

/** Mounts a fixture component and returns a reader of the text its probe renders. */
async function mounting(name: string, props?: Record<string, unknown>): Promise<() => string> {
  container = document.createElement("div");
  document.body.append(container);
  mounted = await mount(fixtures[name], container, { props });
  const element = container;
  return () => element.textContent ?? "";
}

describe("null props on Qwik's client", () => {
  it("reach the component as `null` from the adapter, on a rerender too", async () => {
    const text = await mounting("NullProbe", { value: null });
    expect(text()).toBe("null");
    await mounted!.rerender({ value: "x" });
    expect(text()).toBe("x");
    await mounted!.rerender({ value: null });
    expect(text()).toBe("null");
    await mounted!.rerender({});
    expect(text()).toBe("undefined");
  });

  it.each([
    ["Written", "null"],
    ["Held", "null"],
    ["Spread", "undefined"],
    ["Called", "undefined"],
  ])("keep or lose `null` as Qwik does: %s", async (name, expected) => {
    // Qwik's own behaviour, pinned: a consumer that spreads its props loses a `null`.
    expect((await mounting(name))()).toBe(expected);
  });
});
