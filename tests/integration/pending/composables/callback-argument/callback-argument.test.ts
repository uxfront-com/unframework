// composables/callback-argument: a callback passed to a composable is called from its client
// code (ADR-0069), and writes the caller's state and emits as the caller's own function would.
// The caller also renders a constant the composable returns.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Clicker from "./Clicker.uf.tsx";

describeTargets("composables/callback-argument", () => {
  it("renders the count", async () => {
    const view = await mountScenario(Clicker, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("status")).toHaveTextContent("Count: 0");
    await expect.element(view.getByText("Keep going")).toBeVisible();
    await expect.element(view.getByRole("button", { name: "Add 1" })).toBeVisible();
  });

  it("calls back once the limit is reached", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(Clicker, "initial");
    await view.user.click(view.getByRole("button", { name: "Add 1" }));
    await view.user.click(view.getByRole("button", { name: "Add 1" }));
    await view.expectParity("below-limit");
    await expect.element(view.getByText("Keep going")).toBeVisible();
    expect(view.emitted("limit")).toEqual([]);
    await view.user.click(view.getByRole("button", { name: "Add 1" }));
    await view.expectParity("at-limit");
    await expect.element(view.getByText("Reached 3")).toBeVisible();
    expect(view.emitted("limit")).toEqual([[3]]);
    await view.user.click(view.getByRole("button", { name: "Reset" }));
    await view.expectParity("reset");
    await expect.element(view.getByRole("status")).toHaveTextContent("Count: 0");
  });
});
