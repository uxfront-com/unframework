// semantics/emit: `emit` is a statement that returns nothing, and the component never waits for
// its listeners (Qwik's run asynchronously). The emits that one synchronous run of code makes
// arrive in the order it made them: before and after a write, in a loop, and with no payload
// (semantics contract, emit).
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import StarRating from "./StarRating.uf.tsx";

describeTargets("semantics/emit", () => {
  it("renders five unselected stars", async () => {
    const view = await mountScenario(StarRating, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("status")).toHaveTextContent("0 of 5");
    await expect.element(view.getByRole("button", { name: "5 stars" })).toBeVisible();
  });

  it("emits before and after a write, in order", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(StarRating, "initial");
    await view.user.click(view.getByRole("button", { name: "3 stars" }));
    await view.expectParity("rated-three");
    await expect.element(view.getByRole("status")).toHaveTextContent("3 of 5");
    expect(view.events()).toEqual([
      ["preview", 3],
      ["rate", 3, 0],
    ]);
  });

  it(
    "emits in a loop, then an event with no payload",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(StarRating, "initial");
      await view.user.click(view.getByRole("button", { name: "2 stars" }));
      await view.user.click(view.getByRole("button", { name: "Clear" }));
      await view.expectParity("cleared");
      await expect.element(view.getByRole("status")).toHaveTextContent("0 of 5");
      expect(view.emitted("cleared")).toEqual([[]]);
      expect(view.events()).toEqual([
        ["preview", 2],
        ["rate", 2, 0],
        ["preview", 1],
        ["preview", 0],
        ["cleared"],
      ]);
    },
  );
});
