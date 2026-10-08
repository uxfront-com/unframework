// events/inline-handlers: arrow functions written in the template: expression bodies that write
// (`++`, a parenthesised assignment), a block body with several writes that also clears the
// uncontrolled note field through a template ref, and an event parameter read through
// `event.currentTarget`.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import ShirtOrder from "./ShirtOrder.uf.tsx";

describeTargets("events/inline-handlers", () => {
  it("renders the default order", async () => {
    const view = await mountScenario(ShirtOrder, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("status")).toHaveTextContent("1 x size M");
    await expect
      .element(view.getByRole("button", { name: "Medium" }))
      .toHaveAttribute("aria-pressed", "true");
  });

  it("writes from expression-bodied arrows", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(ShirtOrder, "initial");
    await view.user.click(view.getByRole("button", { name: "Add one" }));
    await view.user.click(view.getByRole("button", { name: "Add one" }));
    await view.user.click(view.getByRole("button", { name: "Large" }));
    await view.expectParity("large-three");
    await expect.element(view.getByRole("status")).toHaveTextContent("3 x size L");
    await expect
      .element(view.getByRole("button", { name: "Large" }))
      .toHaveAttribute("aria-pressed", "true");
  });

  it(
    "reads the event's current target, then resets in a block body",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(ShirtOrder, "initial");
      await view.user.click(view.getByRole("button", { name: "Small" }));
      await view.user.fill(view.getByLabelText("Note"), "Gift wrap");
      await view.expectParity("noted");
      await expect.element(view.getByRole("status")).toHaveTextContent("1 x size S");
      await expect.element(view.getByText("Note: Gift wrap")).toBeVisible();
      await view.user.click(view.getByRole("button", { name: "Reset" }));
      await view.expectParity("reset");
      await expect.element(view.getByRole("status")).toHaveTextContent("1 x size M");
      await expect.element(view.getByText("Note:", { exact: true })).toBeVisible();
      await expect.element(view.getByLabelText("Note")).toHaveValue("");
    },
  );
});
