// directives/slotted: a directive on an element of a child's slot content (ADR-0099). The child
// shows and hides the content by its own state, so the component that applies the directive
// doesn't render again: `mounted` still runs once the element is in the DOM, and `unmounted` once
// it leaves. One element's value is narrowed by a conditional around it, and changes while the
// content is hidden, so the content shown again mounts with the value of then.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import type { View } from "@unframework.dev/testing";
import { expect } from "vitest";

import Card from "./Card.uf.tsx";

interface Trace {
  call: string;
  el: Element;
  /** Whether the element was in the document when the hook ran. */
  connected: boolean;
}

/**
 * Records the hooks' calls the directive reports on the document, in order, keeping those of the
 * elements `view` mounted: in its container when mounted, and wherever they are once removed. A
 * run may mount other views beside the test's (L12 renders the client side too). `detached` gives
 * the `mounted` calls that ran on an element out of the document, any view's.
 */
function record(): {
  calls: (view: View) => string[];
  detached: () => string[];
  stop: () => void;
} {
  const traces: Trace[] = [];
  const own = new Set<Element>();
  const listener = (event: Event) => {
    const { call, el } = (event as CustomEvent<Omit<Trace, "connected">>).detail;
    traces.push({ call, el, connected: el.isConnected });
  };
  document.addEventListener("directive-trace", listener);
  return {
    calls: (view) =>
      traces.flatMap(({ call, el }) => {
        if (call.startsWith("mounted") && view.container.contains(el)) {
          own.add(el);
        }
        return own.has(el) ? [call] : [];
      }),
    detached: () =>
      traces.flatMap(({ call, connected }) =>
        call.startsWith("mounted") && !connected ? [call] : [],
      ),
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
        expect(trace.calls(view)).toEqual(["mounted body", "mounted note"]);
        await view.user.click(view.getByRole("button", { name: "Details" }));
        await view.expectParity("closed-again");
        expect(trace.calls(view)).toEqual([
          "mounted body",
          "mounted note",
          "unmounted body",
          "unmounted note",
        ]);
        // Its value changes while it is hidden, which runs no hook.
        await view.user.click(view.getByRole("button", { name: "Rename" }));
        await view.expectParity("renamed");
        expect(trace.calls(view)).toHaveLength(4);
        // Shown again, the content mounts again, with the value of then.
        await view.user.click(view.getByRole("button", { name: "Details" }));
        await view.expectParity("reopened");
        expect(trace.calls(view).slice(4)).toEqual(["mounted body", "mounted renamed"]);
        // `mounted` ran only on an element in the document.
        expect(trace.detached()).toEqual([]);
      } finally {
        trace.stop();
      }
    },
  );
});
