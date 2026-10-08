// expose/focus: a search field exposes `focus` (ADR-0054's `defineExpose`), and its parent calls
// it through a component ref when a button is clicked.
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import Header from "./Header.uf.tsx";

describeTargets("expose/focus", () => {
  it("renders the field and the button", async () => {
    const view = await mount(Header);
    await view.expectParity("initial");
    await expect.element(view.getByRole("searchbox", { name: "Find" })).toBeVisible();
  });

  it("focuses the field through the ref", { requires: ["interactivity"] }, async () => {
    const view = await mount(Header);
    await view.user.click(view.getByRole("button", { name: "Search" }));
    await view.expectParity("focused");
    await expect.element(view.getByRole("searchbox", { name: "Find" })).toHaveFocus();
  });
});
