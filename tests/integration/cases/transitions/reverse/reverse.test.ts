// transitions/reverse: a `<Transition>` whose condition turns true again while its leave runs
// (ADR-0100). Vue removes the leaving element and enters a new one, and Svelte reverses the
// leave: how the toggle looks while it runs is the target's. Either way the open menu ends with
// no class of the transition. The harness gives no transition a duration (plan §7.6), so the
// second test gives the case's `-active` classes one, which keeps the leave running when the
// component's timer opens the menu again. The step's settle waits for the leave and the enter,
// so the timer fires inside it.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Menu from "./Menu.uf.tsx";

describeTargets("transitions/reverse", () => {
  it("renders the open menu", async () => {
    const view = await mountScenario(Menu, "open");
    await view.expectParity("open");
    await expect.element(view.getByText("Profile")).toBeVisible();
  });

  it(
    "ends settled when the menu opens again while it leaves",
    { requires: ["transition", "interactivity"] },
    async () => {
      const style = document.createElement("style");
      // A class beats the harness's `*` among `!important` declarations.
      style.textContent =
        ".fade-enter-active, .fade-leave-active { transition: all 200ms linear !important; }";
      document.head.append(style);
      try {
        const view = await mountScenario(Menu, "open");
        await view.user.click(view.getByRole("button", { name: "Refresh" }));
        await view.expectParity("refreshed");
        await expect
          .element(view.getByRole("button", { name: "Refresh" }))
          .toHaveAttribute("aria-expanded", "true");
        const menus = [...view.container.querySelectorAll(".items")];
        expect(menus.map((menu) => menu.className)).toEqual(["items"]);
      } finally {
        style.remove();
      }
    },
  );
});
