// state/helpers-after-use: `function` declarations are hoisted, so the setup calls them before
// they are declared: a helper that reads nothing from initial values, a getter and an inline
// handler, and one that reads state and a prop from an initial value, a watcher and a handler.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import PriceTag from "./PriceTag.uf.tsx";

describeTargets("state/helpers-after-use", () => {
  it("renders what the helpers declared later give", async () => {
    const view = await mountScenario(PriceTag, "single");
    await view.expectParity("single");
    await expect.element(view.getByText("Unit: EUR 2.50")).toBeVisible();
    await expect.element(view.getByRole("status")).toHaveTextContent("1 at EUR 2.50");
    await expect.element(view.getByText("Total: EUR 2.50")).toBeVisible();
    await expect.element(view.getByText("Last change: none")).toBeVisible();
  });

  it(
    "calls the helper that reads state from a handler and a watcher",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(PriceTag, "single");
      await view.user.click(view.getByRole("button", { name: "Add one" }));
      await view.user.click(view.getByRole("button", { name: "Add one" }));
      await view.expectParity("three-items");
      await expect.element(view.getByRole("status")).toHaveTextContent("3 at EUR 2.50");
      await expect.element(view.getByText("Total: EUR 7.50")).toBeVisible();
      await expect.element(view.getByText("Last change: 3 at EUR 2.50")).toBeVisible();
    },
  );

  it(
    "calls the helper that reads nothing from an inline handler",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(PriceTag, "single");
      await view.user.click(view.getByRole("button", { name: "Price two" }));
      await view.expectParity("price-of-two");
      await expect.element(view.getByText("Unit: EUR 5.00")).toBeVisible();
      await expect.element(view.getByRole("status")).toHaveTextContent("1 at EUR 2.50");
    },
  );
});
