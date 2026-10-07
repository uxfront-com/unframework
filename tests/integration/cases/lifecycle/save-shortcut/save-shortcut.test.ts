// lifecycle/save-shortcut: a key listener the component adds to the document prevents Ctrl+S as
// the event is dispatched, and saves, in a field too. `onMounted` adds it and `onUnmounted`
// removes the same function, so once the component is removed the shortcut no longer saves it,
// though it rendered again in between. A control in a function handed to `addEventListener` is
// Qwik's `conditional-event-control` (its handler runs after the dispatch): Qwik has no output.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import DraftEditor from "./DraftEditor.uf.tsx";

describeTargets("lifecycle/save-shortcut", () => {
  it("renders the empty draft", async () => {
    const view = await mountScenario(DraftEditor, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("textbox", { name: "Draft" })).toBeVisible();
    await expect.element(view.getByRole("status")).toHaveTextContent("Saved: 0");
  });

  it(
    "saves on Ctrl+S, in a field too",
    { requires: ["interactivity", "conditional-event-control"] },
    async () => {
      const view = await mountScenario(DraftEditor, "initial");
      await view.user.type(view.getByRole("textbox", { name: "Draft" }), "Hi");
      await view.user.keyboard("{Control>}s{/Control}");
      await view.expectParity("saved");
      await expect.element(view.getByRole("status")).toHaveTextContent("Saved: 1");
      await expect.element(view.getByRole("textbox", { name: "Draft" })).toHaveValue("Hi");
      expect(view.emitted("saved")).toEqual([[1]]);
    },
  );

  it(
    "removes the listener when the component unmounts",
    { requires: ["interactivity", "conditional-event-control"] },
    async () => {
      // The first view renders again before it unmounts, so the function removed is the one
      // added once mounted only if a local function keeps one identity across renders.
      const first = await mountScenario(DraftEditor, "initial");
      await first.user.keyboard("{Control>}s{/Control}");
      await first.expectParity("first-saved");
      await expect.element(first.getByRole("status")).toHaveTextContent("Saved: 1");
      await first.unmount();
      const second = await mountScenario(DraftEditor, "initial");
      await second.user.keyboard("{Control>}s{/Control}");
      await second.expectParity("second-saved");
      await expect.element(second.getByRole("status")).toHaveTextContent("Saved: 1");
      expect(second.emitted("saved")).toEqual([[1]]);
      expect(first.emitted("saved")).toEqual([[1]]);
    },
  );
});
