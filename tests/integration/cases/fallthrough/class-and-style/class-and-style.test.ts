// fallthrough/class-and-style: a consumer's `class` and `style` merge into the child's root
// element (ADR-0054): the class tokens join, and the consumer's declaration wins where both set
// a property. Toggling state updates what falls through.
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import Tags from "./Tags.uf.tsx";

describeTargets("fallthrough/class-and-style", () => {
  it("merges the class and the style into the root", async () => {
    const view = await mount(Tags);
    await view.expectParity("initial");
    await expect.element(view.getByText("wide")).toHaveClass("tag", "wide");
    await expect.element(view.getByText("plain")).toHaveClass("tag");
  });

  it("updates what falls through", { requires: ["interactivity"] }, async () => {
    const view = await mount(Tags);
    await view.user.click(view.getByRole("button", { name: "Toggle" }));
    await view.expectParity("toggled");
    await expect.element(view.getByText("toggled")).toHaveClass("tag", "picked", "active");
  });
});
