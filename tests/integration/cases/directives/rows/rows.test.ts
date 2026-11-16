// directives/rows: a directive on each row a list renders, and on each element a scoped fill
// renders, whose value reads the row's item or the fill's props (ADR-0108). Each element gets
// its own hooks with its own value, counted element by element and directive by directive.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Menu from "./Menu.uf.tsx";

describeTargets("directives/rows", () => {
  it("renders every row and every option", async () => {
    const view = await mountScenario(Menu, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("button", { name: "Rename first" })).toBeVisible();
  });
});
