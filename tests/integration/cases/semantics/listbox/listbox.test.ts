// semantics/listbox: a <select size="3"> without `multiple` is a single-selection list box, and
// HTML selects none of its options until the user picks one. Vue's client selects the first, so
// its `listbox` cell is unsupported and React, whose cell is native, writes the expectations
// (ADR-0033, ADR-0057).
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import ColourList from "./ColourList.uf.tsx";

describeTargets("semantics/listbox", () => {
  it("selects no option", async () => {
    const view = await mount(ColourList);
    await view.expectParity("initial");
    await expect.element(view.getByRole("option", { name: "Red" })).toBeVisible();
    await expect.element(view.getByRole("option", { selected: true })).not.toBeInTheDocument();
    await expect.element(view.getByRole("status")).toHaveTextContent("Picked: none");
  });

  it("selects the option the user picks", { requires: ["interactivity"] }, async () => {
    const view = await mount(ColourList);
    await view.user.selectOptions(view.getByRole("listbox", { name: "Colour" }), "green");
    await view.expectParity("green");
    await expect
      .element(view.getByRole("option", { name: "Green" }))
      .toHaveAttribute("value", "green");
    await expect.element(view.getByRole("option", { selected: true })).toHaveTextContent("Green");
    await expect.element(view.getByRole("status")).toHaveTextContent("Picked: green");
  });
});
