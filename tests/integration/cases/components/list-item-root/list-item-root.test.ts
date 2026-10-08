// components/list-item-root: a child whose root is an <li> renders as the items of its parent's
// <ul> (ADR-0054's contextual root: Angular declares it unsupported, ADR-0056).
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Menu from "./Menu.uf.tsx";

describeTargets("components/list-item-root", () => {
  it("renders each item in the list", async () => {
    const view = await mountScenario(Menu, "three");
    await view.expectParity("three");
    await expect.element(view.getByRole("listitem").nth(1)).toHaveTextContent("Docs");
    await expect.element(view.getByRole("list", { name: "Menu" })).toBeVisible();
  });
});
