// semantics/props-seed-let: setup `let`s seeded from a required prop, an optional prop and a
// state seeded from a prop take the values the component was created with, read once, and keep
// them across a rerender (setup runs once). Beside them: a watcher of an array source whose
// callback annotates its tuple parameter, a `watchEffect` that reads its values through a local
// function, a captured `let` updated inside an arrow's expression, and a type-predicate helper.
import { describeTargets, it, mount, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Ballot from "./Ballot.uf.tsx";

describeTargets("semantics/props-seed-let", () => {
  it("renders the votes the props give", async () => {
    const view = await mountScenario(Ballot, "three-votes");
    await view.expectParity("three-votes");
    await expect.element(view.getByRole("status")).toHaveTextContent("3 votes left");
    await expect.element(view.getByRole("button", { name: "maybe" })).toBeVisible();
  });

  it(
    "reads the lets seeded from the props and from a seeded state",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(Ballot, "three-votes");
      await view.user.click(view.getByRole("button", { name: "yes" }));
      await view.expectParity("voted-yes");
      await expect.element(view.getByRole("status")).toHaveTextContent("2 votes left");
      expect(view.emitted("voted")).toEqual([[2, "Lunch (3)! 3"]]);
      await view.user.click(view.getByRole("button", { name: "maybe" }));
      await view.expectParity("voted-maybe");
      await expect.element(view.getByText("Picked: other")).toBeVisible();
      expect(view.emitted("voted")).toEqual([
        [2, "Lunch (3)! 3"],
        [1, "Lunch (3)!! 2"],
      ]);
      expect(view.emitted("moved")).toEqual([["none:3>yes:2"], ["yes:2>other:1"]]);
      expect(view.emitted("report")).toEqual([
        ["none with 3 left"],
        ["yes with 2 left"],
        ["other with 1 left"],
      ]);
    },
  );

  // Browser-only: a rerender has no server twin.
  it(
    "keeps the lets' first values across a rerender",
    { requires: ["interactivity"] },
    async () => {
      const view = await mount(Ballot, {
        props: { limit: 3, label: "Lunch", choices: ["yes", "no", "maybe"] },
      });
      await view.rerender({ limit: 5, label: "Dinner", choices: ["yes", "no", "maybe"] });
      await view.user.click(view.getByRole("button", { name: "no" }));
      await view.expectParity("voted-after-rerender");
      await expect.element(view.getByRole("region", { name: "Dinner" })).toBeVisible();
      await expect.element(view.getByRole("status")).toHaveTextContent("2 votes left");
      expect(view.emitted("voted")).toEqual([[2, "Lunch (3)! 3"]]);
    },
  );

  it(
    "counts the answers through a let a callback updates",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(Ballot, "three-votes");
      await view.user.click(view.getByRole("button", { name: "Count the answers" }));
      await view.expectParity("counted");
      await expect.element(view.getByRole("status")).toHaveTextContent("3 votes left");
      expect(view.emitted("counted")).toEqual([[2]]);
    },
  );
});
