// props/optional: optional props without defaults. Absent, a bound attribute is left out and an
// interpolation renders nothing; `??` gives a fallback for null and undefined, never for "".
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import ContactCard from "./ContactCard.uf.tsx";

describeTargets("props/optional", () => {
  it("leaves out the attributes and text of absent props", async () => {
    const view = await mountScenario(ContactCard, "all-absent");
    await view.expectParity("all-absent");
    await expect.element(view.getByRole("heading", { name: "Grace Hopper" })).toBeVisible();
    await expect.element(view.getByText("Phone: not listed")).toBeVisible();
    await expect
      .element(view.getByRole("article", { name: "Grace Hopper" }))
      .not.toHaveAttribute("data-team");
  });

  it("renders every optional prop when it is given", async () => {
    const view = await mountScenario(ContactCard, "all-present");
    await view.expectParity("all-present");
    await expect
      .element(view.getByRole("article", { name: "Grace Hopper" }))
      .toHaveAttribute("data-team", "Navy");
    await expect
      .element(view.getByRole("heading", { name: "Grace Hopper" }))
      .toHaveAttribute("title", "she/her");
    await expect.element(view.getByText("Rear admiral")).toBeVisible();
    await expect.element(view.getByText("Phone: +1 555 0100")).toBeVisible();
  });

  it("falls back when the nullable prop is null", async () => {
    const view = await mountScenario(ContactCard, "null-phone");
    await view.expectParity("null-phone");
    await expect.element(view.getByText("Phone: not listed")).toBeVisible();
  });

  it("keeps an empty string, which ?? does not replace", async () => {
    const view = await mountScenario(ContactCard, "empty-phone");
    await view.expectParity("empty-phone");
    await expect.element(view.getByText("Phone:", { exact: true })).toBeVisible();
  });
});
