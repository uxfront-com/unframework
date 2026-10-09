// models/several: a child declares two models, `min` and `max`, and its parent binds both with
// `v-model:min` and `v-model:max` on one element (ADR-0054). One function of the child writes
// both, and the parent's own write reaches the child.
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import Search from "./Search.uf.tsx";

describeTargets("models/several", () => {
  it("shows both of the parent's values", async () => {
    const view = await mount(Search);
    await view.expectParity("initial");
    await expect.element(view.getByText("From 20 to 50")).toBeVisible();
    await expect.element(view.getByRole("status")).toHaveTextContent("Between 20 and 50");
  });

  it("writes both models", { requires: ["interactivity"] }, async () => {
    const view = await mount(Search);
    await view.user.click(view.getByRole("button", { name: "Widen" }));
    await view.expectParity("widened");
    await expect.element(view.getByRole("status")).toHaveTextContent("Between 10 and 60");
    await view.user.click(view.getByRole("button", { name: "Cheaper" }));
    await view.expectParity("cheaper");
    await expect.element(view.getByText("From 10 to 40")).toBeVisible();
  });
});
