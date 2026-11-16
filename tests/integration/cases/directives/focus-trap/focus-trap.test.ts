// directives/focus-trap: `vFocusTrap` from a `.uf.ts` module (ADR-0099) on a dialog a condition
// renders. Its `mounted` runs once the dialog is in the document, so it moves the focus to the
// first control; Tab past the last control lands on the first, and Shift+Tab from the first on
// the last. Its `unmounted` runs when the condition removes the dialog, and gives the focus back
// to Open, which had it before.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Settings from "./Settings.uf.tsx";

describeTargets("directives/focus-trap", () => {
  it("renders closed", async () => {
    const view = await mountScenario(Settings, "closed");
    await view.expectParity("closed");
    await expect.element(view.getByRole("button", { name: "Open" })).toBeVisible();
    await expect.element(view.getByRole("dialog")).not.toBeInTheDocument();
  });

  it(
    "focuses the dialog's first control once it is mounted",
    { requires: ["directive"] },
    async () => {
      const view = await mountScenario(Settings, "closed");
      await view.user.click(view.getByRole("button", { name: "Open" }));
      await view.expectParity("open");
      await expect.element(view.getByRole("button", { name: "Theme" })).toHaveFocus();
    },
  );

  it("keeps Tab past the last control inside", { requires: ["directive"] }, async () => {
    const view = await mountScenario(Settings, "closed");
    await view.user.click(view.getByRole("button", { name: "Open" }));
    await view.expectParity("open-for-tab");
    await view.user.tab();
    await view.user.tab();
    await view.expectParity("on-last-control");
    await expect.element(view.getByRole("button", { name: "Close" })).toHaveFocus();
    await view.user.tab();
    await view.expectParity("after-tab");
    await expect.element(view.getByRole("button", { name: "Theme" })).toHaveFocus();
  });

  it("keeps Shift+Tab from the first control inside", { requires: ["directive"] }, async () => {
    const view = await mountScenario(Settings, "closed");
    await view.user.click(view.getByRole("button", { name: "Open" }));
    await view.expectParity("open-for-shift-tab");
    await expect.element(view.getByRole("button", { name: "Theme" })).toHaveFocus();
    await view.user.tab({ shift: true });
    await view.expectParity("after-shift-tab");
    await expect.element(view.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it(
    "returns the focus to Open once the dialog is removed",
    { requires: ["directive"] },
    async () => {
      const view = await mountScenario(Settings, "closed");
      await view.user.click(view.getByRole("button", { name: "Open" }));
      await view.user.click(view.getByRole("button", { name: "Close" }));
      await view.expectParity("closed-again");
      await expect.element(view.getByRole("dialog")).not.toBeInTheDocument();
      await expect.element(view.getByRole("button", { name: "Open" })).toHaveFocus();
      await view.user.click(view.getByRole("button", { name: "Open" }));
      await view.user.keyboard("{Escape}");
      await view.expectParity("escaped");
      await expect.element(view.getByRole("dialog")).not.toBeInTheDocument();
      await expect.element(view.getByRole("button", { name: "Open" })).toHaveFocus();
    },
  );
});
