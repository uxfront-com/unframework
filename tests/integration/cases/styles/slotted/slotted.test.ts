// styles/slotted: `:slotted()` (ADR-0063). The frame's `:slotted(.caption)` rule matches the
// caption the gallery fills into the frame's slot, which the gallery stamps with the frame's
// `-s` attribute at compile time, and not the gallery's own caption outside the frame.
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import Gallery from "./Gallery.uf.tsx";

describeTargets("styles/slotted", () => {
  it("styles the slotted caption, and not the one outside the frame", async () => {
    const view = await mount(Gallery);
    await view.expectParity("initial");
    await expect.element(view.getByText("A quiet harbour")).toBeVisible();
    await expect.element(view.getByText("Outside the frame")).toBeVisible();
  });
});
