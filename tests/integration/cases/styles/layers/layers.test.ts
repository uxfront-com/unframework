// styles/layers: `@layer` (ADR-0063). The compiler scopes the rules inside each layer and keeps
// the layers, so the `theme` layer's colours win over the `base` layer's, which come later in
// the sheet.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Card from "./Card.uf.tsx";

describeTargets("styles/layers", () => {
  it("applies the later layer's colours over the earlier one's", async () => {
    const view = await mountScenario(Card, "layered");
    await view.expectParity("layered");
    await expect.element(view.getByRole("heading", { name: "Layered card" })).toBeVisible();
  });
});
