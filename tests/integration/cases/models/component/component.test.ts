// models/component: a child declares a model with `defineModel`, and its parent binds it with
// `v-model:value` (ADR-0054). The child shows the parent's value, a write in the child reaches
// the parent, and the parent's own write reaches the child.
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import Order from "./Order.uf.tsx";

describeTargets("models/component", () => {
  it("shows the parent's value", async () => {
    const view = await mount(Order);
    await view.expectParity("two");
    await expect.element(view.getByText("Cups: 2")).toBeVisible();
    await expect.element(view.getByRole("status")).toHaveTextContent("Ordered: 2");
  });

  it("writes the parent's value both ways", { requires: ["interactivity"] }, async () => {
    const view = await mount(Order);
    await view.user.click(view.getByRole("button", { name: "More Cups" }));
    await view.expectParity("three");
    await expect.element(view.getByRole("status")).toHaveTextContent("Ordered: 3");
    await view.user.click(view.getByRole("button", { name: "Clear" }));
    await view.expectParity("cleared");
    await expect.element(view.getByText("Cups: 0")).toBeVisible();
    await view.user.click(view.getByRole("button", { name: "Fewer Cups" }));
    await view.expectParity("below-zero");
    await expect.element(view.getByRole("status")).toHaveTextContent("Ordered: -1");
  });
});
