// modules/shared-helpers: a component calls pure functions a `.ts` module exports, in its
// template, in a derived value and in a listener (ADR-0070).
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import PriceTag from "./PriceTag.uf.tsx";

describeTargets("modules/shared-helpers", () => {
  it("formats the price through the shared helpers", async () => {
    const view = await mountScenario(PriceTag, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByText("Each: €2.50")).toBeVisible();
    await expect.element(view.getByRole("status")).toHaveTextContent("1 item: €2.50");
  });

  it("calls the helpers from a listener", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(PriceTag, "initial");
    await view.user.click(view.getByRole("button", { name: "One more" }));
    await view.user.click(view.getByRole("button", { name: "Order" }));
    await view.expectParity("ordered");
    await expect.element(view.getByRole("status")).toHaveTextContent("2 items: €5.00");
    expect(view.emitted("order")).toEqual([["2 items for €5.00"]]);
  });
});
