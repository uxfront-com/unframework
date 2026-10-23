// styleframe/recipe-and-scoped: a recipe's classes merged with a scoped sheet's class on one
// element (ADR-0063, ADR-0064). Styleframe's global sheet and the component's scoped sheet set
// different properties, so the captures do not depend on which sheet loads last (`sheet-order`).
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Card from "./Card.uf.tsx";

describeTargets("styleframe/recipe-and-scoped", () => {
  it("renders the recipe and the scoped sheet together", async () => {
    const view = await mountScenario(Card, "default");
    await view.expectParity("default");
    await expect.element(view.getByRole("heading", { name: "Release notes" })).toBeVisible();
  });
});
