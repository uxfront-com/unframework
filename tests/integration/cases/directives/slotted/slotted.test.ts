// directives/slotted: a directive on an element of a child's slot content (ADR-0099). The child
// shows and hides the content by its own state, so the component that applies the directive
// doesn't render again: `mounted` still runs once the element is in the DOM, and `unmounted` once
// it leaves.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import type { View } from "@unframework.dev/testing";
import { expect } from "vitest";

import Card from "./Card.uf.tsx";

interface Trace {
  call: string;
  el: Element;
}

/**
 * Records the hooks' calls the directive reports on the document, in order, keeping those of the
 * elements `view` mounted: in its container when mounted, and wherever they are once removed. A
 * run may mount other views beside the test's (L12 renders the client side too).
 */
function record(): { calls: (view: View) => string[]; stop: () => void } {
  const traces: Trace[] = [];
  const own = new Set<Element>();
  const listener = (event: Event) => void traces.push((event as CustomEvent<Trace>).detail);
  document.addEventListener("directive-trace", listener);
  return {
    calls: (view) =>
      traces.flatMap(({ call, el }) => {
        if (call.startsWith("mounted") && view.container.contains(el)) own.add(el);
        return own.has(el) ? [call] : [];
      }),
    stop: () => document.removeEventListener("directive-trace", listener),
  };
}

describeTargets("directives/slotted", () => {
  it("renders the card with its content hidden", async () => {
    const view = await mountScenario(Card, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("button", { name: "Details" })).toBeVisible();
  });

  it(
    "runs the hooks as the child shows and hides the content",
    { requires: ["directive"] },
    async () => {
      const trace = record();
      try {
        const view = await mountScenario(Card, "initial");
        await view.expectParity("closed");
        expect(trace.calls(view)).toEqual([]);
        await view.user.click(view.getByRole("button", { name: "Details" }));
        await view.expectParity("open");
        await expect.element(view.getByText("Body")).toBeVisible();
        expect(trace.calls(view)).toEqual(["mounted body"]);
        await view.user.click(view.getByRole("button", { name: "Details" }));
        await view.expectParity("closed-again");
        expect(trace.calls(view)).toEqual(["mounted body", "unmounted body"]);
      } finally {
        trace.stop();
      }
    },
  );
});
