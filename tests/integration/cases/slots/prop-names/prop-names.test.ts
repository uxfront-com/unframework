// slots/prop-names: a slot's props named `name` and `data-id` reach the fill as written
// (ADR-0054): neither names the slot, and neither is renamed.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Directory from "./Directory.uf.tsx";

describeTargets("slots/prop-names", () => {
  it("passes each prop to the fill", async () => {
    const view = await mountScenario(Directory, "two");
    await view.expectParity("two");
    await expect.element(view.getByRole("listitem").nth(1)).toHaveTextContent("2: Grace (g2)");
  });
});
