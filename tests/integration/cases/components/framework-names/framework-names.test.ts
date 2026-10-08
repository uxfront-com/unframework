// components/framework-names: a child named `Transition`, as Vue's built-in is, renders the
// child (ADR-0053): each target's output tells its own component from the framework's.
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import Wizard from "./Wizard.uf.tsx";

describeTargets("components/framework-names", () => {
  it("renders the child", async () => {
    const view = await mount(Wizard);
    await view.expectParity("initial");
    await expect.element(view.getByText("Step: details")).toBeVisible();
  });
});
