// The mount adapter's rerender in Chromium (ADR-0043): a hand-written Qwik component, compiled
// by the optimizer like the output, rendered again with new props through the toolchain's
// adapter, updates its text, an attribute, a branch and a list, and a prop the new props lack
// takes its destructured default again. The adapter settles before it resolves, so the DOM is
// read at once, and nothing is logged. Written with `jsx()`: the package compiles no JSX of its
// own outside the render-parity modules and the ssr fixtures.
import { component$, jsx } from "@qwik.dev/core";
import type { MountedComponent } from "@unframework/codegen";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { mount } from "../src/toolchain/client.ts";

interface BadgeProps {
  label: string;
  tone?: "info" | "warn";
  items?: string[];
  count?: number;
}

/** The shape every target's rerender test renders, with defaults for `tone` and `items`. */
const Badge = component$<BadgeProps>(({ label, tone = "info", items = [], count }) =>
  jsx("div", {
    children: [
      jsx("p", { class: tone, "data-count": count, children: label }),
      tone === "warn" ? jsx("strong", { children: "warning" }) : null,
      jsx("ul", { children: items.map((item) => jsx("li", { children: item }, item)) }),
    ],
  }),
);

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
