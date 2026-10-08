// semantics/watch-timing: a watcher's callback runs after the writes that triggered it, once per
// synchronous run of a handler however many writes it made, only when its source's value changed
// (by Object.is), with the value the source had at its last callback as `previous`; its cleanup
// runs right before its next callback, never on a run that skips the callback. The relative order
// of two watchers is not part of the contract, so the spec checks each watcher apart (semantics
// contract, watch semantics).
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import SearchPager from "./SearchPager.uf.tsx";

describeTargets("semantics/watch-timing", () => {
  it("renders the first page of all results", async () => {
    const view = await mountScenario(SearchPager, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("status")).toHaveTextContent("All results, page 1");
  });

  it(
    "runs each watcher once per handler, with the previous value",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(SearchPager, "initial");
      await view.user.click(view.getByRole("button", { name: "Search boots" }));
      await view.user.click(view.getByRole("button", { name: "Skip two pages" }));
      await view.expectParity("searched-and-skipped");
      await expect.element(view.getByRole("status")).toHaveTextContent("Results for boots, page 3");
      expect(view.emitted("queryRun")).toEqual([["boots", ""]]);
      expect(view.emitted("pageRun")).toEqual([[3, 1]]);
    },
  );

  it(
    "skips a watcher whose source ends unchanged, and cleans up before the next callback",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(SearchPager, "initial");
      await view.user.click(view.getByRole("button", { name: "Search boots" }));
      await view.user.click(view.getByRole("button", { name: "Next page" }));
      await view.user.click(view.getByRole("button", { name: "Search boots" }));
      await view.user.click(view.getByRole("button", { name: "Search sandals" }));
      await view.expectParity("searched-twice");
      await expect
        .element(view.getByRole("status"))
        .toHaveTextContent("Results for sandals, page 1");
      expect(view.emitted("queryRun")).toEqual([
        ["boots", ""],
        ["sandals", "boots"],
      ]);
      expect(view.emitted("pageRun")).toEqual([
        [2, 1],
        [1, 2],
      ]);
      // One watcher's own events keep their order: its cleanup runs right before its next callback.
      expect(view.events().filter(([name]) => name === "queryRun" || name === "cleanedUp")).toEqual(
        [
          ["queryRun", "boots", ""],
          ["cleanedUp", "query"],
          ["queryRun", "sandals", "boots"],
        ],
      );
    },
  );
});
