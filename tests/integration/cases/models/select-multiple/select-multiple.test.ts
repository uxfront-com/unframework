// models/select-multiple: `v-model` on a <select multiple> binds an array of the selected
// options' values (ADR-0054), both ways.
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import ToppingPicker from "./ToppingPicker.uf.tsx";

describeTargets("models/select-multiple", () => {
  it("selects the state's options", async () => {
    const view = await mount(ToppingPicker);
    await view.expectParity("initial");
    await expect.element(view.getByRole("listbox", { name: "Toppings" })).toHaveValue(["cheese"]);
    await expect.element(view.getByRole("status")).toHaveTextContent("On top: cheese");
  });

  it("writes the state as the user selects", { requires: ["interactivity"] }, async () => {
    const view = await mount(ToppingPicker);
    await view.user.selectOptions(view.getByRole("listbox", { name: "Toppings" }), [
      "cheese",
      "basil",
    ]);
    await view.expectParity("chosen");
    await expect.element(view.getByRole("status")).toHaveTextContent("On top: cheese, basil");
    await view.user.click(view.getByRole("button", { name: "Green" }));
    await view.expectParity("green");
    await expect
      .element(view.getByRole("listbox", { name: "Toppings" }))
      .toHaveValue(["olives", "basil"]);
  });
});
