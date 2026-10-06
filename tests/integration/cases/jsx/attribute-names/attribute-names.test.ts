// jsx/attribute-names: HTML attribute names whose DOM or framework spellings differ (`tabindex`,
// `for`, `readonly`, `colspan`, `maxlength`, `accept-charset`, `crossorigin`), static and bound.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import AccountSettings from "./AccountSettings.uf.tsx";

describeTargets("jsx/attribute-names", () => {
  it("renders the static spellings, and the bound ones for a locked account", async () => {
    const view = await mountScenario(AccountSettings, "locked");
    await view.expectParity("locked");
    await expect
      .element(view.getByRole("form", { name: "Profile" }))
      .toHaveAttribute("accept-charset", "utf-8");
    await expect
      .element(view.getByRole("form", { name: "Plan" }))
      .toHaveAttribute("accept-charset", "utf-8");
    await expect.element(view.getByLabelText("Display name")).toHaveAttribute("maxlength", "40");
    await expect.element(view.getByLabelText("Display name")).toHaveAttribute("readonly");
    await expect.element(view.getByLabelText("Bio")).toHaveAttribute("maxlength", "160");
    await expect.element(view.getByLabelText("Bio")).toHaveAttribute("readonly");
    await expect
      .element(view.getByAltText("Team plan banner"))
      .toHaveAttribute("crossorigin", "anonymous");
    await expect.element(view.getByText("Team")).toHaveAttribute("colspan", "2");
    await expect.element(view.getByText("12")).toHaveAttribute("colspan", "2");
    await expect
      .element(view.getByRole("button", { name: "Profile help" }))
      .toHaveAttribute("tabindex", "0");
    await expect
      .element(view.getByRole("button", { name: "Plan help" }))
      .toHaveAttribute("tabindex", "0");
  });

  it("renders other bound values for an editable account", async () => {
    const view = await mountScenario(AccountSettings, "editable");
    await view.expectParity("editable");
    await expect
      .element(view.getByRole("form", { name: "Plan" }))
      .toHaveAttribute("accept-charset", "iso-8859-1");
    await expect.element(view.getByLabelText("Bio")).toHaveAttribute("maxlength", "280");
    await expect.element(view.getByLabelText("Bio")).toHaveAttribute("id", "profile-bio");
    await expect
      .element(view.getByAltText("Team plan banner"))
      .toHaveAttribute("crossorigin", "use-credentials");
    await expect.element(view.getByText("12")).toHaveAttribute("colspan", "1");
    await expect
      .element(view.getByRole("button", { name: "Plan help" }))
      .toHaveAttribute("tabindex", "-1");
  });
});
