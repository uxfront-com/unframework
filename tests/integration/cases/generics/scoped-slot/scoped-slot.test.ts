// generics/scoped-slot: a generic component's scoped slot, whose fill reads the item's own type
// (ADR-0068).
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Fruits from "./Fruits.uf.tsx";

describeTargets("generics/scoped-slot", () => {
  it("renders the fill with each item", async () => {
    const view = await mountScenario(Fruits, "basket");
    await view.expectParity("basket");
    await expect.element(view.getByRole("listitem").nth(0)).toHaveTextContent("Apple × 3");
    await expect.element(view.getByRole("listitem").nth(1)).toHaveTextContent("Pear × 1");
  });
});
