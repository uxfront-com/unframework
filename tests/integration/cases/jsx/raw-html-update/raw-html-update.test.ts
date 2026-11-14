// jsx/raw-html-update: `innerHTML` bound to a computed value renders its markup, and replaces it
// when the value changes (ADR-0097): Angular's pipe runs again for the new string.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Glossary from "./Glossary.uf.tsx";

describeTargets("jsx/raw-html-update", () => {
  it("renders the first definition's markup", async () => {
    const view = await mountScenario(Glossary, "first");
    await view.expectParity("first");
    await expect.element(view.getByRole("heading", { name: "Hoisting" })).toBeVisible();
    await expect.element(view.getByText("top", { exact: true })).toBeVisible();
  });

  it("replaces the markup when the value changes", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(Glossary, "first");
    await view.user.click(view.getByRole("button", { name: "Next term" }));
    await view.expectParity("second");
    await expect.element(view.getByRole("heading", { name: "Closure" })).toBeVisible();
    await expect.element(view.getByText("variables", { exact: true })).toBeVisible();
    await expect.element(view.getByText("See also: scope.")).toHaveClass("aside");
    await expect.element(view.getByText("top", { exact: true })).not.toBeInTheDocument();
  });
});
