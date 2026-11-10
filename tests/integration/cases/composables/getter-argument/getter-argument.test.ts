// composables/getter-argument: getters passed to a composable are read reactively (ADR-0069): a
// prop's getter gives its value on the first render and its new value after a rerender, and a
// getter of the caller's state gives each new value after a write.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Basket from "./Basket.uf.tsx";

describeTargets("composables/getter-argument", () => {
  it("reads the prop through its getter", async () => {
    const view = await mountScenario(Basket, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("status")).toHaveTextContent("Total: 4");
    await expect.element(view.getByText("1 × 4 = 4")).toBeVisible();
  });

  it("follows the caller's state through its getter", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(Basket, "initial");
    await view.user.click(view.getByRole("button", { name: "Add one" }));
    await view.user.click(view.getByRole("button", { name: "Add one" }));
    await view.expectParity("added-two");
    await expect.element(view.getByRole("status")).toHaveTextContent("Total: 12");
    await expect.element(view.getByText("3 × 4 = 12")).toBeVisible();
  });

  // Browser-only: a rerender has no server twin.
  it("follows the prop through its getter after a rerender", async () => {
    const view = await mountScenario(Basket, "initial");
    await view.rerender({ price: 5 });
    await view.expectParity("repriced");
    await expect.element(view.getByRole("status")).toHaveTextContent("Total: 5");
    await expect.element(view.getByText("1 × 5 = 5")).toBeVisible();
  });
});
