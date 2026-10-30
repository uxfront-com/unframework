// modules/nested-modules: a component calls a `.ts` module that reads another `.ts` module: each
// output tree holds both, unchanged (ADR-0070).
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Distance from "./Distance.uf.tsx";

describeTargets("modules/nested-modules", () => {
  it("formats through both modules", async () => {
    const view = await mountScenario(Distance, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("status")).toHaveTextContent("42 kilometres");
  });

  it("formats another unit", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(Distance, "initial");
    await view.user.click(view.getByRole("button", { name: "Switch units" }));
    await view.expectParity("switched");
    await expect.element(view.getByRole("status")).toHaveTextContent("42 miles");
  });
});
