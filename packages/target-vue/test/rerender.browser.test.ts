// The mount adapter's rerender in Chromium (ADR-0043): a hand-written Vue component, rendered
// again with new props through the toolchain's adapter, updates its text, an attribute, a
// branch and a list, and a prop the new props lack takes its default again. The adapter
// settles before it resolves, so the DOM is read at once, and nothing is logged (Vue warns
// about a missing required prop or one of the wrong type).
import type { MountedComponent } from "@unframework/codegen";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import type { PropType } from "vue";

import { mount } from "../src/toolchain/client.ts";

/** The shape every target's rerender test renders, with defaults for `tone` and `items`. */
const Badge = defineComponent({
  props: {
    label: { type: String, required: true },
    tone: { type: String as PropType<"info" | "warn">, default: "info" },
    items: { type: Array as PropType<string[]>, default: () => [] },
    count: { type: Number, default: undefined },
  },
  setup(props) {
    return () =>
      h("div", [
        h("p", { class: props.tone, "data-count": props.count }, props.label),
        props.tone === "warn" ? h("strong", "warning") : null,
        h(
          "ul",
          props.items.map((item) => h("li", { key: item }, item)),
        ),
      ]);
  },
});

/** What the test reads back: the text, the attributes, the branch and the list. */
function read(container: HTMLElement) {
  const p = container.querySelector("p");
  return {
    label: p?.textContent,
    tone: p?.getAttribute("class"),
    count: p?.getAttribute("data-count"),
    warning: container.querySelector("strong")?.textContent ?? null,
    items: [...container.querySelectorAll("li")].map((li) => li.textContent),
  };
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

it("replaces the props whole, updating text, attributes, branches and lists", async () => {
  mounted = await mount(Badge, container, {
    props: { label: "A", tone: "warn", items: ["x", "y"], count: 3 },
  });
  expect(read(container)).toEqual({
    label: "A",
    tone: "warn",
    count: "3",
    warning: "warning",
    items: ["x", "y"],
  });

  // `tone` and `count` are absent: `tone` takes its default, and `count` is gone.
  await mounted.rerender({ label: "B", items: ["z"] });
  expect(read(container)).toEqual({
    label: "B",
    tone: "info",
    count: null,
    warning: null,
    items: ["z"],
  });

  // Back again, and `items` absent now takes its default.
  await mounted.rerender({ label: "C", tone: "warn", count: 0 });
  expect(read(container)).toEqual({
    label: "C",
    tone: "warn",
    count: "0",
    warning: "warning",
    items: [],
  });
  expect(logged).toEqual([]);
});
