// props/primitives: string, number and boolean props rendered as text and as attributes, and a
// boolean prop that takes its default when it is left out.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import ProductTile from "./ProductTile.uf.tsx";

describeTargets("props/primitives", () => {
  it("renders an available product, the boolean prop taking its default", async () => {
    const view = await mountScenario(ProductTile, "in-stock");
    await view.expectParity("in-stock");
    await expect.element(view.getByRole("article", { name: "Desk lamp" })).toBeVisible();
    await expect.element(view.getByText("Price: 39.5 EUR")).toBeVisible();
    await expect.element(view.getByText("12 in stock")).toHaveAttribute("data-stock", "12");
    await expect
      .element(view.getByRole("button", { name: "Add Desk lamp to basket" }))
      .toBeEnabled();
  });

  it("renders a sold-out product: zero as text and as an attribute, the button disabled", async () => {
    const view = await mountScenario(ProductTile, "sold-out");
    await view.expectParity("sold-out");
    await expect.element(view.getByText("0 in stock")).toHaveAttribute("data-stock", "0");
    await expect.element(view.getByText("Currently unavailable")).toBeVisible();
    await expect
      .element(view.getByRole("button", { name: "Add Floor lamp to basket" }))
      .toBeDisabled();
  });
});
