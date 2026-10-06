// bindings/class-string: a string expression as a class, beside a static name, alone and in a
// template literal. Its whitespace separates names; an empty string or null adds none, and a
// class without names is the same as no class attribute (ADR-0044).
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import Banner from "./Banner.uf.tsx";

describeTargets("bindings/class-string", () => {
  it("adds the bound names beside the static one", async () => {
    const view = await mountScenario(Banner, "warning");
    await view.expectParity("warning");
    await expect.element(view.getByRole("note")).toHaveClass("banner warning", { exact: true });
    await expect
      .element(view.getByText("Scheduled maintenance tonight."))
      .toHaveClass("lead strong", { exact: true });
    await expect
      .element(view.getByText("Shown to every visitor."))
      .toHaveClass("banner-footer banner-footer-warning", { exact: true });
  });

  it("adds no name for an empty string or null", async () => {
    const view = await mountScenario(Banner, "empty-tone");
    await view.expectParity("empty-tone");
    await expect.element(view.getByRole("note")).toHaveClass("banner", { exact: true });
    await expect.element(view.getByText("All systems normal.")).toBeVisible();
    await expect.element(view.getByText("All systems normal.")).not.toHaveClass();
  });

  it("adds no name for an absent optional prop", async () => {
    const view = await mountScenario(Banner, "no-emphasis");
    await view.expectParity("no-emphasis");
    await expect.element(view.getByRole("note")).toHaveClass("banner info", { exact: true });
    await expect.element(view.getByText("New features shipped.")).toBeVisible();
  });
});
