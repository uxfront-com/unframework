// semantics/props-seed-state: `ref(initial)` seeds the state with the value the prop had when the
// component was created: Angular's output must read it after its inputs are set, not in a field
// initialiser. A rerender with a new seed keeps the state, while the template's reads of the
// props follow them, and increments continue from the state (semantics contract, reactive props).
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import QuantityStepper from "./QuantityStepper.uf.tsx";

describeTargets("semantics/props-seed-state", () => {
  it("seeds the state from the prop", async () => {
    const view = await mountScenario(QuantityStepper, "seeded");
    await view.expectParity("seeded");
    await expect.element(view.getByRole("status")).toHaveTextContent("3");
    await expect.element(view.getByRole("group", { name: "Tickets" })).toBeVisible();
  });

  // Browser-only: a rerender has no server twin.
  it(
    "keeps the state when the seed changes, and continues from it",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(QuantityStepper, "seeded");
      await view.user.click(view.getByRole("button", { name: "Increase Tickets" }));
      await view.rerender({ initial: 10, label: "Seats" });
      await view.user.click(view.getByRole("button", { name: "Increase Seats" }));
      await view.expectParity("after-rerender");
      await expect.element(view.getByRole("status")).toHaveTextContent("5");
      await expect.element(view.getByRole("group", { name: "Seats" })).toBeVisible();
    },
  );
});
