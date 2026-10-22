// styleframe/recipe: a Styleframe recipe called in a `class` (ADR-0064). Every output imports it
// from `virtual:styleframe` as written, and Styleframe's runtime gives its utility classes, which
// Styleframe's stylesheet styles.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Badge from "./Badge.uf.tsx";

describeTargets("styleframe/recipe", () => {
  it("renders the recipe's classes", async () => {
    const view = await mountScenario(Badge, "default");
    await view.expectParity("default");
    await expect.element(view.getByText("New")).toBeVisible();
  });
});
