// bindings/class-runtime-collections: class parts that hold arrays and objects at run time
// (ADR-0065), read as Vue's `normalizeClass` reads them: a prop array and a prop object beside a
// static name and a toggle, a lone prop array, and an absent array beside a conditional array
// literal that a click fills.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import TagList from "./TagList.uf.tsx";

describeTargets("bindings/class-runtime-collections", () => {
  it("renders the names an array and an object hold", async () => {
    const view = await mountScenario(TagList, "selected");
    await view.expectParity("selected");
    await expect
      .element(view.getByText("Design"))
      .toHaveClass("tag tag-large tag-blue selected", { exact: true });
    await expect
      .element(view.getByText("Plain"))
      .toHaveClass("tag-large tag-blue", { exact: true });
    await expect.element(view.getByText("Extra")).toHaveClass("tag-extra", { exact: true });
  });

  it("renders no names for an empty array, an empty object or nothing", async () => {
    const view = await mountScenario(TagList, "empty");
    await view.expectParity("empty");
    await expect.element(view.getByText("Empty")).toHaveClass("tag", { exact: true });
  });

  it("adds the names an array gains", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(TagList, "selected");
    await view.user.click(view.getByRole("button", { name: "Expand" }));
    await view.expectParity("expanded");
    await expect
      .element(view.getByText("Design"))
      .toHaveClass("tag tag-large tag-blue selected tag-open", { exact: true });
    await expect
      .element(view.getByText("Extra"))
      .toHaveClass("tag-extra tag-wide tag-tall", { exact: true });
  });
});
