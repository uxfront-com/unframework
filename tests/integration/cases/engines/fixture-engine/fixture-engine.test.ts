// engines/fixture-engine: a styling engine of a few lines (harness/fixture-engine.ts, ADR-0064).
// Its class function and its stylesheet are `virtual:` modules, which every output imports as
// written and the engine's own Vite plugin resolves, with no Styleframe.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Chip from "./Chip.uf.tsx";

describeTargets("engines/fixture-engine", () => {
  it("renders the engine's plain chip", async () => {
    const view = await mountScenario(Chip, "plain");
    await view.expectParity("plain");
    await expect.element(view.getByText("Draft")).toBeVisible();
  });

  it("renders the engine's accent chip", async () => {
    const view = await mountScenario(Chip, "accent");
    await view.expectParity("accent");
    await expect.element(view.getByText("Live")).toBeVisible();
  });
});
