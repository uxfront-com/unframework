// control-flow/conditional-text: a conditional between two strings is text; conditionals between
// an element and text sit at both edges of their element, the text keeping its edge space.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import SaveIndicator from "./SaveIndicator.uf.tsx";

describeTargets("control-flow/conditional-text", () => {
  it("renders the element branch first and the text branch last", async () => {
    const view = await mountScenario(SaveIndicator, "saving");
    await view.expectParity("saving");
    await expect.element(view.getByText("Saving", { exact: true })).toBeVisible();
    await expect.element(view.getByRole("status")).toHaveTextContent("Saving, 1 change just now");
  });

  it("renders the text branch first and the element branch last", async () => {
    const view = await mountScenario(SaveIndicator, "saved-at-time");
    await view.expectParity("saved-at-time");
    await expect.element(view.getByText("at 10:42")).toHaveAttribute("datetime", "10:42");
    await expect.element(view.getByRole("status")).toHaveTextContent("Saved, 3 changes at 10:42");
  });

  it("renders zero changes as text from a template literal", async () => {
    const view = await mountScenario(SaveIndicator, "saved-no-changes");
    await view.expectParity("saved-no-changes");
    await expect.element(view.getByRole("status")).toHaveTextContent("Saved, 0 changes just now");
  });
});
