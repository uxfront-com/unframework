// styles/child-root: the child-root rule (ADR-0063). A styled toolbar's `.button` rule styles
// the root of each unstyled child button, which carries the toolbar's scope attribute, and its
// `.icon` rule leaves the icon inside the child alone.
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import Toolbar from "./Toolbar.uf.tsx";

describeTargets("styles/child-root", () => {
  it("styles each child's root, and nothing inside it", async () => {
    const view = await mount(Toolbar);
    await view.expectParity("initial");
    await expect.element(view.getByRole("button", { name: "Save" })).toBeVisible();
    await expect.element(view.getByRole("button", { name: "Cancel" })).toBeVisible();
  });
});
