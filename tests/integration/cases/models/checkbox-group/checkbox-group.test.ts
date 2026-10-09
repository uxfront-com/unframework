// models/checkbox-group: checkboxes whose `v-model` binds one array add their `value` to it when
// checked and remove it when unchecked (ADR-0054); each is checked while the array holds its value.
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import Drinks from "./Drinks.uf.tsx";

describeTargets("models/checkbox-group", () => {
  it("checks the boxes the array holds", async () => {
    const view = await mount(Drinks);
    await view.expectParity("initial");
    await expect.element(view.getByRole("checkbox", { name: "Tea" })).toBeChecked();
    await expect.element(view.getByRole("checkbox", { name: "Coffee" })).not.toBeChecked();
    await expect.element(view.getByRole("status")).toHaveTextContent("Ordered: tea");
  });

  it("writes the array as the user checks", { requires: ["interactivity"] }, async () => {
    const view = await mount(Drinks);
    await view.user.click(view.getByRole("checkbox", { name: "Coffee" }));
    await view.expectParity("coffee");
    await expect.element(view.getByRole("status")).toHaveTextContent("Ordered: tea, coffee");
    await view.user.click(view.getByRole("checkbox", { name: "Tea" }));
    await view.expectParity("no-tea");
    await expect.element(view.getByRole("status")).toHaveTextContent("Ordered: coffee");
    await view.user.click(view.getByRole("button", { name: "Only juice" }));
    await view.expectParity("juice");
    await expect.element(view.getByRole("checkbox", { name: "Juice" })).toBeChecked();
    await expect.element(view.getByRole("checkbox", { name: "Coffee" })).not.toBeChecked();
  });
});
