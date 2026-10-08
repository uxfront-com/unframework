// effects/async-callbacks: async client code keeps the watcher contract on every target. The
// writes of one synchronous run trigger a watcher once, whether the run is an async `onMounted`'s
// continuation after its `await`, an async function's run that declares a local before its writes,
// an interval's callback or a microtask's; `await nextTick()` separates two runs. An async watch
// callback and an async `watchEffect` (whose reads come before its first `await`) run their async
// part to the end. A promise's `then` callback emits what it reads when it runs.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Mailbox from "./Mailbox.uf.tsx";

describeTargets("effects/async-callbacks", () => {
  it(
    "loads once mounted, one watcher callback for both writes",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(Mailbox, "inbox");
      await view.expectParity("loaded");
      await expect.element(view.getByRole("heading", { name: "Inbox" })).toBeVisible();
      await expect.element(view.getByRole("status")).toHaveTextContent("3 unread");
      expect(view.emitted("loaded")).toEqual([["Inbox", 3]]);
      expect(view.emitted("seen")).toEqual([["idle after 0"]]);
      expect(view.emitted("progress")).toEqual([]);
    },
  );

  it(
    "triggers a watcher once for the writes before an await, and again after it",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(Mailbox, "inbox");
      await view.user.click(view.getByRole("button", { name: "Save" }));
      await view.expectParity("saved");
      await expect.element(view.getByText("Status: saved")).toBeVisible();
      expect(view.emitted("progress")).toEqual([
        ["saving Inbox", 1],
        ["saved", 1],
      ]);
      expect(view.emitted("seen")).toEqual([
        ["idle after 0"],
        ["saving Inbox after 1"],
        ["saved after 1"],
      ]);
    },
  );

  it(
    "triggers a watcher once for an interval's two writes",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(Mailbox, "inbox", { clock: true });
      await view.user.click(view.getByRole("button", { name: "Refresh every second" }));
      await view.clock.tick(1000);
      await view.expectParity("refreshed");
      await expect.element(view.getByRole("heading", { name: "Inbox (refreshed)" })).toBeVisible();
      await expect.element(view.getByRole("status")).toHaveTextContent("4 unread");
      expect(view.emitted("loaded")).toEqual([
        ["Inbox", 3],
        ["Inbox (refreshed)", 4],
      ]);
    },
  );

  it(
    "triggers a watcher once for a microtask's two writes, and emits from a then callback",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(Mailbox, "inbox");
      await view.user.click(view.getByRole("button", { name: "Mark all read" }));
      await view.user.click(view.getByRole("button", { name: "Note" }));
      await view.expectParity("read-and-noted");
      await expect.element(view.getByRole("heading", { name: "Inbox, all read" })).toBeVisible();
      await expect.element(view.getByRole("status")).toHaveTextContent("0 unread");
      expect(view.emitted("loaded")).toEqual([
        ["Inbox", 3],
        ["Inbox, all read", 0],
      ]);
      expect(view.emitted("noted")).toEqual([["Inbox, all read: 0"]]);
    },
  );
});
