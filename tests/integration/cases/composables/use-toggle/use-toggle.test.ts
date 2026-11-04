// composables/use-toggle: a component calls a composable from a `.uf.ts` module, reads the ref
// it returns and calls the functions it returns from its listeners (ADR-0069). The composable's
// value parameter seeds its state once.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Disclosure from "./Disclosure.uf.tsx";

describeTargets("composables/use-toggle", () => {
  it("renders closed", async () => {
    const view = await mountScenario(Disclosure, "closed");
    await view.expectParity("closed");
    await expect
      .element(view.getByRole("button", { name: "Shipping details" }))
      .toHaveAttribute("aria-expanded", "false");
  });

  it(
    "opens and closes through the returned functions",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(Disclosure, "closed");
      await view.user.click(view.getByRole("button", { name: "Shipping details" }));
      await view.expectParity("toggled-open");
      await expect.element(view.getByText("Orders ship within two days.")).toBeVisible();
      await view.user.click(view.getByRole("button", { name: "Close" }));
      await view.expectParity("closed-again");
      await expect
        .element(view.getByRole("button", { name: "Shipping details" }))
        .toHaveAttribute("aria-expanded", "false");
    },
  );
});
