// ids/label-association: `useId()` gives each instance ids that are unique and stable between the
// server and the browser: one ties the label to the field (`for`), the other the hint
// (`aria-describedby`). Every target prefixes them `uf-id-`, which the normaliser renumbers.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import EmailField from "./EmailField.uf.tsx";

describeTargets("ids/label-association", () => {
  it("labels and describes the field through two ids", async () => {
    const view = await mountScenario(EmailField, "work-email");
    await view.expectParity("work-email");
    await expect.element(view.getByLabelText("Work email")).toBeVisible();
    await expect
      .element(view.getByRole("textbox", { name: "Work email" }))
      .toHaveAccessibleDescription("We send the invoices here.");
    await expect
      .element(view.getByLabelText("Work email"))
      .toHaveAttribute("id", expect.stringMatching(/^uf-id-/));
  });
});
