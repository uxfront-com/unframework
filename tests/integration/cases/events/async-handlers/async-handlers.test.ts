// events/async-handlers: an async handler writes, awaits a resolved promise, writes, awaits
// `nextTick()`, reads what it wrote before the awaits, writes again and emits after them. The
// interaction settles once the continuations have run.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import SaveDraft from "./SaveDraft.uf.tsx";

describeTargets("events/async-handlers", () => {
  it("renders the unsaved draft", async () => {
    const view = await mountScenario(SaveDraft, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("status")).toHaveTextContent("Not saved");
  });

  it(
    "writes and emits after its awaits",
    { requires: ["interactivity", "next-tick"] },
    async () => {
      const view = await mountScenario(SaveDraft, "initial");
      await view.user.click(view.getByRole("button", { name: "Save the draft" }));
      await view.expectParity("saved-once");
      await expect.element(view.getByRole("status")).toHaveTextContent("Saved, attempt 1");
      expect(view.emitted("saved")).toEqual([[1, "Saved, attempt 1"]]);
    },
  );

  it(
    "reads the latest state on each run",
    { requires: ["interactivity", "next-tick"] },
    async () => {
      const view = await mountScenario(SaveDraft, "initial");
      await view.user.click(view.getByRole("button", { name: "Save the draft" }));
      await view.user.click(view.getByRole("button", { name: "Save the draft" }));
      await view.expectParity("saved-twice");
      await expect.element(view.getByRole("status")).toHaveTextContent("Saved, attempt 2");
      expect(view.emitted("saved")).toEqual([
        [1, "Saved, attempt 1"],
        [2, "Saved, attempt 2"],
      ]);
    },
  );
});
