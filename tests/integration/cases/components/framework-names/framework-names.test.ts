// components/framework-names: a child named `Transition`, as Vue's built-in is, renders the
// child, beside a child named `TransitionComponent`, and a `KeepAlive` renders itself
// (ADR-0053): each target's output tells its own components from the framework's.
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import Wizard from "./Wizard.uf.tsx";

describeTargets("components/framework-names", () => {
  it("renders the children", async () => {
    const view = await mount(Wizard);
    await view.expectParity("initial");
    await expect.element(view.getByText("Step: details")).toBeVisible();
    await expect.element(view.getByText("Plain child")).toBeVisible();
    await expect.element(view.getByText("Level 0")).toBeVisible();
  });
});
