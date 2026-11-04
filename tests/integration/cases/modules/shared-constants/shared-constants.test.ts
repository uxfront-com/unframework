// modules/shared-constants: a component reads constants a `.ts` module exports, in its template
// and in its setup (ADR-0070): a lookup table, a default and a frozen list.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import SizePicker from "./SizePicker.uf.tsx";

describeTargets("modules/shared-constants", () => {
  it("renders the shared sizes and the default", async () => {
    const view = await mountScenario(SizePicker, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("status")).toHaveTextContent("Picked: Medium");
    await expect
      .element(view.getByRole("button", { name: "Large" }))
      .toHaveAttribute("aria-pressed", "false");
  });

  it("picks another shared size", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(SizePicker, "initial");
    await view.user.click(view.getByRole("button", { name: "Small" }));
    await view.expectParity("picked-small");
    await expect.element(view.getByRole("status")).toHaveTextContent("Picked: Small");
  });
});
