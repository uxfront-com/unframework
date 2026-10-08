// components/three-levels: a page renders two sections, and each section a heading, each
// component imported from a file of its own (ADR-0053). Props pass down two levels.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Page from "./Page.uf.tsx";

describeTargets("components/three-levels", () => {
  it("renders every level", async () => {
    const view = await mountScenario(Page, "ada");
    await view.expectParity("ada");
    await expect.element(view.getByRole("heading", { name: "About Ada" })).toBeVisible();
    await expect.element(view.getByRole("heading", { name: "Contact" })).toBeVisible();
    await expect.element(view.getByText("Write to Ada.")).toBeVisible();
  });
});
