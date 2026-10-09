// models/select: `v-model` on a <select> binds the selected option's value (ADR-0054), both ways.
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import SizePicker from "./SizePicker.uf.tsx";

describeTargets("models/select", () => {
  it("selects the state's option", async () => {
    const view = await mount(SizePicker);
    await view.expectParity("initial");
    await expect.element(view.getByRole("combobox", { name: "Size" })).toHaveValue("m");
    await expect.element(view.getByRole("status")).toHaveTextContent("Chosen: m");
  });

  it("writes the state as the user selects", { requires: ["interactivity"] }, async () => {
    const view = await mount(SizePicker);
    await view.user.selectOptions(view.getByRole("combobox", { name: "Size" }), "s");
    await view.expectParity("small");
    await expect.element(view.getByRole("status")).toHaveTextContent("Chosen: s");
    await view.user.click(view.getByRole("button", { name: "Largest" }));
    await view.expectParity("large");
    await expect.element(view.getByRole("combobox", { name: "Size" })).toHaveValue("l");
  });
});
