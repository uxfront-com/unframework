// effects/watch-effect: `watchEffect` runs after the first render and again after a value it reads
// changes, a state or a prop, each read unconditionally (UF2015); a write of the value a state
// already holds runs nothing. Its cleanup runs right before the next run, and at unmount. It only
// emits, so the mounted DOM is the server's.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import UnreadBadge from "./UnreadBadge.uf.tsx";

describeTargets("effects/watch-effect", () => {
  it("renders the unread count", async () => {
    const view = await mountScenario(UnreadBadge, "inbox");
    await view.expectParity("inbox");
    await expect.element(view.getByRole("status")).toHaveTextContent("0 unread");
  });

  it(
    "runs after mount and after each change, cleaning up between runs",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(UnreadBadge, "inbox");
      await view.user.click(view.getByRole("button", { name: "Receive a message" }));
      await view.user.click(view.getByRole("button", { name: "Receive a message" }));
      await view.user.click(view.getByRole("button", { name: "Mark all read" }));
      await view.expectParity("read-again");
      await expect.element(view.getByRole("status")).toHaveTextContent("0 unread");
      // Each run's cleanup comes right before the next run, never after it.
      const runs = [
        ["titleChange", "(0) Inbox"],
        ["titleRelease", "(0) Inbox"],
        ["titleChange", "(1) Inbox"],
        ["titleRelease", "(1) Inbox"],
        ["titleChange", "(2) Inbox"],
        ["titleRelease", "(2) Inbox"],
        ["titleChange", "(0) Inbox"],
      ];
      expect(view.events()).toEqual(runs);
      // A write of the value the state holds changes nothing it reads: no cleanup, no run.
      await view.user.click(view.getByRole("button", { name: "Mark all read" }));
      await view.expectParity("read-unchanged");
      await expect.element(view.getByRole("status")).toHaveTextContent("0 unread");
      expect(view.events()).toEqual(runs);
      // The last run's cleanup runs at unmount.
      await view.unmount();
      expect(view.events()).toEqual([...runs, ["titleRelease", "(0) Inbox"]]);
    },
  );

  // Browser-only: a rerender has no server twin.
  it("runs again when a prop it reads changes", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(UnreadBadge, "inbox");
    await view.rerender({ appName: "Mail" });
    await view.expectParity("renamed");
    await expect.element(view.getByRole("status")).toHaveTextContent("0 unread");
    expect(view.emitted("titleChange")).toEqual([["(0) Inbox"], ["(0) Mail"]]);
    expect(view.emitted("titleRelease")).toEqual([["(0) Inbox"]]);
  });
});
