// fallthrough/through-component-root: a toolbar passes an `id`, an `aria-label`, an `onClick`
// and a `ref` to a component whose root is another component (ADR-0118). Each passes on to the
// root element, a <button>: the attributes land on it, the click runs the toolbar's handler, and
// the ref holds the button, which the toolbar focuses.
import { describeTargets, it, mount } from "@unframework.dev/testing";
import { expect } from "vitest";

import Toolbar from "./Toolbar.uf.tsx";

describeTargets("fallthrough/through-component-root", () => {
  it("passes the attributes down to the root element", async () => {
    const view = await mount(Toolbar);
    await view.expectParity("initial");
    const save = view.getByRole("button", { name: "Save draft" });
    await expect.element(save).toHaveAttribute("id", "save");
    await expect.element(save).toHaveClass("pressable", "save");
    await expect.element(view.getByText("Clicks: 0")).toBeVisible();
  });

  it("runs the listener from the root element", { requires: ["interactivity"] }, async () => {
    const view = await mount(Toolbar);
    await view.user.click(view.getByRole("button", { name: "Save draft" }));
    await view.expectParity("clicked");
    await expect.element(view.getByText("Clicks: 1")).toBeVisible();
  });

  it("holds the root element in the ref", { requires: ["interactivity", "expose"] }, async () => {
    const view = await mount(Toolbar);
    await view.user.click(view.getByRole("button", { name: "Focus save" }));
    await view.expectParity("focused");
    await expect.element(view.getByRole("button", { name: "Save draft" })).toHaveFocus();
  });
});
