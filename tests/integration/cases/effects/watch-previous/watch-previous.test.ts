// effects/watch-previous: `watch(zoom, (value, previous) => …)` gets the source's new value and
// the value it had at the watcher's last callback; a write of the same value runs no callback.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import ZoomControl from "./ZoomControl.uf.tsx";

describeTargets("effects/watch-previous", () => {
  it("renders the zoom with no history", async () => {
    const view = await mountScenario(ZoomControl, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("status")).toHaveTextContent("100%");
  });

  it("records each change with its previous value", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(ZoomControl, "initial");
    await view.user.click(view.getByRole("button", { name: "Zoom in" }));
    await view.user.click(view.getByRole("button", { name: "Zoom in" }));
    await view.user.click(view.getByRole("button", { name: "Zoom out" }));
    await view.user.click(view.getByRole("button", { name: "Reset" }));
    await view.user.click(view.getByRole("button", { name: "Reset" }));
    await view.expectParity("history");
    await expect.element(view.getByRole("status")).toHaveTextContent("100%");
    const entries = view.getByRole("list", { name: "History" }).getByRole("listitem");
    await expect.element(entries.nth(0)).toHaveTextContent("100% to 125%");
    await expect.element(entries.nth(1)).toHaveTextContent("125% to 150%");
    await expect.element(entries.nth(2)).toHaveTextContent("150% to 125%");
    await expect.element(entries.nth(3)).toHaveTextContent("125% to 100%");
    expect(entries.elements()).toHaveLength(4);
  });
});
