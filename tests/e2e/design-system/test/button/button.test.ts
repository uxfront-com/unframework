import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import SaveButton from "./SaveButton.uf.tsx";

describeTargets("button", () => {
  it("renders the primary variant by default", async () => {
    const view = await mountScenario(SaveButton, "primary");
    await view.expectParity("primary");
    await expect
      .element(view.getByRole("button", { name: "Save" }))
      .toHaveAttribute("data-variant", "primary");
  });

  it("renders the secondary variant", async () => {
    const view = await mountScenario(SaveButton, "secondary");
    await view.expectParity("secondary");
    await expect
      .element(view.getByRole("button", { name: "Save" }))
      .toHaveAttribute("data-variant", "secondary");
  });
});
