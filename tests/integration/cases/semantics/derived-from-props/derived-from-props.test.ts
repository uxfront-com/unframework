// semantics/derived-from-props: a computed over a prop follows the prop, and a watcher over a
// getter of a prop runs when a rerender changes it, with the previous value (semantics contract,
// reactive props).
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Temperature from "./Temperature.uf.tsx";

describeTargets("semantics/derived-from-props", () => {
  it("renders the derived values of a mild reading", async () => {
    const view = await mountScenario(Temperature, "mild");
    await view.expectParity("mild");
    await expect.element(view.getByText("68 °F")).toBeVisible();
    await expect.element(view.getByText("Feels mild")).toBeVisible();
  });

  it("renders the derived values of a hot reading", async () => {
    const view = await mountScenario(Temperature, "hot");
    await view.expectParity("hot");
    await expect.element(view.getByText("95 °F")).toBeVisible();
    await expect.element(view.getByRole("figure")).toHaveAttribute("data-level", "hot");
  });

  // Browser-only: a rerender has no server twin. The watcher's emits need `interactivity`.
  it(
    "recomputes and runs the watcher on each rerender",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(Temperature, "mild");
      await view.rerender({ celsius: 35 });
      await view.rerender({ celsius: 2 });
      await view.expectParity("after-rerenders");
      await expect.element(view.getByText("36 °F")).toBeVisible();
      await expect.element(view.getByText("Feels cold")).toBeVisible();
      expect(view.emitted("reading")).toEqual([
        [35, 20],
        [2, 35],
      ]);
    },
  );
});
