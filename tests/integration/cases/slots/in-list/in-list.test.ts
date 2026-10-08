// slots/in-list: a list renders its `marker` slot inside `.map` (ADR-0054), so one fill renders
// before each item.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Recipe from "./Recipe.uf.tsx";

describeTargets("slots/in-list", () => {
  it("renders the fill before each step", async () => {
    const view = await mountScenario(Recipe, "tea");
    await view.expectParity("tea");
    await expect.element(view.getByRole("listitem").nth(1)).toHaveTextContent("> Steep");
    await expect.element(view.getByRole("listitem").nth(2)).toHaveTextContent("> Pour");
  });
});
