// bindings/table-display: static `display` values that make table-internal boxes (ADR-0065):
// rows, cells and a caption built from divs and spans, laid out as a table, and a cell inside
// an inline box, which Chromium wraps in an anonymous inline table (ADR-0044's addendum).
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import Summary from "./Summary.uf.tsx";

describeTargets("bindings/table-display", () => {
  it("lays out rows and cells as a table", async () => {
    const view = await mountScenario(Summary, "team");
    await view.expectParity("team");
    await expect.element(view.getByText("Account")).toHaveStyle("display: table-caption");
    await expect.element(view.getByText("Team for 5 seats")).toHaveStyle("display: table-cell");
  });
});
