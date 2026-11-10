// types/shared-type: a type a `.ts` module declares, read by a component and its child, and
// re-exported by the component (ADR-0068).
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Palette from "./Palette.uf.tsx";

describeTargets("types/shared-type", () => {
  it("passes the shared type on to the child", async () => {
    const view = await mountScenario(Palette, "accent");
    await view.expectParity("accent");
    await expect.element(view.getByText("accent")).toHaveClass("swatch swatch-accent");
  });
});
