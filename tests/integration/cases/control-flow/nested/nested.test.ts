// control-flow/nested: a list in a list, a conditional in a list item, and a list as the else
// branch of a conditional.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import MenuBoard from "./MenuBoard.uf.tsx";

describeTargets("control-flow/nested", () => {
  it("renders the courses, their dishes and each dish's condition", async () => {
    const view = await mountScenario(MenuBoard, "open");
    await view.expectParity("open");
    await expect.element(view.getByRole("region", { name: "Starters" })).toBeVisible();
    await expect.element(view.getByText("Tomato soup, 5.50 (vegetarian)")).toBeVisible();
    await expect.element(view.getByText("Chicken wings, 7.00")).toBeVisible();
    await expect.element(view.getByText("Lemon tart, 4.25 (vegetarian)")).toBeVisible();
    await expect.element(view.getByRole("heading", { name: "Specials" })).toBeVisible();
  });

  it("renders the other branch instead of the list", async () => {
    const view = await mountScenario(MenuBoard, "closed");
    await view.expectParity("closed");
    await expect.element(view.getByText("The kitchen is closed.")).toBeVisible();
  });
});
