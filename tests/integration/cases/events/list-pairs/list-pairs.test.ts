// events/list-pairs: two listeners of one event on one element run in their order on every
// click, the `once` one on the first click alone, wherever the element is: in a list over a
// `computed` whose item is named `event`, in a list over a `ref` array with no type written, with
// an async `once` listener, and in a branch that narrows an optional prop. A `once` listener that
// declares a local named `event` keeps its own value, and a key handler whose block returns
// `false` prevents nothing (a handler's value is discarded).
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import MeetingList from "./MeetingList.uf.tsx";

describeTargets("events/list-pairs", () => {
  it("renders the upcoming meetings, the rooms and the organiser", async () => {
    const view = await mountScenario(MeetingList, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("button", { name: "Standup" })).toBeVisible();
    await expect.element(view.getByRole("button", { name: "Borealis" })).toBeVisible();
    await expect.element(view.getByRole("button", { name: "Thank Ada" })).toBeVisible();
  });

  it(
    "shows a meeting on every click, and reports only its first",
    { requires: ["interactivity", "event-once"] },
    async () => {
      const view = await mountScenario(MeetingList, "initial");
      await view.user.click(view.getByRole("button", { name: "Standup" }));
      await view.user.click(view.getByRole("button", { name: "Standup" }));
      await view.user.click(view.getByRole("button", { name: "Review" }));
      await view.expectParity("shown");
      const lines = view.getByRole("list", { name: "Log" }).getByRole("listitem");
      expect(lines.elements().map((line) => line.textContent)).toEqual([
        "show Standup",
        "show Standup",
        "show Review",
      ]);
      expect(view.emitted("opened")).toEqual([["Standup"], ["Review"]]);
    },
  );

  it(
    "picks a room on every click, and books it on the first",
    { requires: ["interactivity", "event-once"] },
    async () => {
      const view = await mountScenario(MeetingList, "initial");
      await view.user.click(view.getByRole("button", { name: "Atlas" }));
      await view.user.click(view.getByRole("button", { name: "Atlas" }));
      await view.user.click(view.getByRole("button", { name: "Borealis" }));
      await view.expectParity("picked");
      const lines = view.getByRole("list", { name: "Log" }).getByRole("listitem");
      expect(lines.elements().map((line) => line.textContent)).toEqual([
        "pick Atlas",
        "booked Atlas",
        "pick Atlas",
        "pick Borealis",
        "booked Borealis",
      ]);
    },
  );

  it(
    "thanks the organiser on every click, and reports the first",
    { requires: ["interactivity", "event-once"] },
    async () => {
      const view = await mountScenario(MeetingList, "initial");
      await view.user.click(view.getByRole("button", { name: "Thank Ada" }));
      await view.user.click(view.getByRole("button", { name: "Thank Ada" }));
      await view.expectParity("thanked");
      const lines = view.getByRole("list", { name: "Log" }).getByRole("listitem");
      expect(lines.elements().map((line) => line.textContent)).toEqual(["thank Ada", "thank Ada"]);
      expect(view.emitted("thanked")).toEqual([["Ada"]]);
    },
  );

  it(
    "counts every click, and tracks the first under the name its listener declares",
    { requires: ["interactivity", "event-once"] },
    async () => {
      const view = await mountScenario(MeetingList, "initial");
      await view.user.click(view.getByRole("button", { name: "Track" }));
      await view.user.click(view.getByRole("button", { name: "Track" }));
      await view.expectParity("tracked");
      await expect.element(view.getByText("Clicks: 2")).toBeVisible();
      expect(view.emitted("track")).toEqual([["first-click", 1]]);
    },
  );

  it(
    "lets every key type, though the key handler returns false",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(MeetingList, "initial");
      await view.user.type(view.getByRole("textbox", { name: "Filter" }), "ok");
      await view.expectParity("filter-typed");
      await expect.element(view.getByRole("textbox", { name: "Filter" })).toHaveValue("ok");
      await expect.element(view.getByText("Last key: k")).toBeVisible();
    },
  );
});
