// styles/custom-properties: the sheet's `var(--gap)` and `var(--accent)` read the custom
// properties the component sets from its props, `style={{ "--gap": gap }}`: the compiler passes
// custom properties through unchanged (ADR-0063).
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Stack from "./Stack.uf.tsx";

describeTargets("styles/custom-properties", () => {
  it("spaces and outlines the items with the props' values", async () => {
    const view = await mountScenario(Stack, "wide");
    await view.expectParity("wide");
    await expect.element(view.getByRole("listitem").nth(0)).toHaveTextContent("One");
    await expect.element(view.getByText("Three")).toBeVisible();
  });
});
