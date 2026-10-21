// styles/focus-visible: a scoped `:focus-visible` rule (ADR-0063), captured before and after
// `view.user.tab` moves the keyboard's focus onto the button (ADR-0050), which draws the ring.
// Astro runs no client code, so its keyboard test is skipped by capability.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Continue from "./Continue.uf.tsx";

describeTargets("styles/focus-visible", () => {
  it("renders the button without a ring", async () => {
    const view = await mountScenario(Continue, "next");
    await view.expectParity("next");
    await expect.element(view.getByRole("button", { name: "Continue" })).toBeVisible();
  });

  it(
    "draws the ring when the keyboard focuses the button",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(Continue, "next");
      await view.user.tab();
      await view.expectParity("focused");
      await expect.element(view.getByRole("button", { name: "Continue" })).toHaveFocus();
    },
  );
});
