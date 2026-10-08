// state/counter: plan §4.1's Counter. A ref seeded from a prop, a computed over it, a handler
// that writes by the step prop and emits the new value; the computed shows "Big" past ten.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Counter from "./Counter.uf.tsx";

describeTargets("state/counter", () => {
  it("renders the initial count and the step", async () => {
    const view = await mountScenario(Counter, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("status")).toHaveTextContent("2");
    await expect.element(view.getByRole("button", { name: "+3" })).toBeVisible();
  });

  it(
    "increments by the step and emits the new value",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(Counter, "initial");
      await view.user.click(view.getByRole("button", { name: "+3" }));
      await view.expectParity("after-increment");
      await expect.element(view.getByRole("status")).toHaveTextContent("5");
      expect(view.emitted("change")).toEqual([[5]]);
    },
  );

  it("shows Big once the double passes ten", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(Counter, "initial");
    await view.user.click(view.getByRole("button", { name: "+3" }));
    await view.user.click(view.getByRole("button", { name: "+3" }));
    await view.expectParity("big");
    await expect.element(view.getByRole("status")).toHaveTextContent("8");
    await expect.element(view.getByText("Big")).toBeVisible();
    expect(view.emitted("change")).toEqual([[5], [8]]);
  });
});
