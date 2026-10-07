// state/derived-arrays: code may change what it builds itself. A `computed` sorts the new array
// that `filter` or `slice` returns, or reverses the one `map` returns, groups a list into a
// record whose every member it creates (with `if (!x[k]) x[k] = []` or `x[k] ??= []`), and folds
// a list with `reduce` into a fresh record or `Map` (`acc[k] = v`, `(acc[k] ||= []).push(v)`,
// `acc.set(k, …)`); a handler copies an object and its nested array, then pushes onto the copy
// and writes it whole. The state never changes in place, so each derived value follows its
// writes. Two handlers size a field and set its class, one through a template ref, one through
// `event.currentTarget`, where other elements bind a class and a style, and every target keeps
// both when the component renders again.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import TaskBoard from "./TaskBoard.uf.tsx";

describeTargets("state/derived-arrays", () => {
  it("renders the derived lists", async () => {
    const view = await mountScenario(TaskBoard, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("list", { name: "Open" })).toBeVisible();
    const open = view.getByRole("list", { name: "Open" }).getByRole("button");
    expect(open.elements().map((button) => button.textContent)).toEqual([
      "Finish Write docs",
      "Finish Fix login",
      "Finish Plan release",
    ]);
    await expect
      .element(view.getByText("Alphabetical: Fix login, Plan release, Write docs"))
      .toBeVisible();
    await expect
      .element(view.getByText("Newest first: Fix login, Write docs, Plan release"))
      .toBeVisible();
    const kinds = view.getByRole("list", { name: "Kinds" }).getByRole("listitem");
    expect(kinds.elements().map((kind) => kind.textContent)).toEqual(["code: 2", "docs: 1"]);
    await expect.element(view.getByText("Task 2: Write docs")).toBeVisible();
    await expect.element(view.getByText("Code tasks: Plan release, Fix login")).toBeVisible();
    await expect.element(view.getByText("Finished code tasks: 0")).toBeVisible();
    await expect.element(view.getByText("Done: nothing")).toBeVisible();
  });

  it(
    "derives the open tasks again once one is finished",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(TaskBoard, "initial");
      await view.user.click(view.getByRole("button", { name: "Finish Fix login" }));
      await view.expectParity("finished");
      const open = view.getByRole("list", { name: "Open" }).getByRole("button");
      expect(open.elements().map((button) => button.textContent)).toEqual([
        "Finish Write docs",
        "Finish Plan release",
      ]);
      await expect
        .element(view.getByText("Alphabetical: Fix login, Plan release, Write docs"))
        .toBeVisible();
      await expect.element(view.getByText("Finished code tasks: 1")).toBeVisible();
      await expect.element(view.getByText("Done: Fix login")).toBeVisible();
      await expect.element(view.getByText("Code tasks: Plan release, Fix login")).toBeVisible();
    },
  );

  it("adds tags through a copy of the nested array", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(TaskBoard, "initial");
    await view.user.click(view.getByRole("button", { name: "Tag urgent" }));
    await view.user.click(view.getByRole("button", { name: "Tag later" }));
    await view.expectParity("tagged");
    await expect.element(view.getByText("Tags: urgent, later")).toBeVisible();
  });

  it(
    "sizes the notes by their lines, and keeps the size when the board renders again",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(TaskBoard, "initial");
      await view.user.type(
        view.getByRole("textbox", { name: "Notes" }),
        "a{Enter}b{Enter}c{Enter}d",
      );
      await view.expectParity("notes-grown");
      await expect
        .element(view.getByRole("textbox", { name: "Notes" }))
        .toHaveAttribute("style", "height: 6em;");
      await expect.element(view.getByRole("textbox", { name: "Notes" })).toHaveClass("tall");
      await view.user.click(view.getByRole("button", { name: "Tag urgent" }));
      await view.expectParity("notes-kept");
      await expect.element(view.getByText("Tags: urgent")).toBeVisible();
      await expect
        .element(view.getByRole("textbox", { name: "Notes" }))
        .toHaveAttribute("style", "height: 6em;");
      await expect.element(view.getByRole("textbox", { name: "Notes" })).toHaveClass("tall");
    },
  );

  it(
    "sizes the summary through its own element, and keeps the size when bound styles change",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(TaskBoard, "initial");
      await view.user.type(
        view.getByRole("textbox", { name: "Summary" }),
        "a{Enter}b{Enter}c{Enter}d",
      );
      await view.expectParity("summary-grown");
      await expect
        .element(view.getByRole("textbox", { name: "Summary" }))
        .toHaveAttribute("style", "height: 6em;");
      await expect.element(view.getByRole("textbox", { name: "Summary" })).toHaveClass("tall");
      await view.user.click(view.getByRole("button", { name: "Finish Write docs" }));
      await view.expectParity("summary-kept");
      await expect.element(view.getByText("Done: Write docs")).toBeVisible();
      await expect
        .element(view.getByRole("textbox", { name: "Summary" }))
        .toHaveAttribute("style", "height: 6em;");
      await expect.element(view.getByRole("textbox", { name: "Summary" })).toHaveClass("tall");
    },
  );
});
