// bindings/style-string: static style strings, with a custom property, shorthands and `var()`.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import Callout from "./Callout.uf.tsx";

describeTargets("bindings/style-string", () => {
  it("renders the static declarations", async () => {
    const view = await mountScenario(Callout, "tip");
    await view.expectParity("tip");
    // A border width computes to 0px without a border style, in the expected styles too.
    await expect
      .element(view.getByRole("complementary", { name: "Tip" }))
      .toHaveStyle(
        "border-left-style: solid; border-left-width: 4px; border-left-color: rgb(31, 77, 122); padding-left: 12px",
      );
    await expect.element(view.getByText("Tip")).toHaveStyle("font-weight: 700");
    await expect.element(view.getByText("Press Enter to save the draft.")).toBeVisible();
  });
});
