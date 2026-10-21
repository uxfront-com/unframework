// styles/data-attribute-variants: Open Components–style variants. The props set `data-variant`
// and `data-state`, and the sheet's attribute selectors, scoped like any other (ADR-0063),
// style each combination.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Chip from "./Chip.uf.tsx";

describeTargets("styles/data-attribute-variants", () => {
  it("renders the neutral chip at rest", async () => {
    const view = await mountScenario(Chip, "neutral");
    await view.expectParity("neutral");
    await expect.element(view.getByRole("button", { name: "Draft" })).toBeVisible();
  });

  it("renders the danger chip pressed", async () => {
    const view = await mountScenario(Chip, "danger-pressed");
    await view.expectParity("danger-pressed");
    await expect.element(view.getByRole("button", { name: "Delete" })).toBeVisible();
  });
});
