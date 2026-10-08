// lifecycle/click-outside: a listener the component adds to the document. It reads the menu's
// template ref when a click arrives, so a click inside the menu keeps it open and a click outside
// closes it. `onMounted` adds it and `onUnmounted` removes the same function, so once the
// component is removed it no longer reacts, though it rendered again in between. (The Ctrl+S
// shortcut this case had is lifecycle/save-shortcut: a control in a function handed to
// `addEventListener` is Qwik's `conditional-event-control`, which would leave this case without
// a Qwik output.)
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import ProfileMenu from "./ProfileMenu.uf.tsx";

describeTargets("lifecycle/click-outside", () => {
  it("renders the closed menu", async () => {
    const view = await mountScenario(ProfileMenu, "initial");
    await view.expectParity("initial");
    await expect
      .element(view.getByRole("button", { name: "Account" }))
      .toHaveAttribute("aria-expanded", "false");
    await expect.element(view.getByText("Outside the menu")).toBeVisible();
  });

  it(
    "keeps the menu open on a click inside it, and closes it on a click outside",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(ProfileMenu, "initial");
      await view.user.click(view.getByRole("button", { name: "Account" }));
      await view.expectParity("menu-open");
      await expect.element(view.getByRole("button", { name: "Settings" })).toBeVisible();
      await view.user.click(view.getByRole("button", { name: "Settings" }));
      await view.expectParity("clicked-inside");
      await expect.element(view.getByRole("button", { name: "Sign out" })).toBeVisible();
      expect(view.emitted("closed")).toEqual([]);
      await view.user.click(view.getByText("Outside the menu"));
      await view.expectParity("clicked-outside");
      await expect
        .element(view.getByRole("button", { name: "Account" }))
        .toHaveAttribute("aria-expanded", "false");
      expect(view.emitted("closed")).toEqual([[]]);
    },
  );

  it(
    "removes the listener when the component unmounts",
    { requires: ["interactivity"] },
    async () => {
      // The first view renders again before it unmounts, so the function removed is the one
      // added once mounted only if a local function keeps one identity across renders.
      const first = await mountScenario(ProfileMenu, "initial");
      await first.user.click(first.getByRole("button", { name: "Account" }));
      await first.expectParity("first-open");
      await expect.element(first.getByRole("button", { name: "Settings" })).toBeVisible();
      await first.unmount();
      const second = await mountScenario(ProfileMenu, "initial");
      await second.user.click(second.getByRole("button", { name: "Account" }));
      await second.expectParity("second-open");
      await expect.element(second.getByRole("button", { name: "Settings" })).toBeVisible();
      await second.user.click(second.getByText("Outside the menu"));
      await second.expectParity("second-closed");
      await expect
        .element(second.getByRole("button", { name: "Account" }))
        .toHaveAttribute("aria-expanded", "false");
      expect(second.emitted("closed")).toEqual([[]]);
      expect(first.emitted("closed")).toEqual([]);
    },
  );
});
