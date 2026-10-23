// styleframe/recipe-variants: a recipe's variants, driven by props (ADR-0064). An absent prop takes
// the recipe's default variant, as Styleframe's runtime decides on every target.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Button from "./Button.uf.tsx";

describeTargets("styleframe/recipe-variants", () => {
  it("renders the default variants", async () => {
    const view = await mountScenario(Button, "default");
    await view.expectParity("default");
    await expect.element(view.getByRole("button", { name: "Cancel" })).toBeVisible();
  });

  it("renders the variants the props choose", async () => {
    const view = await mountScenario(Button, "large-primary");
    await view.expectParity("large-primary");
    await expect.element(view.getByRole("button", { name: "Publish" })).toBeVisible();
  });
});
