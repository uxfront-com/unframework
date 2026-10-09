// dynamic/prop-union: `<component is={tag}>`, where the prop `tag` is typed `"h1" | "h2" | "h3"`,
// renders the tag the parent passes (ADR-0054).
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import Outline from "./Outline.uf.tsx";

describeTargets("dynamic/prop-union", () => {
  it("renders each tag the prop names", async () => {
    const view = await mount(Outline);
    await view.expectParity("initial");
    await expect.element(view.getByRole("heading", { level: 1, name: "Guide" })).toBeVisible();
    await expect.element(view.getByRole("heading", { level: 2, name: "Setup" })).toBeVisible();
    await expect
      .element(view.getByRole("heading", { level: 3, name: "Requirements" }))
      .toHaveClass("heading");
  });
});
