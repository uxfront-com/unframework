// refs/focus: template refs give client code the elements: a button focuses the field through
// one, and Escape in the field returns focus to the button through another. Focus is recorded in
// the normalised DOM (`uf:focused`), so L7 and L9 compare it on every target.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import SearchToggle from "./SearchToggle.uf.tsx";

describeTargets("refs/focus", () => {
  it("renders the button and the field", async () => {
    const view = await mountScenario(SearchToggle, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("button", { name: "Search" })).toBeVisible();
    await expect.element(view.getByRole("textbox", { name: "Search the docs" })).toBeVisible();
  });

  it("focuses the field from the button", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(SearchToggle, "initial");
    await view.user.click(view.getByRole("button", { name: "Search" }));
    await view.expectParity("field-focused");
    await expect.element(view.getByRole("textbox", { name: "Search the docs" })).toHaveFocus();
  });

  it("returns focus to the button with Escape", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(SearchToggle, "initial");
    await view.user.click(view.getByRole("button", { name: "Search" }));
    await view.user.keyboard("refs");
    await view.user.keyboard("{Escape}");
    await view.expectParity("focus-returned");
    await expect.element(view.getByRole("button", { name: "Search" })).toHaveFocus();
    await expect
      .element(view.getByRole("textbox", { name: "Search the docs" }))
      .toHaveValue("refs");
  });
});
