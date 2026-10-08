// expose/several: a counter exposes `increment` and `reset` (ADR-0054), and its parent drives
// it through a component ref.
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import Controls from "./Controls.uf.tsx";

describeTargets("expose/several", () => {
  it("renders the starting count", async () => {
    const view = await mount(Controls);
    await view.expectParity("initial");
    await expect.element(view.getByRole("status")).toHaveTextContent("10");
  });

  it("calls each exposed function", { requires: ["interactivity"] }, async () => {
    const view = await mount(Controls);
    await view.user.click(view.getByRole("button", { name: "More" }));
    await view.user.click(view.getByRole("button", { name: "More" }));
    await view.expectParity("after-more");
    await expect.element(view.getByRole("status")).toHaveTextContent("12");
    await view.user.click(view.getByRole("button", { name: "Reset" }));
    await view.expectParity("after-reset");
    await expect.element(view.getByRole("status")).toHaveTextContent("10");
  });
});
