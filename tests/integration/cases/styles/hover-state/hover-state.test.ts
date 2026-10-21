// styles/hover-state: a scoped `:hover` rule (ADR-0063), captured at rest and after
// `view.user.hover` moves the pointer onto the button (ADR-0050). Astro runs no client code, so
// its hover test is skipped by capability.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Action from "./Action.uf.tsx";

describeTargets("styles/hover-state", () => {
  it("renders the button at rest", async () => {
    const view = await mountScenario(Action, "publish");
    await view.expectParity("publish");
    await expect.element(view.getByRole("button", { name: "Publish" })).toBeVisible();
  });

  it(
    "inverts the button's colours under the pointer",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(Action, "publish");
      await view.user.hover(view.getByRole("button", { name: "Publish" }));
      await view.expectParity("hovered");
      await expect.element(view.getByRole("button", { name: "Publish" })).toBeVisible();
    },
  );
});
