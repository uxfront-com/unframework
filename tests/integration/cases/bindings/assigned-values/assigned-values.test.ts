// bindings/assigned-values: a bound `value` renders its attribute even when it equals what the
// element already holds (a list item's 0, a meter's minimum, a `<data>`'s empty string), on the
// first render as on the server.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import ReviewSummary from "./ReviewSummary.uf.tsx";

describeTargets("bindings/assigned-values", () => {
  it("renders values equal to each element's default", async () => {
    const view = await mountScenario(ReviewSummary, "zero-score");
    await view.expectParity("zero-score");
    const steps = view.getByRole("listitem");
    await expect.element(steps.nth(0)).toHaveAttribute("value", "0");
    await expect.element(steps.nth(1)).toHaveAttribute("value", "1");
    await expect.element(steps.nth(2)).toHaveAttribute("value", "2");
    await expect.element(view.getByRole("meter", { name: "Score" })).toHaveAttribute("value", "0");
    await expect.element(view.getByText("Oak table")).toHaveAttribute("value", "");
  });

  it("renders other values", async () => {
    const view = await mountScenario(ReviewSummary, "rated");
    await view.expectParity("rated");
    await expect.element(view.getByRole("listitem").nth(0)).toHaveAttribute("value", "0");
    await expect.element(view.getByRole("meter", { name: "Score" })).toHaveAttribute("value", "7");
    await expect.element(view.getByText("Walnut desk")).toHaveAttribute("value", "TBL-042");
  });
});
