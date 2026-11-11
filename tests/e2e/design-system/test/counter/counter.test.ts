import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Counter from "../../src/Counter.uf.tsx";

describeTargets("counter", () => {
  it("renders the initial count and its double", async () => {
    const view = await mountScenario(Counter, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("status")).toHaveTextContent("2");
    await expect.element(view.getByText("Doubled: 4")).toBeVisible();
  });

  it("adds the step on each click", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(Counter, "initial");
    await view.user.click(view.getByRole("button", { name: "Add 3" }));
    await view.expectParity("after-increment");
    await expect.element(view.getByRole("status")).toHaveTextContent("5");
    await expect.element(view.getByText("Doubled: 10")).toBeVisible();
  });
});
