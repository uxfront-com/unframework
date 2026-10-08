// events/listener-order: listeners keep the DOM's order on every target. Two listeners of one
// event and phase on one element run in attribute order, a plain one and a `once` one in either
// order, and both before the container's bubble listener; a `once` listener whose body is a write
// runs once beside a plain one. An element that listens in both phases and stops the event in
// its bubble listener stops nothing else on the page. A container's `once` listener is not used up
// by a click a descendant stopped. A passive wheel listener runs before its container's
// non-passive one, as the event bubbles.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import ListenerOrder from "./ListenerOrder.uf.tsx";

describeTargets("events/listener-order", () => {
  it("renders the controls and an empty log", async () => {
    const view = await mountScenario(ListenerOrder, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("button", { name: "Save" })).toBeVisible();
    await expect.element(view.getByText("Resets: 0")).toBeVisible();
  });

  it(
    "runs a plain and a once listener of one element in attribute order, before the container's",
    { requires: ["interactivity", "event-once"] },
    async () => {
      const view = await mountScenario(ListenerOrder, "initial");
      await view.user.click(view.getByRole("button", { name: "Save" }));
      await view.user.click(view.getByRole("button", { name: "Save" }));
      await view.user.click(view.getByRole("button", { name: "Send" }));
      await view.user.click(view.getByRole("button", { name: "Send" }));
      await view.expectParity("pairs-clicked");
      const entries = view.getByRole("list", { name: "Log" }).getByRole("listitem");
      expect(entries.elements().map((entry) => entry.textContent)).toEqual([
        "save",
        "first save",
        "toolbar",
        "save",
        "toolbar",
        "first send",
        "send",
        "toolbar",
        "send",
        "toolbar",
      ]);
      await expect.element(entries.nth(1)).toHaveTextContent("first save");
    },
  );

  it(
    "writes once from a once listener whose body is a write, beside a plain listener",
    { requires: ["interactivity", "event-once"] },
    async () => {
      const view = await mountScenario(ListenerOrder, "initial");
      await view.user.click(view.getByRole("button", { name: "Reset" }));
      await view.user.click(view.getByRole("button", { name: "Reset" }));
      await view.expectParity("reset-twice");
      await expect.element(view.getByText("Resets: 1")).toBeVisible();
      const entries = view.getByRole("list", { name: "Log" }).getByRole("listitem");
      expect(entries.elements().map((entry) => entry.textContent)).toEqual([
        "reset",
        "toolbar",
        "reset",
        "toolbar",
      ]);
    },
  );

  it(
    "stops a click in an element's bubble listener and lets clicks elsewhere through",
    { requires: ["interactivity", "event-capture"] },
    async () => {
      const view = await mountScenario(ListenerOrder, "initial");
      await view.user.click(view.getByRole("button", { name: "Outside" }));
      await view.user.click(view.getByRole("button", { name: "Inside" }));
      await view.user.click(view.getByRole("button", { name: "Outside" }));
      await view.expectParity("capture-and-bubble");
      const entries = view.getByRole("list", { name: "Log" }).getByRole("listitem");
      expect(entries.elements().map((entry) => entry.textContent)).toEqual([
        "outside",
        "panel capture",
        "inside",
        "panel bubble",
        "outside",
      ]);
      await expect.element(entries.nth(4)).toHaveTextContent("outside");
    },
  );

  it(
    "keeps a container's once listener while a descendant stops the click",
    { requires: ["interactivity", "event-once"] },
    async () => {
      const view = await mountScenario(ListenerOrder, "initial");
      await view.user.click(view.getByRole("button", { name: "Stop" }));
      await view.user.click(view.getByRole("button", { name: "Pass" }));
      await view.user.click(view.getByRole("button", { name: "Pass" }));
      await view.expectParity("claimed-after-stop");
      const entries = view.getByRole("list", { name: "Log" }).getByRole("listitem");
      expect(entries.elements().map((entry) => entry.textContent)).toEqual([
        "stopped",
        "pass",
        "claim once",
        "pass",
      ]);
      await expect.element(entries.nth(2)).toHaveTextContent("claim once");
    },
  );

  it(
    "runs a passive wheel listener before its container's non-passive one",
    { requires: ["interactivity", "event-passive"] },
    async () => {
      const view = await mountScenario(ListenerOrder, "initial");
      await view.user.wheel(view.getByRole("group", { name: "Inner zone" }), {
        direction: "down",
      });
      await view.expectParity("wheeled");
      const entries = view.getByRole("list", { name: "Log" }).getByRole("listitem");
      expect(entries.elements().map((entry) => entry.textContent)).toEqual([
        "inner wheel",
        "outer wheel",
      ]);
      await expect.element(entries.nth(0)).toHaveTextContent("inner wheel");
    },
  );
});
