// models/radio: radios whose `v-model` binds one value write their own `value` when chosen
// (ADR-0054), and the radio whose value the state holds is checked.
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import Billing from "./Billing.uf.tsx";

describeTargets("models/radio", () => {
  it("checks the state's radio", async () => {
    const view = await mount(Billing);
    await view.expectParity("initial");
    await expect.element(view.getByRole("radio", { name: "Monthly" })).toBeChecked();
    await expect.element(view.getByRole("radio", { name: "Yearly" })).not.toBeChecked();
  });

  it("writes the state as the user chooses", { requires: ["interactivity"] }, async () => {
    const view = await mount(Billing);
    await view.user.click(view.getByRole("radio", { name: "Yearly" }));
    await view.expectParity("yearly");
    await expect.element(view.getByRole("status")).toHaveTextContent("Plan: yearly");
    await view.user.click(view.getByRole("button", { name: "Reset" }));
    await view.expectParity("reset");
    await expect.element(view.getByRole("radio", { name: "Monthly" })).toBeChecked();
  });
});
