// sourcemaps/mounted-throws: an error `onMounted` throws names its authored line (L14, ADR-0078).
// The hook belongs to a child that the click mounts, so the first render has none of it.
import { describeTargets, it, mount } from "@unframework.dev/testing";
import { expect } from "vitest";

import ReportPanel from "./ReportPanel.uf.tsx";

describeTargets("sourcemaps/mounted-throws", () => {
  it("renders the panel without the chart", async () => {
    const view = await mount(ReportPanel);
    await view.expectParity("initial");
    await expect.element(view.getByRole("button", { name: "Show the chart" })).toBeVisible();
  });

  it("maps the hook's throw to its line", { requires: ["interactivity"] }, async () => {
    const view = await mount(ReportPanel);
    const button = view.getByRole("button", { name: "Show the chart" });
    await expect.element(button).toBeVisible();
    await view.expectThrown(() => view.user.click(button));
  });
});
