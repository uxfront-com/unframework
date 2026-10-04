// bindings/class-array: a class array with a static name, a template literal, a nested array,
// toggles (`cond && "names"`, one or two names, a number condition) and a conditional string.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import ActionButton from "./ActionButton.uf.tsx";

describeTargets("bindings/class-array", () => {
  it("renders a primary button: its toggle on, a zero badge's toggle off", async () => {
    const view = await mountScenario(ActionButton, "primary-small");
    await view.expectParity("primary-small");
    await expect
      .element(view.getByRole("button", { name: "Save" }))
      .toHaveClass("button button-small button-primary solid", { exact: true });
  });

  it("renders a busy outline button with a badge", async () => {
    const view = await mountScenario(ActionButton, "busy-outline");
    await view.expectParity("busy-outline");
    await expect
      .element(view.getByRole("button", { name: "Sync" }))
      .toHaveClass("button button-large is-busy button-waiting has-badge outline", { exact: true });
  });
});
