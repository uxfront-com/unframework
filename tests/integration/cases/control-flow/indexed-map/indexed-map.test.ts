// control-flow/indexed-map: a list keyed by its index, which also appears in text and in an
// attribute; repeated values are fine, because the keys are the indices.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import StepList from "./StepList.uf.tsx";

describeTargets("control-flow/indexed-map", () => {
  it("numbers each item from its index", async () => {
    const view = await mountScenario(StepList, "three-steps");
    await view.expectParity("three-steps");
    await expect.element(view.getByRole("list", { name: "Brew tea" })).toBeVisible();
    await expect
      .element(view.getByText("Step 1: Boil the water"))
      .toHaveAttribute("data-step", "1");
    await expect
      .element(view.getByText("Step 3: Steep for three minutes"))
      .toHaveAttribute("data-step", "3");
  });

  it("renders repeated values under their own indices", async () => {
    const view = await mountScenario(StepList, "repeated-steps");
    await view.expectParity("repeated-steps");
    await expect.element(view.getByText("Step 1: Fold")).toHaveAttribute("data-step", "1");
    await expect.element(view.getByText("Step 3: Fold")).toHaveAttribute("data-step", "3");
    await expect.element(view.getByText("Step 4: Turn")).toBeVisible();
  });
});
