// models/modifiers: `v-model`'s modifiers on text inputs (ADR-0054), as Vue's `vModelText`
// applies them: `trim` trims what it writes, `lazy` writes on `change` rather than on each
// `input`, and `number` casts the text with `looseToNumber`, keeping the number's leading part.
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import Profile from "./Profile.uf.tsx";

describeTargets("models/modifiers", () => {
  it("shows the state in the fields", async () => {
    const view = await mount(Profile);
    await view.expectParity("initial");
    await expect.element(view.getByRole("textbox", { name: "City" })).toHaveValue("Lisbon");
    await expect.element(view.getByRole("status")).toHaveTextContent("[] from Lisbon, 1");
  });

  it("trims and casts what the user types", { requires: ["interactivity"] }, async () => {
    const view = await mount(Profile);
    await view.user.fill(view.getByRole("textbox", { name: "Name" }), "  Ada  ");
    await view.user.fill(view.getByRole("textbox", { name: "Weight" }), "12.5kg");
    await view.expectParity("typed");
    await expect.element(view.getByRole("status")).toHaveTextContent("[Ada] from Lisbon, 13.5");
  });

  it("writes a lazy field on change", { requires: ["interactivity"] }, async () => {
    const view = await mount(Profile);
    await view.user.fill(view.getByRole("textbox", { name: "City" }), "Porto");
    await view.expectParity("before-change");
    await expect.element(view.getByRole("status")).toHaveTextContent("[] from Lisbon, 1");
    await view.user.tab();
    await view.expectParity("after-change");
    await expect.element(view.getByRole("status")).toHaveTextContent("[] from Porto, 1");
  });
});
