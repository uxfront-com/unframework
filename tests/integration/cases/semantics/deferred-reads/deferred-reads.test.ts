// semantics/deferred-reads: code that runs later (here, an async handler's continuation once the
// user confirms) reads the latest state and props, never those of the render that scheduled it:
// a state write and a rerender made while it waits are both seen (semantics contract, deferred
// reads). React's output keeps this with mirror refs for the state and the props.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import DeleteFile from "./DeleteFile.uf.tsx";

describeTargets("semantics/deferred-reads", () => {
  it("renders the file and its delete button", async () => {
    const view = await mountScenario(DeleteFile, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByText("report.pdf, 1 copy")).toBeVisible();
    await expect.element(view.getByRole("button", { name: "Delete" })).toBeVisible();
  });

  // Browser-only: a rerender has no server twin.
  it(
    "reads the state and props written while it waited",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(DeleteFile, "initial");
      await view.user.click(view.getByRole("button", { name: "Delete" }));
      // Compared before the confirmation, which only Delete's handler shows: a later step on it
      // must not abort the test before L9 compares this one.
      await view.expectParity("delete-requested");
      await view.user.click(view.getByRole("button", { name: "Add a copy" }));
      await view.rerender({ fileName: "report-final.pdf" });
      await view.user.click(view.getByRole("button", { name: "Confirm the deletion" }));
      await view.expectParity("deleted");
      await expect.element(view.getByText("report-final.pdf, 2 copies")).toBeVisible();
      await expect.element(view.getByRole("button", { name: "Delete" })).toBeVisible();
      expect(view.emitted("deleted")).toEqual([["report-final.pdf", 2]]);
    },
  );
});
