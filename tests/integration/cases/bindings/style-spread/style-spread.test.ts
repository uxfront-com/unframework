// bindings/style-spread: a spread's `style` key (ADR-0039, ADR-0065), the element's one style:
// an object with camel-case and custom properties on a spread that merges a class, and a
// declaration list on a spread whose source may be absent. The heading's margin reads the
// spread's custom property, which L10 compares. A child's root spreads a `style` key, which the
// consumer's `style` merges over: one `style`, never two.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import Panel from "./Panel.uf.tsx";

describeTargets("bindings/style-spread", () => {
  it("renders each spread's style", async () => {
    const view = await mountScenario(Panel, "framed");
    await view.expectParity("framed");
    const panel = view.getByTitle("Your settings");
    await expect.element(panel).toHaveClass("panel", { exact: true });
    await expect
      .element(panel)
      .toHaveStyle(
        "border-top-color: rgb(30, 90, 60); border-top-style: solid; border-top-width: 3px",
      );
    await expect
      .element(view.getByTitle("Saving"))
      .toHaveStyle("color: rgb(30, 90, 60); padding-left: 8px");
    await expect
      .element(view.getByText("Saved a moment ago"))
      .toHaveStyle("color: rgb(30, 90, 60); font-style: italic");
  });

  it("renders no style from a spread without one, or from an absent spread", async () => {
    const view = await mountScenario(Panel, "bare");
    await view.expectParity("bare");
    await expect
      .element(view.getByText("Changes save as you type."))
      .toHaveStyle("padding-left: 0px");
  });
});
