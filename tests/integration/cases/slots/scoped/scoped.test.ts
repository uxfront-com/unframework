// slots/scoped: a list renders its scoped slot inside `.map`, with each item and its index
// (ADR-0054). One fill destructures the slot's props, the other names them.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Ranking from "./Ranking.uf.tsx";

describeTargets("slots/scoped", () => {
  it("renders each item through the fill", async () => {
    const view = await mountScenario(Ranking, "three");
    await view.expectParity("three");
    const podium = view.getByRole("list", { name: "Podium" });
    await expect.element(podium.getByRole("listitem").nth(1)).toHaveTextContent("2. Grace");
    const initials = view.getByRole("list", { name: "Initials" });
    await expect.element(initials.getByRole("listitem").nth(2)).toHaveTextContent("L");
  });
});
