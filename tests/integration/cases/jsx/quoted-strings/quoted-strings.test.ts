// jsx/quoted-strings: strings in expressions that hold an apostrophe, a double quote or both,
// in bound attributes (`title`, `alt`) and in interpolated text, render exactly as written.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import DraftNotice from "./DraftNotice.uf.tsx";

describeTargets("jsx/quoted-strings", () => {
  it("renders the unsaved copy with every quote", async () => {
    const view = await mountScenario(DraftNotice, "unsaved");
    await view.expectParity("unsaved");
    await expect.element(view.getByAltText("Ada's avatar")).toBeVisible();
    await expect
      .element(view.getByText('Not "saved" yet'))
      .toHaveAttribute("title", "Don't forget to save");
    await expect
      .element(view.getByText('Ada says: "I\'ll save it later."'))
      .toHaveAttribute("title", 'Press "Save" to keep Ada\'s changes');
  });

  it("renders the saved copy", async () => {
    const view = await mountScenario(DraftNotice, "saved");
    await view.expectParity("saved");
    await expect.element(view.getByAltText("Grace's avatar")).toBeVisible();
    await expect.element(view.getByText("Saved")).toHaveAttribute("title", "Saved");
    await expect
      .element(view.getByText("Grace's draft is safe."))
      .toHaveAttribute("title", "Nothing to save");
  });
});
