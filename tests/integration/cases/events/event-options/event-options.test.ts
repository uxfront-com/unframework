// events/event-options: Vue's option suffixes. `onClickCapture` on a container runs before the
// target's listener and its own bubble listener after it; `stopPropagation()` in the bubble phase
// stops the container's bubble listener only; `onClickOnce` runs once, then lets later clicks
// through to its container; `onWheelPassive` is a passive listener that reads the delta. The
// containers that listen are presentational wrappers around buttons (UF3030).
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import EventLog from "./EventLog.uf.tsx";

describeTargets("events/event-options", () => {
  it("renders the controls and an empty log", async () => {
    const view = await mountScenario(EventLog, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("status")).toHaveTextContent("5");
    await expect.element(view.getByRole("button", { name: "Claim the reward" })).toBeVisible();
  });

  it(
    "runs the container's capture listener first and its bubble listener last",
    { requires: ["interactivity", "event-capture"] },
    async () => {
      const view = await mountScenario(EventLog, "initial");
      await view.user.click(view.getByRole("button", { name: "Inside" }));
      await view.expectParity("capture-and-bubble");
      const entries = view.getByRole("list", { name: "Log" }).getByRole("listitem");
      await expect.element(entries.nth(0)).toHaveTextContent("panel capture");
      await expect.element(entries.nth(1)).toHaveTextContent("button");
      await expect.element(entries.nth(2)).toHaveTextContent("panel bubble");
    },
  );

  it(
    "stops propagation in the bubble phase, after the capture listener ran",
    { requires: ["interactivity", "event-capture"] },
    async () => {
      const view = await mountScenario(EventLog, "initial");
      await view.user.click(view.getByRole("button", { name: "Stop here" }));
      await view.expectParity("propagation-stopped");
      const entries = view.getByRole("list", { name: "Log" }).getByRole("listitem");
      await expect.element(entries.nth(0)).toHaveTextContent("panel capture");
      await expect.element(entries.nth(1)).toHaveTextContent("stopped");
      expect(entries.elements()).toHaveLength(2);
    },
  );

  it("runs a once listener only once", { requires: ["interactivity", "event-once"] }, async () => {
    const view = await mountScenario(EventLog, "initial");
    await view.user.click(view.getByRole("button", { name: "Only once" }));
    await view.user.click(view.getByRole("button", { name: "Only once" }));
    await view.expectParity("once");
    const entries = view.getByRole("list", { name: "Log" }).getByRole("listitem");
    await expect.element(entries.nth(0)).toHaveTextContent("once");
    expect(entries.elements()).toHaveLength(1);
  });

  it(
    "lets a later click through to the container once the once listener is gone",
    { requires: ["interactivity", "event-once"] },
    async () => {
      const view = await mountScenario(EventLog, "initial");
      await view.user.click(view.getByRole("button", { name: "Claim the reward" }));
      await view.user.click(view.getByRole("button", { name: "Claim the reward" }));
      await view.expectParity("claimed-once");
      const entries = view.getByRole("list", { name: "Log" }).getByRole("listitem");
      await expect.element(entries.nth(0)).toHaveTextContent("claimed");
      await expect.element(entries.nth(1)).toHaveTextContent("outer");
      expect(entries.elements()).toHaveLength(2);
    },
  );

  it(
    "reads the delta in a passive wheel listener",
    { requires: ["interactivity", "event-passive"] },
    async () => {
      const view = await mountScenario(EventLog, "initial");
      await view.user.wheel(view.getByRole("group", { name: "Volume" }), { direction: "down" });
      await view.expectParity("wheel-down");
      await expect.element(view.getByRole("status")).toHaveTextContent("4");
    },
  );
});
