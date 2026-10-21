// styles/pseudo-elements: `::before` and `::after` (ADR-0063). The compiler puts the scope
// attribute before the pseudo-element, `.tag[data-uf-<id>]::before`; L10 captures both
// pseudo-elements' styles.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Tag from "./Tag.uf.tsx";

describeTargets("styles/pseudo-elements", () => {
  it("renders the tag between its two pseudo-elements", async () => {
    const view = await mountScenario(Tag, "design");
    await view.expectParity("design");
    await expect.element(view.getByText("design")).toBeVisible();
  });
});
