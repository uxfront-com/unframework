// state/toggle-in-branch: handlers inside a conditional's branch that write the ref the branch
// tests (UF3029 counts reads only): the toggle's two expression-bodied branches, a block body that
// clears a colour and closes the panel it sits in, a nullable colour cleared from the branch its
// truthiness opens, and a note field that writes, then clears with Escape, the nullable ref its
// branch is narrowed by.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import FilterPanel from "./FilterPanel.uf.tsx";

describeTargets("state/toggle-in-branch", () => {
  it("renders the closed panel, no colour and no note", async () => {
    const view = await mountScenario(FilterPanel, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("button", { name: "Show colours" })).toBeVisible();
    await expect.element(view.getByText("No colour")).toBeVisible();
    await expect.element(view.getByRole("button", { name: "Add a note" })).toBeVisible();
  });

  it(
    "opens the panel, and closes it from the branch that tests it",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(FilterPanel, "initial");
      await view.user.click(view.getByRole("button", { name: "Show colours" }));
      await view.expectParity("opened");
      await expect.element(view.getByRole("button", { name: "Hide colours" })).toBeVisible();
      await expect.element(view.getByRole("button", { name: "Red" })).toBeVisible();
      await view.user.click(view.getByRole("button", { name: "Hide colours" }));
      await view.expectParity("closed");
      await expect.element(view.getByRole("button", { name: "Show colours" })).toBeVisible();
      await expect.element(view.getByRole("button", { name: "Red" })).not.toBeInTheDocument();
    },
  );

  it(
    "picks a colour, and clears it from the branch it opens",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(FilterPanel, "initial");
      await view.user.click(view.getByRole("button", { name: "Show colours" }));
      await view.expectParity("colours-shown");
      await expect.element(view.getByRole("button", { name: "Red" })).toBeVisible();
      await view.user.click(view.getByRole("button", { name: "Red" }));
      await view.expectParity("red-picked");
      await expect.element(view.getByText("Colour: Red")).toBeVisible();
      await view.user.click(view.getByRole("button", { name: "Clear Red" }));
      await view.expectParity("colour-cleared");
      await expect.element(view.getByText("No colour")).toBeVisible();
      await expect.element(view.getByRole("button", { name: "Hide colours" })).toBeVisible();
    },
  );

  it(
    "resets the colour and closes the panel from a block-bodied handler in it",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(FilterPanel, "initial");
      await view.user.click(view.getByRole("button", { name: "Show colours" }));
      await view.expectParity("reset-ready");
      await expect.element(view.getByRole("button", { name: "Blue" })).toBeVisible();
      await view.user.click(view.getByRole("button", { name: "Blue" }));
      await view.expectParity("blue-picked");
      await expect.element(view.getByRole("button", { name: "Clear Blue" })).toBeVisible();
      await view.user.click(view.getByRole("button", { name: "Reset" }));
      await view.expectParity("reset");
      await expect.element(view.getByText("No colour")).toBeVisible();
      await expect.element(view.getByRole("button", { name: "Show colours" })).toBeVisible();
    },
  );

  it(
    "writes a note in its branch, and clears it there with Escape",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(FilterPanel, "initial");
      await view.user.click(view.getByRole("button", { name: "Add a note" }));
      await view.expectParity("note-opened");
      await expect.element(view.getByText('Draft: ""')).toBeVisible();
      await view.user.type(view.getByLabelText("Note"), "Bring snacks");
      await view.expectParity("note-typed");
      await expect.element(view.getByText('Draft: "Bring snacks"')).toBeVisible();
      await view.user.keyboard("{Escape}");
      await view.expectParity("note-dismissed");
      await expect.element(view.getByRole("button", { name: "Add a note" })).toBeVisible();
    },
  );
});
