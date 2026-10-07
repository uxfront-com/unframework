// lifecycle/unmount-timers: a handler starts an interval held in a setup `let`; `onUnmounted`
// clears it, so no refresh comes once the component is gone. Every test that starts the interval
// runs it on the view's clock (ADR-0050): it fires only when the spec ticks, and each tick's
// refreshes land in that tick's step on every target, however loaded the machine.
import { describeTargets, it, mount, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import AutoRefresh from "./AutoRefresh.uf.tsx";

describeTargets("lifecycle/unmount-timers", () => {
  it("renders the paused control", async () => {
    const view = await mountScenario(AutoRefresh, "paused");
    await view.expectParity("paused");
    await expect.element(view.getByRole("status")).toHaveTextContent("Paused");
    await expect
      .element(view.getByRole("button", { name: "Auto-refresh" }))
      .toHaveAttribute("aria-pressed", "false");
  });

  it("turns refreshing on and off", { requires: ["interactivity"] }, async () => {
    // On the view's clock, which this test never advances: no refresh comes.
    const view = await mountScenario(AutoRefresh, "paused", { clock: true });
    await view.user.click(view.getByRole("button", { name: "Auto-refresh" }));
    await view.expectParity("toggled-on");
    await expect.element(view.getByRole("status")).toHaveTextContent("Refreshing");
    await view.user.click(view.getByRole("button", { name: "Auto-refresh" }));
    await view.expectParity("toggled-off");
    await expect.element(view.getByRole("status")).toHaveTextContent("Paused");
  });

  // Browser-only: a short interval, on the view's clock.
  it("stops refreshing once unmounted", { requires: ["interactivity"] }, async () => {
    const view = await mount(AutoRefresh, { props: { interval: 500 }, clock: true });
    await view.user.click(view.getByRole("button", { name: "Auto-refresh" }));
    // The clock has not moved: the click's step holds no refresh.
    await view.expectParity("refreshing");
    await expect.element(view.getByRole("status")).toHaveTextContent("Refreshing");
    expect(view.emitted("refresh")).toEqual([]);
    // Past two intervals, short of the third: two refreshes, in this step.
    await view.clock.tick(1250);
    await view.expectParity("refreshed-twice");
    await expect.element(view.getByRole("status")).toHaveTextContent("Refreshing");
    expect(view.emitted("refresh")).toEqual([[1], [2]]);
    await view.unmount();
    // Three more intervals: none fires once the component is gone.
    await view.clock.tick(1500);
    expect(view.emitted("refresh")).toEqual([[1], [2]]);
  });
});
