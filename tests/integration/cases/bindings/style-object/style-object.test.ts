// bindings/style-object: a style object with camelCase properties, custom properties (a string
// and a number), unitless numbers and bound values.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import UsageMeter from "./UsageMeter.uf.tsx";

describeTargets("bindings/style-object", () => {
  it("renders a half-full meter", async () => {
    const view = await mountScenario(UsageMeter, "half");
    await view.expectParity("half");
    await expect
      .element(view.getByText("Storage: 50%"))
      .toHaveStyle("color: rgb(31, 77, 122); font-weight: 700");
    const meter = view.getByRole("progressbar", { name: "Storage" });
    await expect.element(meter).toHaveAttribute("aria-valuenow", "50");
    // A border width computes to 0px without a border style, in the expected styles too.
    await expect
      .element(meter)
      .toHaveStyle("border-top-style: solid; border-top-width: 2px; width: 200px");
  });

  it("renders a full meter in another colour", async () => {
    const view = await mountScenario(UsageMeter, "full");
    await view.expectParity("full");
    await expect.element(view.getByText("Bandwidth: 100%")).toHaveStyle("color: rgb(20, 83, 45)");
    await expect
      .element(view.getByRole("progressbar", { name: "Bandwidth" }))
      .toHaveStyle("border-top-style: solid; border-top-width: 1px");
  });
});
