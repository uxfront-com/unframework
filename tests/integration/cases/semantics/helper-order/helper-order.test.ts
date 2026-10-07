// semantics/helper-order: client code may call a function declared after it. An initial value
// sorts with a comparator declared later, which a handler also passes on as a value; the first
// of two `onMounted` hooks reads, through a helper, a `computed` declared after both, and still
// runs first; two watchers of one source read through that helper and directly; a `computed` only
// a handler reads gives the handler its value. The order of two watchers is not part of the
// contract, so they emit events of their own; the hooks of one mount run in their order.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import NameSorter from "./NameSorter.uf.tsx";

describeTargets("semantics/helper-order", () => {
  it("renders the names sorted when the state is created", async () => {
    const view = await mountScenario(NameSorter, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByText("Names: Al, Cy")).toBeVisible();
    await expect.element(view.getByText("Added: 0")).toBeVisible();
  });

  it("runs the mounted hooks in their order", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(NameSorter, "initial");
    await view.expectParity("mounted");
    await expect.element(view.getByText("Names: Al, Cy")).toBeVisible();
    expect(view.emitted("started")).toEqual([["first doubled 0"], ["second"]]);
  });

  it(
    "adds a name sorted by the comparator passed as a value",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(NameSorter, "initial");
      await view.user.click(view.getByRole("button", { name: "Add Bo" }));
      await view.expectParity("added");
      await expect.element(view.getByText("Names: Al, Bo, Cy")).toBeVisible();
      await expect.element(view.getByText("Added: 1")).toBeVisible();
      expect(view.emitted("firstSeen")).toEqual([["doubled 2"]]);
      expect(view.emitted("secondSeen")).toEqual([[1]]);
    },
  );

  it(
    "reports a derived value that only a handler reads",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(NameSorter, "initial");
      await view.user.click(view.getByRole("button", { name: "Add Bo" }));
      await view.user.click(view.getByRole("button", { name: "Report" }));
      await view.expectParity("reported");
      await expect.element(view.getByText("Names: Al, Bo, Cy")).toBeVisible();
      expect(view.emitted("total")).toEqual([[6]]);
    },
  );
});
