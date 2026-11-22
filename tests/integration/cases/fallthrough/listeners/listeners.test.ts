// fallthrough/listeners: a consumer's `onClick`, `onFocus` and `onKeydown` on a component it does
// not declare them on are native listeners on the component's root element (ADR-0118). The
// component also declares `pick`, which its own click listener emits: the root's own listener
// runs first, then the consumer's, as Vue merges them. Each listener logs the element it is
// attached to, its event's `currentTarget`, which is the root <button> and never a wrapper
// around it, such as Angular's host, where a bubbling event would log the same entries.
import { describeTargets, it, mount } from "@unframework.dev/testing";
import { expect } from "vitest";

import Picker from "./Picker.uf.tsx";

describeTargets("fallthrough/listeners", () => {
  it("renders the chip and an empty log", async () => {
    const view = await mount(Picker);
    await view.expectParity("initial");
    await expect.element(view.getByRole("button", { name: "Ada" })).toHaveClass("chip");
  });

  it(
    "fires the consumer's listeners from the root",
    { requires: ["interactivity", "event-semantics"] },
    async () => {
      const view = await mount(Picker);
      await view.user.tab();
      await view.expectParity("focused");
      await expect.element(view.getByRole("button", { name: "Ada" })).toHaveFocus();
      await view.user.keyboard("a");
      await view.user.click(view.getByRole("button", { name: "Ada" }));
      await view.expectParity("used");
      const entries = view.getByRole("list", { name: "Log" }).getByRole("listitem");
      expect(entries.elements().map((entry) => entry.textContent)).toEqual([
        "focus on button",
        "keydown a on button",
        "pick Ada",
        "click on button",
      ]);
    },
  );
});
