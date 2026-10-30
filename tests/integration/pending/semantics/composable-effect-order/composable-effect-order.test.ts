// semantics/composable-effect-order: a composable's hooks and watchers run where its call sits
// among the caller's own, in source order (semantics contract, effect order, ADR-0069). React
// reorders a component's effects (ADR-0048) and Solid queues watchers per file, so a hook's
// effects can't join the caller's order there: `composable-effect-order` is unsupported on both
// (UF4005), and these tests are skipped by capability.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Timeline from "./Timeline.uf.tsx";

describeTargets("semantics/composable-effect-order", () => {
  it(
    "runs the composable's mounted hook between the caller's",
    { requires: ["interactivity", "composable-effect-order"] },
    async () => {
      const view = await mountScenario(Timeline, "initial");
      await view.expectParity("initial");
      await expect
        .element(view.getByRole("list"))
        .toHaveTextContent("caller mounted firstcomposable mountedcaller mounted last");
    },
  );

  it(
    "runs the composable's watcher before the caller's later one",
    { requires: ["interactivity", "composable-effect-order"] },
    async () => {
      const view = await mountScenario(Timeline, "initial");
      await view.user.click(view.getByRole("button", { name: "Increment" }));
      await view.expectParity("incremented");
      await expect.element(view.getByRole("status")).toHaveTextContent("Count: 1");
      await expect
        .element(view.getByRole("list"))
        .toHaveTextContent(
          "caller mounted firstcomposable mountedcaller mounted lastcomposable watchercaller watcher",
        );
    },
  );
});
