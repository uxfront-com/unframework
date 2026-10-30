// semantics/composable-unmount-order: a composable's unmount hook runs when the component that
// called it unmounts, and only then: each panel's teardown follows its own unmount, in the order
// the panels go (semantics contract, unmount order, ADR-0069). The harness parent records what
// each panel reports as it closes.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Board from "./Board.uf.tsx";

describeTargets("semantics/composable-unmount-order", () => {
  it("renders both panels", async () => {
    const view = await mountScenario(Board, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("heading", { name: "Panel a" })).toBeVisible();
    await expect.element(view.getByRole("heading", { name: "Panel b" })).toBeVisible();
  });

  it("tears each panel down as it unmounts", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(Board, "initial");
    await view.user.click(view.getByRole("button", { name: "Hide b" }));
    await view.expectParity("b-hidden");
    await expect.element(view.getByRole("status")).toHaveTextContent("b closed");
    await view.user.click(view.getByRole("button", { name: "Hide a" }));
    await view.expectParity("both-hidden");
    await expect.element(view.getByRole("status")).toHaveTextContent("b closed, a closed");
  });
});
