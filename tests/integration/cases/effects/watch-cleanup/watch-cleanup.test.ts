// effects/watch-cleanup: a watcher's `onCleanup` callback runs right before its next callback and
// when the component is unmounted. A write of the getter's dependency that leaves the getter's
// value unchanged runs neither the callback nor the cleanup (semantics contract, watch semantics).
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import ChannelPicker from "./ChannelPicker.uf.tsx";

describeTargets("effects/watch-cleanup", () => {
  it("renders the first channel", async () => {
    const view = await mountScenario(ChannelPicker, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("status")).toHaveTextContent("Channel: #general");
  });

  it(
    "leaves before each new join, and when unmounted",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(ChannelPicker, "initial");
      await view.user.click(view.getByRole("button", { name: "Join #random" }));
      await view.expectParity("joined-random");
      await expect.element(view.getByRole("status")).toHaveTextContent("Channel: #random");
      expect(view.events()).toEqual([
        ["join", "general"],
        ["leave", "general"],
        ["join", "random"],
      ]);
      await view.unmount();
      expect(view.emitted("leave")).toEqual([["general"], ["random"]]);
    },
  );

  it(
    "runs neither the callback nor the cleanup when the getter's value is unchanged",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(ChannelPicker, "initial");
      await view.user.click(view.getByRole("button", { name: "Join #General" }));
      await view.expectParity("same-channel");
      await expect.element(view.getByRole("status")).toHaveTextContent("Channel: #General");
      expect(view.emitted("join")).toEqual([["general"]]);
      expect(view.emitted("leave")).toEqual([]);
    },
  );
});
