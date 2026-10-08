// lifecycle/document-listener: a local function added as a document listener is one function for
// the component's life, so the call that removes it removes it. `onMounted` adds one and
// `onUnmounted` removes it, even after the component rendered again, so a key pressed once the
// component is gone reaches nothing of it; a watcher adds another when a toggle turns on and
// removes it when it turns off, so the key counts only while it is on, and once per press.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import ShortcutTip from "./ShortcutTip.uf.tsx";

describeTargets("lifecycle/document-listener", () => {
  it("renders the tip and the shortcut toggle", async () => {
    const view = await mountScenario(ShortcutTip, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByText("Press Escape to hide this tip.")).toBeVisible();
    await expect
      .element(view.getByRole("button", { name: "Shortcut K" }))
      .toHaveAttribute("aria-pressed", "false");
  });

  it(
    "hides the tip on Escape through the listener added once mounted",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(ShortcutTip, "initial");
      await view.user.keyboard("{Escape}");
      await view.expectParity("dismissed");
      await expect.element(view.getByText("Tip hidden.")).toBeVisible();
      expect(view.emitted("dismissed")).toEqual([[]]);
    },
  );

  it(
    "counts the shortcut only while the watcher keeps its listener, once per press",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(ShortcutTip, "initial");
      await view.user.click(view.getByRole("button", { name: "Shortcut K" }));
      await view.user.keyboard("k");
      await view.expectParity("shortcut-on");
      await expect.element(view.getByRole("status")).toHaveTextContent("Used: 1");
      await view.user.click(view.getByRole("button", { name: "Shortcut K" }));
      await view.user.keyboard("k");
      await view.expectParity("shortcut-off");
      await expect.element(view.getByRole("status")).toHaveTextContent("Used: 1");
      await view.user.click(view.getByRole("button", { name: "Shortcut K" }));
      await view.user.keyboard("k");
      await view.expectParity("shortcut-on-again");
      await expect.element(view.getByRole("status")).toHaveTextContent("Used: 2");
      expect(view.emitted("shortcut")).toEqual([
        ["k", 1],
        ["k", 2],
      ]);
    },
  );

  it(
    "removes the mounted listener when the component unmounts",
    { requires: ["interactivity"] },
    async () => {
      // The first view renders again before it unmounts, so the function removed is the one
      // added once mounted only if a local function keeps one identity across renders.
      const first = await mountScenario(ShortcutTip, "initial");
      await first.user.click(first.getByRole("button", { name: "Shortcut K" }));
      await first.expectParity("first-toggled");
      await expect
        .element(first.getByRole("button", { name: "Shortcut K" }))
        .toHaveAttribute("aria-pressed", "true");
      await first.unmount();
      const second = await mountScenario(ShortcutTip, "initial");
      await second.user.keyboard("{Escape}");
      await second.expectParity("second-dismissed");
      await expect.element(second.getByText("Tip hidden.")).toBeVisible();
      expect(second.emitted("dismissed")).toEqual([[]]);
      expect(first.emitted("dismissed")).toEqual([]);
    },
  );
});
