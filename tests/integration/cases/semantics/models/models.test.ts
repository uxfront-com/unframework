// semantics/models: a model is controllable (plan §4.5, ADR-0054). The same child renders bound
// (`v-model:open`) and unbound beside it. Bound, it shows the parent's value, and its own write
// changes the parent's state; unbound, it keeps local state seeded by its `default`, which no
// write of the parent's reaches.
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import Panels from "./Panels.uf.tsx";

describeTargets("semantics/models", () => {
  it("seeds the bound child from its parent and the unbound one from its default", async () => {
    const view = await mount(Panels);
    await view.expectParity("initial");
    await expect
      .element(view.getByRole("button", { name: "Shipping" }))
      .toHaveAttribute("aria-expanded", "true");
    await expect
      .element(view.getByRole("button", { name: "Returns" }))
      .toHaveAttribute("aria-expanded", "false");
    await expect.element(view.getByText("Details of Shipping")).toBeVisible();
  });

  it(
    "writes the parent's state from the bound child",
    { requires: ["interactivity"] },
    async () => {
      const view = await mount(Panels);
      await view.user.click(view.getByRole("button", { name: "Shipping" }));
      await view.expectParity("bound-closed");
      await expect.element(view.getByRole("status")).toHaveTextContent("Shipping is closed");
      await view.user.click(view.getByRole("button", { name: "Toggle shipping" }));
      await view.expectParity("parent-opened");
      await expect.element(view.getByText("Details of Shipping")).toBeVisible();
    },
  );

  it("keeps an unbound child's state its own", { requires: ["interactivity"] }, async () => {
    const view = await mount(Panels);
    await view.user.click(view.getByRole("button", { name: "Returns" }));
    await view.expectParity("unbound-opened");
    await expect.element(view.getByText("Details of Returns")).toBeVisible();
    await expect.element(view.getByRole("status")).toHaveTextContent("Shipping is open");
    await view.user.click(view.getByRole("button", { name: "Toggle shipping" }));
    await view.expectParity("unbound-kept");
    await expect.element(view.getByText("Details of Returns")).toBeVisible();
  });
});
