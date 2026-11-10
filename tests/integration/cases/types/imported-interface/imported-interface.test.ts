// types/imported-interface: a props interface imported from a `.ts` module (ADR-0067). Each output
// imports it by name, and its optional member takes the source's default.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Badge from "./Badge.uf.tsx";

describeTargets("types/imported-interface", () => {
  it("renders the label with the default tone", async () => {
    const view = await mountScenario(Badge, "default-tone");
    await view.expectParity("default-tone");
    await expect.element(view.getByText("New")).toHaveClass("badge-info");
  });

  it("renders the tone it is given", async () => {
    const view = await mountScenario(Badge, "danger");
    await view.expectParity("danger");
    await expect.element(view.getByText("Overdue")).toHaveClass("badge-danger");
  });
});
