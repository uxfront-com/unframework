// lifecycle/next-tick: a handler writes state, awaits `nextTick()`, then reads the updated DOM
// through a template ref on an element in a conditional, and emits what it read: the rows once
// the list renders, and nothing once it is gone (the ref is empty again).
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import ShippingDetails from "./ShippingDetails.uf.tsx";

describeTargets("lifecycle/next-tick", () => {
  it("renders the collapsed details", async () => {
    const view = await mountScenario(ShippingDetails, "initial");
    await view.expectParity("initial");
    await expect
      .element(view.getByRole("button", { name: "Shipping details" }))
      .toHaveAttribute("aria-expanded", "false");
  });

  it(
    "reads the rendered list after nextTick",
    { requires: ["interactivity", "next-tick"] },
    async () => {
      const view = await mountScenario(ShippingDetails, "initial");
      await view.user.click(view.getByRole("button", { name: "Shipping details" }));
      await view.expectParity("expanded");
      await expect.element(view.getByRole("listitem").nth(2)).toHaveTextContent("Tracked delivery");
      expect(view.emitted("toggled")).toEqual([[3]]);
    },
  );

  it(
    "reads an empty ref once the element is removed",
    { requires: ["interactivity", "next-tick"] },
    async () => {
      const view = await mountScenario(ShippingDetails, "initial");
      await view.user.click(view.getByRole("button", { name: "Shipping details" }));
      await view.user.click(view.getByRole("button", { name: "Shipping details" }));
      await view.expectParity("collapsed");
      await expect
        .element(view.getByRole("button", { name: "Shipping details" }))
        .toHaveAttribute("aria-expanded", "false");
      expect(view.emitted("toggled")).toEqual([[3], [0]]);
    },
  );
});
