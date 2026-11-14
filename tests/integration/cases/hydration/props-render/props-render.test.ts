// hydration/props-render: text, a bound attribute, a class and a conditional branch come from the
// props, in two scenarios. A hydrated page keeps each as the server rendered it, and agrees with
// the client render of the same props (L12).
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Plan from "./Plan.uf.tsx";

describeTargets("hydration/props-render", () => {
  it("renders a plan without a note", async () => {
    const view = await mountScenario(Plan, "basic");
    await view.expectParity("basic");
    await expect.element(view.getByRole("heading", { name: "Basic" })).toBeVisible();
    await expect
      .element(view.getByRole("link", { name: "Choose Basic" }))
      .toHaveAttribute("href", "/plans/basic");
    await expect.element(view.getByText("No commitment.")).toBeVisible();
  });

  it("renders a featured plan with its note", async () => {
    const view = await mountScenario(Plan, "featured");
    await view.expectParity("featured");
    await expect.element(view.getByRole("article", { name: "Team" })).toHaveClass("featured");
    await expect.element(view.getByText("Five seats included.")).toBeVisible();
    await expect.element(view.getByText("20 EUR a month")).toBeVisible();
  });
});
