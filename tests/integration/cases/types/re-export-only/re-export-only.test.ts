// types/re-export-only: a component whose module re-exports a type from a `.ts` module it
// otherwise never imports, so each output tree holds that module's copy (ADR-0070, ADR-0071).
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Badge from "./Badge.uf.tsx";

describeTargets("types/re-export-only", () => {
  it("renders the component that re-exports the type", async () => {
    const view = await mountScenario(Badge, "ready");
    await view.expectParity("ready");
    await expect.element(view.getByText("Ready")).toHaveClass("badge");
  });
});
