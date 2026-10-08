// effects/watch-sources: a getter over two refs runs only when its value changes; an array of refs
// runs when any of them changes, once for two writes in one handler, with the values destructured;
// a getter of a prop runs when a rerender changes it.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import PriceRange from "./PriceRange.uf.tsx";

describeTargets("effects/watch-sources", () => {
  it("renders the range", async () => {
    const view = await mountScenario(PriceRange, "euros");
    await view.expectParity("euros");
    await expect.element(view.getByRole("status")).toHaveTextContent("10 to 50 EUR");
  });

  it(
    "watches a getter over two refs and an array of refs",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(PriceRange, "euros");
      await view.user.click(view.getByRole("button", { name: "Shift up" }));
      await view.user.click(view.getByRole("button", { name: "Widen" }));
      await view.expectParity("shifted-and-widened");
      await expect.element(view.getByRole("status")).toHaveTextContent("20 to 70 EUR");
      expect(view.emitted("rangeUpdate")).toEqual([
        [20, 60],
        [20, 70],
      ]);
      expect(view.emitted("spanUpdate")).toEqual([[50]]);
    },
  );

  // Browser-only: a rerender has no server twin.
  it("watches a prop through a getter", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(PriceRange, "euros");
    await view.rerender({ currency: "USD" });
    await view.expectParity("currency-changed");
    await expect.element(view.getByRole("status")).toHaveTextContent("10 to 50 USD");
    expect(view.emitted("currencyUpdate")).toEqual([["USD"]]);
  });
});
