// control-flow/union-props: props of a union type, narrowed by `Array.isArray`, `typeof` and a
// discriminant (`ok: true | false`), render each side through the reads only that side has
// (`join`, `toFixed`, `toLowerCase`, `match`, `error`).
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import FilterSummary from "./FilterSummary.uf.tsx";

describeTargets("control-flow/union-props", () => {
  it("renders the array, the number and the match", async () => {
    const view = await mountScenario(FilterSummary, "array-and-number");
    await view.expectParity("array-and-number");
    await expect.element(view.getByText("Tags: design, research")).toBeVisible();
    await expect.element(view.getByText("Limit: 13")).toBeVisible();
    await expect.element(view.getByText("Found Quarterly report")).toBeVisible();
    await expect.element(view.getByText("No match", { exact: false })).not.toBeInTheDocument();
  });

  it("renders the string, the text and the error", async () => {
    const view = await mountScenario(FilterSummary, "string-and-text");
    await view.expectParity("string-and-text");
    await expect.element(view.getByText("Tags: design")).toBeVisible();
    await expect.element(view.getByText("Limit: unlimited")).toBeVisible();
    await expect.element(view.getByText("No match: Nothing matches these filters.")).toBeVisible();
    await expect.element(view.getByText("Found", { exact: false })).not.toBeInTheDocument();
  });
});
