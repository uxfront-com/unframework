// models/number: `v-model` on a number and a range input binds a number (ADR-0054): the input's
// text is cast as Vue's `looseToNumber` casts it, so the state adds as a number does.
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import Quantity from "./Quantity.uf.tsx";

describeTargets("models/number", () => {
  it("shows the numbers in the fields", async () => {
    const view = await mount(Quantity);
    await view.expectParity("initial");
    await expect.element(view.getByRole("spinbutton", { name: "Count" })).toHaveValue(2);
    await expect.element(view.getByRole("slider", { name: "Volume" })).toHaveValue("5");
    await expect.element(view.getByRole("status")).toHaveTextContent("Next: 3, volume 6");
  });

  it("writes numbers as the user edits", { requires: ["interactivity"] }, async () => {
    const view = await mount(Quantity);
    await view.user.fill(view.getByRole("spinbutton", { name: "Count" }), "7");
    await view.user.type(view.getByRole("slider", { name: "Volume" }), "{ArrowRight}");
    await view.expectParity("edited");
    await expect.element(view.getByRole("status")).toHaveTextContent("Next: 8, volume 7");
    await view.user.click(view.getByRole("button", { name: "Ten" }));
    await view.expectParity("ten");
    await expect.element(view.getByRole("spinbutton", { name: "Count" })).toHaveValue(10);
  });
});
