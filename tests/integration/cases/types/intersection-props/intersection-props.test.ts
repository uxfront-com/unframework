// types/intersection-props: props typed with an intersection of imported interfaces and a type
// literal (ADR-0067): every part's members are props.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Chip from "./Chip.uf.tsx";

describeTargets("types/intersection-props", () => {
  it("renders every part's members", async () => {
    const view = await mountScenario(Chip, "small");
    await view.expectParity("small");
    await expect.element(view.getByText("Draft")).toHaveClass("chip-small chip-neutral");
  });

  it("renders the optional member it is given", async () => {
    const view = await mountScenario(Chip, "accent");
    await view.expectParity("accent");
    await expect.element(view.getByText("Live")).toHaveClass("chip-large chip-accent");
  });
});
