// composables/use-media-query: a composable reads the browser once its caller mounts (ADR-0069).
// The component calls it twice, under two names, and each call holds its own state. Teardown
// across a composable is semantics/composable-unmount-order's.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Layout from "./Layout.uf.tsx";

describeTargets("composables/use-media-query", () => {
  it("reads each query once mounted", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(Layout, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("status")).toHaveTextContent("Wide layout");
    await expect.element(view.getByText("Not a tiny screen")).toBeVisible();
  });
});
