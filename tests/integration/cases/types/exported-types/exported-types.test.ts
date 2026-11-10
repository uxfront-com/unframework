// types/exported-types: the types a component's module exports, which its consumers import from
// its output (ADR-0068).
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Button from "./Button.uf.tsx";

describeTargets("types/exported-types", () => {
  it("renders with its exported props type", async () => {
    const view = await mountScenario(Button, "secondary");
    await view.expectParity("secondary");
    await expect
      .element(view.getByRole("button", { name: "Cancel" }))
      .toHaveClass("button button-secondary");
  });
});
