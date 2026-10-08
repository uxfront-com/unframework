// state/array-replacement: a keyed list held in a ref and replaced whole: appended with a spread,
// filtered, and reordered with toSpliced; the empty state renders when it is empty. The selection
// lives in a ref of its own, and a reorder starts from a button outside the list, so focus is
// never inside the list while it reorders (semantics contract, keyed lists).
import { describeTargets, it, mountScenario, type View } from "@unframework/testing";
import { expect } from "vitest";

import TaskList from "./TaskList.uf.tsx";

/** The task button of the row at `index`: a row's text also holds its Remove button's. */
function taskAt(view: Pick<View, "getByRole">, index: number) {
  return view.getByRole("listitem").nth(index).getByRole("button").first();
}

describeTargets("state/array-replacement", () => {
  it("renders the tasks from the prop", async () => {
    const view = await mountScenario(TaskList, "initial");
    await view.expectParity("initial");
    await expect.element(taskAt(view, 0)).toHaveTextContent("Write the report");
    await expect.element(taskAt(view, 2)).toHaveTextContent("Ship the release");
  });

  it("renders the empty state", async () => {
    const view = await mountScenario(TaskList, "empty");
    await view.expectParity("empty");
    await expect.element(view.getByText("No tasks yet.")).toBeVisible();
  });

  it("appends a task with a spread copy", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(TaskList, "initial");
    await view.user.click(view.getByRole("button", { name: "Add task" }));
    await view.user.click(view.getByRole("button", { name: "Add task" }));
    await view.expectParity("added");
    await expect.element(taskAt(view, 3)).toHaveTextContent("New task 1");
    await expect.element(taskAt(view, 4)).toHaveTextContent("New task 2");
  });

  it("removes a task with filter", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(TaskList, "initial");
    await view.user.click(view.getByRole("button", { name: "Remove Review the pull request" }));
    await view.expectParity("removed");
    await expect.element(taskAt(view, 0)).toHaveTextContent("Write the report");
    await expect.element(taskAt(view, 1)).toHaveTextContent("Ship the release");
  });

  it("moves the selected task up with toSpliced", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(TaskList, "initial");
    await view.user.click(view.getByRole("button", { name: "Ship the release", exact: true }));
    await view.user.click(view.getByRole("button", { name: "Move up" }));
    await view.expectParity("moved-up");
    await expect.element(taskAt(view, 1)).toHaveTextContent("Ship the release");
    await expect.element(taskAt(view, 2)).toHaveTextContent("Review the pull request");
    await expect
      .element(view.getByRole("button", { name: "Ship the release", exact: true }))
      .toHaveAttribute("aria-pressed", "true");
  });

  it(
    "shows the empty state once every task is removed",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(TaskList, "initial");
      await view.user.click(view.getByRole("button", { name: "Remove Write the report" }));
      await view.user.click(view.getByRole("button", { name: "Remove Review the pull request" }));
      await view.user.click(view.getByRole("button", { name: "Remove Ship the release" }));
      await view.expectParity("all-removed");
      await expect.element(view.getByText("No tasks yet.")).toBeVisible();
    },
  );
});
