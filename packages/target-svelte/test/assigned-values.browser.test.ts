// A bound `value` in Chromium: the target's output for the `assignedValues` shape
// (./fixtures/Steps.svelte, which emit.test.ts keeps equal to it), mounted and rendered again by
// the toolchain's adapter. Svelte's `set_value` writes nothing while the element's own `value`
// already holds the bound one, so the target writes these as object spreads, which assign it on
// every render: each element gets its `value` attribute, its own default (0, "", "on") included,
// as every other target writes it.
import type { MountedComponent } from "@unframework/codegen";
import { afterEach, beforeEach, expect, it } from "vitest";

import { mount } from "../src/toolchain/client.ts";
import Steps from "./fixtures/Steps.svelte";

/** Each element's `value` attribute, `null` when it has none. */
function read(container: HTMLElement) {
  const value = (selector: string) => container.querySelector(selector)!.getAttribute("value");
  return {
    items: [...container.querySelectorAll("li")].map((li) => li.getAttribute("value")),
    meter: value("meter"),
    progress: value("progress"),
    data: value("data"),
    button: value("button"),
    checkbox: value("input"),
  };
}

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

it("writes each bound value, the element's own default included, on mount and after", async () => {
  mounted = await mount(Steps, container, {
    props: { steps: ["a", "b", "c"], score: 0, label: "", mode: "on" },
  });
  const defaults = {
    items: ["2", "1", "0"],
    meter: "0",
    progress: "0",
    data: "",
    button: "",
    checkbox: "on",
  };
  expect(read(container)).toEqual(defaults);

  await mounted.rerender({ steps: ["a", "b"], score: 3, label: "x", mode: "m" });
  expect(read(container)).toEqual({
    items: ["1", "0"],
    meter: "3",
    progress: "3",
    data: "x",
    button: "x",
    checkbox: "m",
  });

  await mounted.rerender({ steps: ["a", "b", "c"], score: 0, label: "", mode: "on" });
  expect(read(container)).toEqual(defaults);
});

// Pinned, not passed, as a canary of Svelte's own behaviour: Svelte 5.57 clears a `value` that
// becomes nullish as it clears an input's, setting the property to "" or `null`, which an
// `<li>`, a `<meter>` or a `<progress>` reflects as "0"; every other target removes the
// attribute, and no markup reaches `setAttribute` for a `value` in Svelte. So the analyser
// reports a source's value that may be nullish there (UF1002, `NULLISH_VALUE_ELEMENTS`), and this
// mounts the fixture with props its type does not allow. When this fails, Svelte removes it:
// expect `null` here, and that rule can go for Svelte.
it("writes 0 for a value that becomes absent, as Svelte clears an input's", async () => {
  mounted = await mount(Steps, container, {
    props: { steps: ["a"], score: 3, label: "x", mode: "m" },
  });
  await mounted.rerender({ steps: ["a"], label: "x", mode: "m" });
  expect(read(container)).toMatchObject({ meter: "0", progress: "0" });
});
