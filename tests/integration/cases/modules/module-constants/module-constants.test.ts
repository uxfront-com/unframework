// modules/module-constants: a component reads its own module's top-level constants (ADR-0070): a
// list it renders, a frozen table, a function it calls and a constant that reads another.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Stepper from "./Stepper.uf.tsx";

describeTargets("modules/module-constants", () => {
  it("renders from the module's constants", async () => {
    const view = await mountScenario(Stepper, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("status")).toHaveTextContent("2 of 20");
    await expect.element(view.getByRole("button", { name: "Add 10" })).toBeVisible();
  });

  it("stops at the module's limit", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(Stepper, "initial");
    await view.user.click(view.getByRole("button", { name: "Add 5" }));
    await view.expectParity("added-five");
    await expect.element(view.getByRole("status")).toHaveTextContent("7 of 20");
    await view.user.click(view.getByRole("button", { name: "Add 10" }));
    await view.user.click(view.getByRole("button", { name: "Add 10" }));
    await view.expectParity("at-limit");
    await expect.element(view.getByRole("status")).toHaveTextContent("20 of 20");
  });
});
