// models/checkbox: `v-model` on a checkbox bound to a boolean binds its checked state
// (ADR-0054), both ways.
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import Terms from "./Terms.uf.tsx";

describeTargets("models/checkbox", () => {
  it("checks the box from the state", async () => {
    const view = await mount(Terms);
    await view.expectParity("initial");
    await expect.element(view.getByRole("checkbox", { name: "I agree" })).not.toBeChecked();
    await expect.element(view.getByRole("status")).toHaveTextContent("Not agreed");
  });

  it("writes the state as the user checks", { requires: ["interactivity"] }, async () => {
    const view = await mount(Terms);
    await view.user.click(view.getByRole("checkbox", { name: "I agree" }));
    await view.expectParity("checked");
    await expect.element(view.getByRole("status")).toHaveTextContent("Agreed");
    await view.user.click(view.getByRole("button", { name: "Toggle" }));
    await view.expectParity("toggled");
    await expect.element(view.getByRole("checkbox", { name: "I agree" })).not.toBeChecked();
    await expect.element(view.getByRole("status")).toHaveTextContent("Not agreed");
  });
});
