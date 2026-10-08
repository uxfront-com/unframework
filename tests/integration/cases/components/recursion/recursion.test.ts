// components/recursion: a countdown renders itself with one less, until zero, where a branch
// ends the recursion (ADR-0053).
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Countdown from "./Countdown.uf.tsx";

describeTargets("components/recursion", () => {
  it("renders each level down to zero", async () => {
    const view = await mountScenario(Countdown, "three");
    await view.expectParity("three");
    await expect.element(view.getByText("Liftoff")).toBeVisible();
    await expect.element(view.getByText("2", { exact: true })).toBeVisible();
  });
});
