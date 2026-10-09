// dynamic/components: `<component is={compact.value ? Chip : Card}>` renders one of two
// components (ADR-0054), passing both the prop they declare, and switches with the condition.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Tag from "./Tag.uf.tsx";

describeTargets("dynamic/components", () => {
  it("renders the first component", async () => {
    const view = await mountScenario(Tag, "sale");
    await view.expectParity("sale");
    await expect.element(view.getByText("Sale")).toHaveClass("chip");
  });

  it("switches the component", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(Tag, "sale");
    await view.user.click(view.getByRole("button", { name: "Expand" }));
    await view.expectParity("expanded");
    await expect.element(view.getByRole("strong")).toHaveTextContent("Sale");
  });
});
