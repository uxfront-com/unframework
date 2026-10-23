// styleframe/tokens: Styleframe's token variables in a scoped sheet (ADR-0063, ADR-0064). The
// component imports Styleframe's stylesheet, which declares the variables on `:root`, and its own
// sheet reads them.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Panel from "./Panel.uf.tsx";

describeTargets("styleframe/tokens", () => {
  it("renders the token values", async () => {
    const view = await mountScenario(Panel, "default");
    await view.expectParity("default");
    await expect.element(view.getByText("Tokens reach scoped styles.")).toBeVisible();
  });
});
