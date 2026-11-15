// directives/click-outside: lifecycle/click-outside, with the document listener in a directive
// (ADR-0099). `vClickOutside` sits on the menu, which is rendered from the start, so its
// listener is in place before any click: a click inside keeps the menu open, and one outside
// calls `close`, which closes it and emits `closed`. Once the view unmounts, the directive's
// `unmounted` removes the listener, so the first view no longer reacts.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import ProfileMenu from "./ProfileMenu.uf.tsx";

describeTargets("directives/click-outside", () => {
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
    { requires: ["directive"] },
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

  it("removes the listener when the component unmounts", { requires: ["directive"] }, async () => {
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
  });
});
