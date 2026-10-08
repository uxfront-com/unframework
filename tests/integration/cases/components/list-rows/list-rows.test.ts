// components/list-rows: a list renders a component for each item, keyed on it (ADR-0053's
// components as `.map` roots). Adding an item adds a row; finishing one rerenders its row.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Tasks from "./Tasks.uf.tsx";

describeTargets("components/list-rows", () => {
  it("renders a row for each task", async () => {
    const view = await mountScenario(Tasks, "two");
    await view.expectParity("two");
    await expect.element(view.getByRole("listitem").first()).toHaveTextContent("Read mail");
    await expect.element(view.getByText("Plan trip (done)")).toBeVisible();
  });

  it("adds and updates rows", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(Tasks, "two");
    await view.user.click(view.getByRole("button", { name: "Add a task" }));
    await view.user.click(view.getByRole("button", { name: "Finish the first" }));
    await view.expectParity("after-changes");
    await expect.element(view.getByText("Water plants")).toBeVisible();
    await expect.element(view.getByText("Read mail (done)")).toBeVisible();
  });
});
