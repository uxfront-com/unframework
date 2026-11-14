// control-flow/keyed-reorder-focus: a row's star button replaces its item with a copy while the
// focus is on it, and the button keeps the focus (semantics contract, keyed lists; ADR-0096).
// Starring maps the item to a new object in place, so a target that keyed a row by the item's
// reference would make a new row and drop the focus. Sorting moves the rows, and each keeps its
// element, so its ticked box. A browser blurs an element that is moved, and each framework picks
// which rows it moves, so the sort starts from a button outside the list.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Playlist from "./Playlist.uf.tsx";

describeTargets("control-flow/keyed-reorder-focus", () => {
  it("renders the tracks in order", async () => {
    const view = await mountScenario(Playlist, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("checkbox").first()).toHaveAccessibleName("Verse");
    await expect.element(view.getByRole("button", { name: "Star Chorus" })).toBeVisible();
  });

  it(
    "keeps the focus on the star button while its item is replaced with a copy",
    { requires: ["interactivity", "keyed-identity"] },
    async () => {
      const view = await mountScenario(Playlist, "initial");
      await view.user.click(view.getByRole("button", { name: "Star Intro" }));
      await view.expectParity("starred");
      await view.user.keyboard("{Enter}");
      await view.expectParity("unstarred");
      const star = view.getByRole("button", { name: "Star Intro" });
      await expect.element(star).toHaveFocus();
      await expect.element(star).toHaveAttribute("aria-pressed", "false");
      await expect.element(view.getByRole("checkbox", { name: "Intro" })).toBeVisible();
    },
  );

  it(
    "keeps each row's ticked box when the list is sorted",
    { requires: ["interactivity", "keyed-identity"] },
    async () => {
      const view = await mountScenario(Playlist, "initial");
      await view.user.click(view.getByRole("checkbox", { name: "Verse" }));
      await view.user.click(view.getByRole("button", { name: "Star Chorus" }));
      await view.user.click(view.getByRole("button", { name: "Sort by title" }));
      await view.expectParity("sorted");
      await expect.element(view.getByRole("checkbox", { name: "Verse" })).toBeChecked();
      await expect
        .element(view.getByRole("checkbox").first())
        .toHaveAccessibleName("Chorus (starred)");
      await expect.element(view.getByRole("checkbox", { name: "Intro" })).not.toBeChecked();
    },
  );
});
