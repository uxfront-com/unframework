// effects/watch-identity: a watcher calls back only when its source's value changed by
// `Object.is`. An object state, or a `Map` state, written away and back in one handler ends where
// it started, so it calls nothing back. An immediate watcher of a boolean calls back at once and
// on each change; an array source holding a boolean calls back once for one handler's two
// writes; and an array source's values are an array a function taking one accepts.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import BookShelf from "./BookShelf.uf.tsx";

describeTargets("effects/watch-identity", () => {
  it("renders the shelf", async () => {
    const view = await mountScenario(BookShelf, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByText("Focused: none")).toBeVisible();
    await expect.element(view.getByText("Range: 1 to 5")).toBeVisible();
  });

  it(
    "calls back for a new focus, never for a peek that ends where it started",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(BookShelf, "initial");
      await view.user.click(view.getByRole("button", { name: "Peek Emma" }));
      await view.user.click(view.getByRole("button", { name: "Focus Dune" }));
      await view.user.click(view.getByRole("button", { name: "Peek Emma" }));
      await view.expectParity("focused-and-peeked");
      await expect.element(view.getByText("Focused: Dune")).toBeVisible();
      expect(view.emitted("moved")).toEqual([["Dune", "none"]]);
    },
  );

  it(
    "calls back for a new map, never for one written away and back",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(BookShelf, "initial");
      await view.user.click(view.getByRole("button", { name: "Read Dune" }));
      await view.user.click(view.getByRole("button", { name: "Count again" }));
      await view.expectParity("counted-again");
      await expect.element(view.getByText("Books read: 1")).toBeVisible();
      expect(view.emitted("counted")).toEqual([["1=1"]]);
    },
  );

  it(
    "calls an immediate watcher of a boolean back at once and on each change",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(BookShelf, "initial");
      await view.user.click(view.getByRole("button", { name: "Details" }));
      await view.expectParity("details-open");
      await expect
        .element(view.getByRole("button", { name: "Details" }))
        .toHaveAttribute("aria-expanded", "true");
      expect(view.emitted("toggled")).toEqual([[false], [true]]);
    },
  );

  it(
    "calls back once for one handler's writes of an array source holding a boolean",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(BookShelf, "initial");
      await view.user.click(view.getByRole("button", { name: "Start" }));
      await view.expectParity("started");
      await expect.element(view.getByRole("status")).toHaveTextContent("Loading: busy");
      expect(view.emitted("busy")).toEqual([["Loading", true]]);
    },
  );

  it(
    "passes an array source's values to a function taking an array",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(BookShelf, "initial");
      await view.user.click(view.getByRole("button", { name: "Raise the limit" }));
      await view.expectParity("raised");
      await expect.element(view.getByText("Range: 1 to 6")).toBeVisible();
      expect(view.emitted("summed")).toEqual([[7]]);
    },
  );
});
