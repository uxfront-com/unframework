// jsx/boolean-and-aria: bound HTML boolean attributes (present or absent), `aria-*` bound to
// booleans ("true" or "false") and to strings, `data-*` bound to strings, and static roles.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import FilterPanel from "./FilterPanel.uf.tsx";

describeTargets("jsx/boolean-and-aria", () => {
  it('renders false booleans: boolean attributes absent, ARIA states "false"', async () => {
    const view = await mountScenario(FilterPanel, "collapsed");
    await view.expectParity("collapsed");
    await expect
      .element(view.getByRole("region", { name: "Filters" }))
      .toHaveAttribute("data-category", "lighting");
    await expect
      .element(view.getByRole("button", { name: "Price filters" }))
      .toHaveAttribute("aria-expanded", "false");
    await expect
      .element(view.getByRole("button", { name: "Price filters" }))
      .toHaveAccessibleDescription("Narrow the results by price.");
    await expect
      .element(view.getByRole("button", { name: "In stock only", pressed: false }))
      .toBeEnabled();
    await expect
      .element(view.getByRole("link", { name: "Filters" }))
      .toHaveAttribute("aria-current", "page");
    await expect.element(view.getByRole("status")).toHaveTextContent("Results ready");
  });

  it('renders true booleans: boolean attributes present, ARIA states "true"', async () => {
    const view = await mountScenario(FilterPanel, "expanded-and-locked");
    await view.expectParity("expanded-and-locked");
    await expect
      .element(view.getByRole("region", { name: "Filters" }))
      .toHaveAttribute("data-category", "seating");
    await expect
      .element(view.getByRole("button", { name: "Price filters" }))
      .toHaveAttribute("aria-expanded", "true");
    const minimum = view.getByRole("spinbutton", { name: "Minimum price" });
    await expect.element(minimum).toBeVisible();
    await expect.element(minimum).toBeDisabled();
    await expect.element(minimum).toBeRequired();
    await expect.element(minimum).toHaveAttribute("aria-invalid", "true");
    await expect
      .element(view.getByRole("button", { name: "In stock only", pressed: true }))
      .toBeDisabled();
    await expect
      .element(view.getByRole("link", { name: "Filters" }))
      .toHaveAttribute("aria-current", "step");
    await expect.element(view.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });
});
