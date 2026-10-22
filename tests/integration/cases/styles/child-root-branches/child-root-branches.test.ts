// styles/child-root-branches: the child-root rule (ADR-0063) on a child whose root is a
// conditional or a `<component is>`. The panel's rules style the branch or the tag each child
// renders, which carries the panel's scope attribute.
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import Panel from "./Panel.uf.tsx";

describeTargets("styles/child-root-branches", () => {
  it("styles the root each child renders", async () => {
    const view = await mount(Panel);
    await view.expectParity("initial");
    await expect.element(view.getByRole("button", { name: "Save" })).toBeVisible();
    await expect.element(view.getByRole("heading", { name: "Release" })).toBeVisible();
  });
});
