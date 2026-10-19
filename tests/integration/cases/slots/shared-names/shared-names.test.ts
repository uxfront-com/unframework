// slots/shared-names: two fills of one child each destructure `({ item })`, and a sibling
// child's fill takes `item` again (ADR-0054). Each name is in scope in its own fill alone.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Chart from "./Chart.uf.tsx";

describeTargets("slots/shared-names", () => {
  it("renders each fill with its own item", async () => {
    const view = await mountScenario(Chart, "three");
    await view.expectParity("three");
    const series = view.getByRole("list", { name: "Series" });
    await expect.element(series.getByRole("listitem").nth(1)).toHaveTextContent("S Snow");
    const captions = view.getByRole("list", { name: "Captions" });
    await expect.element(captions.getByRole("listitem").nth(2)).toHaveTextContent("SUN");
  });
});
