// jsx/svg: an icon with case-exact SVG attributes (`viewBox`, `stroke-width` as a string), a
// labelling `title`, a gradient with `stop`s, and bound size and colour.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import StatusIcon from "./StatusIcon.uf.tsx";

describeTargets("jsx/svg", () => {
  it("renders the icon at its default size and colour", async () => {
    const view = await mountScenario(StatusIcon, "default-size");
    await view.expectParity("default-size");
    const icon = view.getByRole("img", { name: "Task complete" });
    await expect.element(icon).toBeVisible();
    await expect.element(icon).toHaveAttribute("viewBox", "0 0 24 24");
    await expect.element(icon).toHaveAttribute("width", "24");
  });

  it("renders the icon with a bound size and gradient colour", async () => {
    const view = await mountScenario(StatusIcon, "large");
    await view.expectParity("large");
    const icon = view.getByRole("img", { name: "Upload complete" });
    await expect.element(icon).toBeVisible();
    await expect.element(icon).toHaveAttribute("height", "48");
  });
});
