// state/computed-chain: subtotal, tax and total, each computed from the one before, over a
// quantity that buttons change; a computed with a block body and a literal-union value is bound
// to an attribute.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import OrderSummary from "./OrderSummary.uf.tsx";

describeTargets("state/computed-chain", () => {
  it("renders the chain for one item", async () => {
    const view = await mountScenario(OrderSummary, "single");
    await view.expectParity("single");
    await expect.element(view.getByText("Subtotal: 25.00")).toBeVisible();
    await expect.element(view.getByText("Tax: 5.00")).toBeVisible();
    await expect.element(view.getByText("Total: 30.00")).toBeVisible();
    await expect
      .element(view.getByRole("region", { name: "Order summary" }))
      .toHaveAttribute("data-tier", "standard");
    await expect.element(view.getByRole("button", { name: "Remove one" })).toBeDisabled();
  });

  it(
    "recomputes the whole chain when the quantity grows",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(OrderSummary, "single");
      await view.user.click(view.getByRole("button", { name: "Add one" }));
      await view.user.click(view.getByRole("button", { name: "Add one" }));
      await view.user.click(view.getByRole("button", { name: "Add one" }));
      await view.expectParity("four-items");
      await expect.element(view.getByRole("status")).toHaveTextContent("Quantity: 4");
      await expect.element(view.getByText("Subtotal: 100.00")).toBeVisible();
      await expect.element(view.getByText("Tax: 20.00")).toBeVisible();
      await expect.element(view.getByText("Total: 120.00")).toBeVisible();
      await expect
        .element(view.getByRole("region", { name: "Order summary" }))
        .toHaveAttribute("data-tier", "bulk");
    },
  );

  it(
    "recomputes the chain when the quantity goes down",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(OrderSummary, "single");
      await view.user.click(view.getByRole("button", { name: "Add one" }));
      await view.user.click(view.getByRole("button", { name: "Add one" }));
      await view.user.click(view.getByRole("button", { name: "Remove one" }));
      await view.expectParity("two-items");
      await expect.element(view.getByRole("status")).toHaveTextContent("Quantity: 2");
      await expect.element(view.getByText("Total: 60.00")).toBeVisible();
      await expect.element(view.getByRole("button", { name: "Remove one" })).toBeEnabled();
    },
  );
});
