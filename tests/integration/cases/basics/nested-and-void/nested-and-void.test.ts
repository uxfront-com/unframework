// basics/nested-and-void: nesting, void elements (img, br, hr, input), entities and a labelled
// input, on every target.
import { describeTargets, mount } from "@unframework/testing";
import { expect, it } from "vitest";

import ProfileCard from "./ProfileCard.uf.tsx";

describeTargets("basics/nested-and-void", () => {
  it("renders the profile card", async () => {
    const view = await mount(ProfileCard);
    // The shared layers first, so they are recorded even when the behaviour below differs.
    await view.expectParity("initial");
    await expect.element(view.getByRole("article", { name: "Ada Lovelace" })).toBeVisible();
    await expect.element(view.getByRole("heading", { name: "Ada Lovelace" })).toBeVisible();
    await expect.element(view.getByAltText("Ada's avatar")).toBeVisible();
    await expect.element(view.getByLabelText("Note")).toHaveAttribute("placeholder", "Say hello");
  });
});
