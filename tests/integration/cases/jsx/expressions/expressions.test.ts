// jsx/expressions: arithmetic with precedence, string and number methods, template literals,
// allowed globals (String, Math) and conditional text, interpolated as text.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import OrderSummary from "./OrderSummary.uf.tsx";

describeTargets("jsx/expressions", () => {
  it("computes a single-item order", async () => {
    const view = await mountScenario(OrderSummary, "single-item");
    await view.expectParity("single-item");
    await expect.element(view.getByRole("heading", { name: "Order 000042" })).toBeVisible();
    await expect.element(view.getByText("Customer: ADA LOVELACE")).toBeVisible();
    await expect.element(view.getByText("1 item at 19.99 each")).toBeVisible();
    await expect.element(view.getByText("Total: 19.99")).toBeVisible();
    await expect.element(view.getByText("Standard order, no coupon")).toBeVisible();
    await expect.element(view.getByText("Points earned: 20")).toBeVisible();
  });

  it("computes a bulk order with a clamped discount", async () => {
    const view = await mountScenario(OrderSummary, "bulk");
    await view.expectParity("bulk");
    await expect.element(view.getByRole("heading", { name: "Order 001906" })).toBeVisible();
    await expect.element(view.getByText("12 items at 4.50 each")).toBeVisible();
    await expect.element(view.getByText("Subtotal: 54.00")).toBeVisible();
    await expect.element(view.getByText("Discount: 50%")).toBeVisible();
    await expect.element(view.getByText("Total: 27.00")).toBeVisible();
    await expect.element(view.getByText("Bulk order, coupon applied")).toBeVisible();
  });
});
