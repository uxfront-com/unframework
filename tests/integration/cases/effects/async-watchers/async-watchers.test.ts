// effects/async-watchers: async client code, and the watchers that answer it, once per
// synchronous run whatever the run's shape. A pre watcher raises a flag and lowers it around an
// await that resolves at once: the post watcher and the watchEffect still answer the change, and a
// handler's `await nextTick()` still resumes. A loader assigns two awaited values; a save clears
// its error, returns early on an empty name, and keeps a local across the await of a helper that
// sets a flag; an import awaits in a loop; a refresh chains on a local async function's promise
// and a prefetch holds one across a write; a send writes after a `try` whose block and catch
// clause may return; a watcher calls a function that reassigns its parameter. Every reply comes
// from a button (Reply, Decline, Fail answer the oldest question), so each run after an await is
// a step of its own on every target.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import SyncDesk from "./SyncDesk.uf.tsx";

describeTargets("effects/async-watchers", () => {
  it("renders the idle desk", async () => {
    const view = await mountScenario(SyncDesk, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByText("ada@example.com: valid")).toBeVisible();
    await expect.element(view.getByText("Step: idle, owner nobody, editor nobody")).toBeVisible();
  });

  it(
    "answers a change whose checking flag cancels out, after the render",
    { requires: ["interactivity", "next-tick"] },
    async () => {
      const view = await mountScenario(SyncDesk, "initial");
      await view.user.click(view.getByRole("button", { name: "Suggest" }));
      await view.expectParity("suggested");
      await expect.element(view.getByText("ada@lovelace.dev: valid")).toBeVisible();
      await expect.element(view.getByRole("button", { name: "Use this email" })).toHaveFocus();
      expect(view.emitted("checked")).toEqual([["ada@lovelace.dev"]]);
      expect(view.emitted("summary")).toEqual([
        ["ada@example.com is valid"],
        ["ada@lovelace.dev is valid"],
      ]);
      expect(view.emitted("focused")).toEqual([["Use this email"]]);
    },
  );

  it(
    "calls the progress watcher once per run of a loader with two awaited assignments",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(SyncDesk, "initial");
      await view.user.click(view.getByRole("button", { name: "Load" }));
      await view.expectParity("loading-owner");
      await expect
        .element(view.getByText("Step: owner, owner nobody, editor nobody"))
        .toBeVisible();
      await view.user.click(view.getByRole("button", { name: "Reply" }));
      await view.expectParity("loading-editor");
      await expect.element(view.getByText("Step: editor, owner Ada, editor nobody")).toBeVisible();
      await view.user.click(view.getByRole("button", { name: "Reply" }));
      await view.expectParity("loaded");
      await expect.element(view.getByText("Step: done, owner Ada, editor Ada")).toBeVisible();
      expect(view.emitted("progress")).toEqual([
        ["owner", "nobody"],
        ["editor", "Ada"],
        ["done", "Ada"],
      ]);
    },
  );

  it(
    "refuses an empty name before the await, and saves a typed one after it",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(SyncDesk, "initial");
      await view.user.click(view.getByRole("button", { name: "Save" }));
      await view.expectParity("name-required");
      await expect.element(view.getByText("Name required")).toBeVisible();
      expect(view.emitted("saveState")).toEqual([["Name required", ""]]);
      await view.user.type(view.getByRole("textbox", { name: "Name" }), "Ada");
      await view.user.click(view.getByRole("button", { name: "Save" }));
      await view.expectParity("saving-name");
      await expect.element(view.getByText("Saving Ada")).toBeVisible();
      expect(view.emitted("saveState")).toEqual([
        ["Name required", ""],
        ["", "Ada"],
      ]);
      expect(view.emitted("savedName")).toEqual([]);
      await view.user.click(view.getByRole("button", { name: "Reply" }));
      await view.expectParity("name-saved");
      await expect.element(view.getByText("Not saving")).toBeVisible();
      expect(view.emitted("saveState")).toEqual([
        ["Name required", ""],
        ["", "Ada"],
        ["", ""],
      ]);
      expect(view.emitted("savedName")).toEqual([["Ada"]]);
    },
  );

  it(
    "imports file by file, calling the watcher once per run",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(SyncDesk, "initial");
      await view.user.click(view.getByRole("button", { name: "Import" }));
      await view.expectParity("importing-first");
      await expect.element(view.getByText("Import: importing a.csv, 0 imported")).toBeVisible();
      await view.user.click(view.getByRole("button", { name: "Reply" }));
      await view.expectParity("importing-second");
      await expect.element(view.getByText("Import: importing b.csv, 1 imported")).toBeVisible();
      await view.user.click(view.getByRole("button", { name: "Reply" }));
      await view.expectParity("imported");
      await expect.element(view.getByText("Import: done, 2 imported")).toBeVisible();
      expect(view.emitted("importState")).toEqual([
        ["importing a.csv", 0],
        ["importing b.csv", 1],
        ["done", 2],
      ]);
    },
  );

  it(
    "chains on a local async function's promise, and holds one across a write",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(SyncDesk, "initial");
      await view.user.click(view.getByRole("button", { name: "Refresh" }));
      await view.expectParity("refreshing");
      await expect.element(view.getByText("Note: refreshing")).toBeVisible();
      await view.user.click(view.getByRole("button", { name: "Reply" }));
      await view.expectParity("refreshed");
      await expect.element(view.getByText("Note: refreshed by Ada")).toBeVisible();
      expect(view.emitted("settled")).toEqual([["refreshed by Ada"]]);
      await view.user.click(view.getByRole("button", { name: "Prefetch" }));
      await view.expectParity("prefetching");
      await expect.element(view.getByText("Note: waiting")).toBeVisible();
      await view.user.click(view.getByRole("button", { name: "Reply" }));
      await view.expectParity("prefetched");
      await expect.element(view.getByText("Note: prefetched by Ada")).toBeVisible();
    },
  );

  it(
    "writes after a try statement only when neither its block nor its catch returned",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(SyncDesk, "initial");
      await view.user.click(view.getByRole("button", { name: "Send" }));
      await view.expectParity("sending");
      await expect.element(view.getByText("Send: sending")).toBeVisible();
      await view.user.click(view.getByRole("button", { name: "Decline" }));
      await view.expectParity("declined");
      await expect.element(view.getByText("Send: Declined")).toBeVisible();
      await view.user.click(view.getByRole("button", { name: "Send" }));
      await view.user.click(view.getByRole("button", { name: "Fail" }));
      await view.expectParity("failed");
      await expect.element(view.getByText("Send: offline")).toBeVisible();
      await view.user.click(view.getByRole("button", { name: "Send" }));
      await view.user.click(view.getByRole("button", { name: "Reply" }));
      await view.expectParity("sent");
      await expect.element(view.getByText("Send: Sent 1")).toBeVisible();
      expect(view.emitted("sending")).toEqual([
        [true, ""],
        [false, "Declined"],
        [true, ""],
        [false, "offline"],
        [true, ""],
        [false, "Sent 1"],
      ]);
      expect(view.emitted("sent")).toEqual([[1]]);
    },
  );

  it("clamps the level a watcher computes", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(SyncDesk, "initial");
    await view.user.click(view.getByRole("button", { name: "Louder" }));
    await view.user.click(view.getByRole("button", { name: "Louder" }));
    await view.expectParity("louder");
    await expect.element(view.getByText("Level: 10")).toBeVisible();
    expect(view.emitted("clamped")).toEqual([[10], [10]]);
  });
});
