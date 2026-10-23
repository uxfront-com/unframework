// styles/global: `:global()` (ADR-0063). The banner's `:global(.uf-highlight)` rule is written
// as `.uf-highlight`, with no scope attribute, so it styles the highlight inside its unstyled
// child.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Banner from "./Banner.uf.tsx";

describeTargets("styles/global", () => {
  it("styles the child's highlight through the global rule", async () => {
    const view = await mountScenario(Banner, "tip");
    await view.expectParity("tip");
    await expect.element(view.getByText("press Tab")).toBeVisible();
  });
});
