// effects/async-overlap: async client code that waits while the state it read changes. A change
// while an async watcher or an async `watchEffect` waits runs its cleanup and its next run at
// once, so the overtaken run drops its result. The writes of one synchronous run trigger a
// watcher once also where the run crosses a block: after a `try` whose `await` resolved, after a
// `catch` it rejected into, and around an assignment of an awaited value. Two calls of a local
// arrow are one run's changes, on each side of `await nextTick()`. Every reply comes from a
// button, so each run after an `await` is a step of its own on every target.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import InboxLookup from "./InboxLookup.uf.tsx";

describeTargets("effects/async-overlap", () => {
  it("renders the idle inbox", async () => {
    const view = await mountScenario(InboxLookup, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("status")).toHaveTextContent("0 messages");
    await expect.element(view.getByText("Order: none")).toBeVisible();
  });

  it(
    "drops a lookup that a new sender overtakes while it waits",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(InboxLookup, "initial");
      await view.user.click(view.getByRole("button", { name: "Find Ann", exact: true }));
      await view.user.click(view.getByRole("button", { name: "Find Anna" }));
      await view.expectParity("overtaken");
      await expect.element(view.getByRole("button", { name: "Answer lookups" })).toBeVisible();
      expect(view.emitted("looked")).toEqual([["Ann"], ["Anna"]]);
      expect(view.emitted("dropped")).toEqual([["Ann"]]);
      await view.user.click(view.getByRole("button", { name: "Answer lookups" }));
      await view.expectParity("answered");
      const answers = view.getByRole("list", { name: "Answers" }).getByRole("listitem");
      expect(answers.elements().map((answer) => answer.textContent)).toEqual(["Anna: found"]);
    },
  );

  it(
    "drops an ordering run that a switch overtakes while it waits",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(InboxLookup, "initial");
      await view.user.click(view.getByRole("button", { name: "Switch order" }));
      await view.expectParity("order-switched");
      await expect.element(view.getByText("Order: none")).toBeVisible();
      expect(view.emitted("sorted")).toEqual([["newest"], ["oldest"]]);
      await view.user.click(view.getByRole("button", { name: "Answer order" }));
      await view.expectParity("order-answered");
      await expect.element(view.getByText("Order: oldest ready")).toBeVisible();
      expect(view.emitted("scaled")).toEqual([["oldest"]]);
    },
  );

  it(
    "writes the reply and the end of loading in one run after a try",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(InboxLookup, "initial");
      await view.user.click(view.getByRole("button", { name: "Load" }));
      await view.expectParity("loading");
      await expect.element(view.getByRole("status")).toHaveTextContent("Loading");
      await view.user.click(view.getByRole("button", { name: "Reply" }));
      await view.expectParity("loaded");
      await expect.element(view.getByRole("status")).toHaveTextContent("2 messages");
      expect(view.emitted("busy")).toEqual([
        [0, true],
        [2, false],
      ]);
      expect(view.emitted("failed")).toEqual([
        ["", true],
        ["", false],
      ]);
    },
  );

  it(
    "writes the failure and the end of loading in one run after a catch",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(InboxLookup, "initial");
      await view.user.click(view.getByRole("button", { name: "Load" }));
      await view.expectParity("loading-again");
      await expect.element(view.getByRole("status")).toHaveTextContent("Loading");
      await view.user.click(view.getByRole("button", { name: "Fail" }));
      await view.expectParity("failed");
      await expect.element(view.getByRole("status")).toHaveTextContent("0 messages, offline");
      expect(view.emitted("failed")).toEqual([
        ["", true],
        ["offline", false],
      ]);
      expect(view.emitted("busy")).toEqual([
        [0, true],
        [0, false],
      ]);
    },
  );

  it(
    "writes an awaited value and the end of loading in one run",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(InboxLookup, "initial");
      await view.user.click(view.getByRole("button", { name: "Refresh" }));
      await view.expectParity("refreshing");
      await expect.element(view.getByRole("status")).toHaveTextContent("Loading");
      await view.user.click(view.getByRole("button", { name: "Reply" }));
      await view.expectParity("refreshed");
      await expect.element(view.getByRole("status")).toHaveTextContent("2 messages");
      expect(view.emitted("busy")).toEqual([
        [0, true],
        [2, false],
      ]);
    },
  );

  it(
    "counts two calls of a local arrow as one change, on each side of nextTick",
    { requires: ["interactivity", "next-tick"] },
    async () => {
      const view = await mountScenario(InboxLookup, "initial");
      await view.user.click(view.getByRole("button", { name: "Mark twice" }));
      await view.expectParity("marked");
      await expect.element(view.getByText("Unread: 4")).toBeVisible();
      expect(view.emitted("counted")).toEqual([[2], [4]]);
    },
  );
});
