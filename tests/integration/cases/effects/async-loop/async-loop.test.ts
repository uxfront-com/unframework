// effects/async-loop: a run of client code may cross the boundary of a block that awaits. Writes
// before a loop and in its first iteration, the end of one iteration and the start of the next,
// and the last iteration and the code after the loop each trigger a watcher once, as on Vue.
// `await nextTick()` separates the runs on every target.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import ImportQueue from "./ImportQueue.uf.tsx";

describeTargets("effects/async-loop", () => {
  it("renders the idle queue", async () => {
    const view = await mountScenario(ImportQueue, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("status")).toHaveTextContent("idle, 0 attempts");
  });

  it(
    "triggers the watcher once for each run, across the loop's boundaries",
    { requires: ["interactivity", "next-tick"] },
    async () => {
      const view = await mountScenario(ImportQueue, "initial");
      await view.user.click(view.getByRole("button", { name: "Import all" }));
      await view.expectParity("imported");
      await expect.element(view.getByRole("status")).toHaveTextContent("done, 2 attempts");
      expect(view.emitted("progress")).toEqual([
        ["starting", 1],
        ["imported a.csv", 2],
        ["done", 2],
      ]);
    },
  );
});
