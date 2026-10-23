// theming/data-theme: a theme a prop toggles (ADR-0064). The prop sets `data-theme`, and
// Styleframe's `dark` theme gives the element and its descendants the dark tokens.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Themed from "./Themed.uf.tsx";

describeTargets("theming/data-theme", () => {
  it("renders the light theme", async () => {
    const view = await mountScenario(Themed, "light");
    await view.expectParity("light");
    await expect.element(view.getByText("Light theme.")).toBeVisible();
  });

  it("renders the dark theme", async () => {
    const view = await mountScenario(Themed, "dark");
    await view.expectParity("dark");
    await expect.element(view.getByText("Dark theme.")).toBeVisible();
  });
});
