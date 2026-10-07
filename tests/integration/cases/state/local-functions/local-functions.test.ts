// state/local-functions: the setup in source order: a constant table, a pure helper that the
// template and a computed both call, state, handlers that call another local function, and a
// handler declared as an arrow constant.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import CheckoutTotal from "./CheckoutTotal.uf.tsx";

describeTargets("state/local-functions", () => {
  it("renders the totals through the helper", async () => {
    const view = await mountScenario(CheckoutTotal, "standard");
    await view.expectParity("standard");
    await expect.element(view.getByText("Subtotal: EUR 49.99")).toBeVisible();
    await expect.element(view.getByText("Shipping: EUR 0.00")).toBeVisible();
    await expect.element(view.getByRole("status")).toHaveTextContent("Total: EUR 49.99");
  });

  it(
    "chooses express shipping through an arrow handler",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(CheckoutTotal, "standard");
      await view.user.click(view.getByRole("button", { name: "Express shipping" }));
      await view.expectParity("express");
      await expect.element(view.getByText("Shipping: EUR 12.00")).toBeVisible();
      await expect.element(view.getByRole("status")).toHaveTextContent("Total: EUR 61.99");
      expect(view.emitted("shippingChange")).toEqual([["express"]]);
    },
  );

  it(
    "returns to standard shipping through a function handler",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(CheckoutTotal, "standard");
      await view.user.click(view.getByRole("button", { name: "Express shipping" }));
      await view.user.click(view.getByRole("button", { name: "Standard shipping" }));
      await view.expectParity("back-to-standard");
      await expect.element(view.getByRole("status")).toHaveTextContent("Total: EUR 49.99");
      await expect
        .element(view.getByRole("button", { name: "Standard shipping" }))
        .toHaveAttribute("aria-pressed", "true");
      expect(view.emitted("shippingChange")).toEqual([["express"], ["standard"]]);
    },
  );
});
