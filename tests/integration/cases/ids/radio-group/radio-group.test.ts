// ids/radio-group: one `useId()` names a radio group and, suffixed with each index, gives every
// radio an id its label points at; a second `useId()` beside it describes the group. A suffixed id
// never equals the other id, on any target. The normaliser renumbers generated ids wherever they
// appear, the group's `name` included.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import SizePicker from "./SizePicker.uf.tsx";

describeTargets("ids/radio-group", () => {
  it("labels each radio of the group and describes the group", async () => {
    const view = await mountScenario(SizePicker, "sizes");
    await view.expectParity("sizes");
    await expect.element(view.getByRole("radio", { name: "M" })).toBeVisible();
    await expect.element(view.getByRole("radio", { name: "L" })).toBeVisible();
    await expect
      .element(view.getByRole("group", { name: "Size" }))
      .toHaveAccessibleDescription("Pick one size.");
    await expect
      .element(view.getByRole("radio", { name: "S" }))
      .toHaveAttribute("name", expect.stringMatching(/^uf-id-/));
  });

  it("picks a size through its label", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(SizePicker, "sizes");
    await view.user.click(view.getByText("M", { exact: true }));
    await view.expectParity("picked-m");
    await expect.element(view.getByRole("radio", { name: "M" })).toBeChecked();
    await expect.element(view.getByRole("status")).toHaveTextContent("M");
  });
});
