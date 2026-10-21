// styles/keyframes: `@keyframes` (ADR-0063). The compiler renames `arrive` with the scope id,
// and the `animation` that names it to match. The browser projects run every animation in no
// time (the determinism reset), so the dot keeps the last frame's colour through `forwards`, and
// a name that did not match would leave it uncoloured.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Progress from "./Progress.uf.tsx";

describeTargets("styles/keyframes", () => {
  it("shows the animation's last frame", async () => {
    const view = await mountScenario(Progress, "loaded");
    await view.expectParity("loaded");
    await expect.element(view.getByText("Loaded")).toBeVisible();
  });
});
