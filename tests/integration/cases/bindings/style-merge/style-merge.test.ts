// bindings/style-merge: static and bound declarations in one style object; a bound declaration
// whose value is undefined (an absent prop) or "" is left out, and the others still render.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import Tag from "./Tag.uf.tsx";

describeTargets("bindings/style-merge", () => {
  it("renders the static and the bound declarations together", async () => {
    const view = await mountScenario(Tag, "styled");
    await view.expectParity("styled");
    await expect
      .element(view.getByText("Urgent"))
      .toHaveStyle(
        "display: inline-block; padding-left: 8px; color: rgb(122, 31, 92); border-top-color: rgb(122, 31, 92); font-weight: 700; margin-left: 16px",
      );
  });

  it("leaves out the nullish and empty declarations", async () => {
    const view = await mountScenario(Tag, "nullish-dropped");
    await view.expectParity("nullish-dropped");
    await expect
      .element(view.getByText("Later"))
      .toHaveStyle("display: inline-block; border-top-color: rgb(90, 90, 90); margin-left: 0px");
  });
});
