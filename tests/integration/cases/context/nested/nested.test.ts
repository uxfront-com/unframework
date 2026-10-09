// context/nested: a component that injects a key and provides it again reads its parent's value
// (`inject` comes first, ADR-0054), so nested providers count the depth: the inner provider wins
// for its descendants, and siblings read the same parent.
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import Outline from "./Outline.uf.tsx";

describeTargets("context/nested", () => {
  it("reads the nearest provider", async () => {
    const view = await mount(Outline);
    await view.expectParity("initial");
    await expect.element(view.getByRole("heading", { name: "Book at depth 0" })).toBeVisible();
    await expect.element(view.getByRole("heading", { name: "Part at depth 1" })).toBeVisible();
    await expect.element(view.getByRole("heading", { name: "Chapter at depth 2" })).toBeVisible();
    await expect.element(view.getByRole("heading", { name: "Appendix at depth 1" })).toBeVisible();
  });
});
