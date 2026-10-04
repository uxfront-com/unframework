// bindings/class-object: an object of toggles (a shorthand key, quoted keys, a key with two
// names); when every toggle is off the element has no class name, and a class without names is
// the same as no class attribute (ADR-0044).
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import NavItem from "./NavItem.uf.tsx";

describeTargets("bindings/class-object", () => {
  it("adds the names of the toggles that are on", async () => {
    const view = await mountScenario(NavItem, "active");
    await view.expectParity("active");
    const link = view.getByRole("link", { name: "Dashboard" });
    await expect.element(link).toHaveClass("active", { exact: true });
    await expect.element(link).toHaveAttribute("aria-current", "page");
  });

  it("renders no class name when every toggle is off", async () => {
    const view = await mountScenario(NavItem, "all-off");
    await view.expectParity("all-off");
    const link = view.getByRole("link", { name: "Reports" });
    await expect.element(link).toHaveAttribute("href", "/reports");
    await expect.element(link).not.toHaveClass();
  });

  it("adds both names of a two-name key", async () => {
    const view = await mountScenario(NavItem, "muted-danger");
    await view.expectParity("muted-danger");
    await expect
      .element(view.getByRole("link", { name: "Delete account" }))
      .toHaveClass("nav-item-muted nav-item-danger text-danger", { exact: true });
  });
});
