// slots/presence: a card wraps its title and its body only when the parent fills them, and
// renders a placeholder for an empty body (ADR-0054's presence, `slots.title` as a condition).
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import Cards from "./Cards.uf.tsx";

describeTargets("slots/presence", () => {
  it("wraps only the filled slots", async () => {
    const view = await mount(Cards);
    await view.expectParity("initial");
    await expect.element(view.getByRole("heading", { name: "Weather" })).toBeVisible();
    await expect
      .element(view.getByRole("region", { name: "Bare" }))
      .toHaveTextContent("Empty card");
  });
});
