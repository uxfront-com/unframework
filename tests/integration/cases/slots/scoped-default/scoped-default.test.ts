// slots/scoped-default: a list passes each item to its default slot, which the parent fills
// through a slot object's `default` member with a parameter (ADR-0054).
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Roster from "./Roster.uf.tsx";

describeTargets("slots/scoped-default", () => {
  it("renders each item through the default fill", async () => {
    const view = await mountScenario(Roster, "two");
    await view.expectParity("two");
    await expect.element(view.getByRole("listitem").nth(1)).toHaveTextContent("Grace!");
  });
});
