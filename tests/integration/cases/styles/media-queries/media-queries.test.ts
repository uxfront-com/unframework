// styles/media-queries: `@media` (ADR-0063). The compiler scopes the rules inside each query
// and keeps the queries. At the browser projects' fixed 800×600 viewport, the `min-width: 600px`
// rule applies and the `min-width: 1200px` one does not.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Panel from "./Panel.uf.tsx";

describeTargets("styles/media-queries", () => {
  it("applies the query that matches the viewport, and not the other", async () => {
    const view = await mountScenario(Panel, "notice");
    await view.expectParity("notice");
    await expect.element(view.getByText("Wide enough for padding.")).toBeVisible();
  });
});
