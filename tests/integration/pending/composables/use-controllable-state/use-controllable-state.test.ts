// composables/use-controllable-state: a generic composable whose getter parameter reads a prop
// reactively and whose callback parameter emits (ADR-0068, ADR-0069). Without the prop the
// component holds the value; with it, the parent's value wins, follows the parent's next value,
// and a change is only reported.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Rating from "./Rating.uf.tsx";

describeTargets("composables/use-controllable-state", () => {
  it("renders its own value", async () => {
    const view = await mountScenario(Rating, "uncontrolled");
    await view.expectParity("uncontrolled");
    await expect.element(view.getByRole("status")).toHaveTextContent("Rated 1 of 3");
  });

  it("renders the parent's value", async () => {
    const view = await mountScenario(Rating, "controlled");
    await view.expectParity("controlled");
    await expect.element(view.getByRole("status")).toHaveTextContent("Rated 2 of 3");
  });

  it("holds and reports a change of its own", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(Rating, "uncontrolled");
    await view.user.click(view.getByRole("button", { name: "Three" }));
    await view.expectParity("uncontrolled-changed");
    await expect.element(view.getByRole("status")).toHaveTextContent("Rated 3 of 3");
    expect(view.emitted("change")).toEqual([[3]]);
  });

  it("reports a change but keeps the parent's value", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(Rating, "controlled");
    await view.user.click(view.getByRole("button", { name: "Three" }));
    await view.expectParity("controlled-changed");
    await expect.element(view.getByRole("status")).toHaveTextContent("Rated 2 of 3");
    expect(view.emitted("change")).toEqual([[3]]);
  });

  // Browser-only: a rerender has no server twin.
  it("follows the parent's next value", async () => {
    const view = await mountScenario(Rating, "controlled");
    await view.rerender({ value: 3 });
    await view.expectParity("controlled-rerendered");
    await expect.element(view.getByRole("status")).toHaveTextContent("Rated 3 of 3");
  });
});
