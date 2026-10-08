// events/control-only-listeners: a listener whose only statement is `event.preventDefault()`
// still prevents, on every target. The form's `submit` listener does nothing else, so the Save
// button's click saves and the page stays, and Enter in the title field submits the form the same
// way (its implicit click on Save saves too). The Bold button's `mousedown` listener does nothing
// else, so a click toggles bold while the text keeps the focus.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import NoteEditor from "./NoteEditor.uf.tsx";

describeTargets("events/control-only-listeners", () => {
  it("renders the empty note", async () => {
    const view = await mountScenario(NoteEditor, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("status")).toHaveTextContent("Saves: 0");
    await expect
      .element(view.getByRole("button", { name: "Bold" }))
      .toHaveAttribute("aria-pressed", "false");
  });

  it("toggles bold while the text keeps the focus", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(NoteEditor, "initial");
    await view.user.type(view.getByRole("textbox", { name: "Text" }), "Hi");
    await view.user.click(view.getByRole("button", { name: "Bold" }));
    await view.expectParity("bold");
    await expect
      .element(view.getByRole("button", { name: "Bold" }))
      .toHaveAttribute("aria-pressed", "true");
    await expect.element(view.getByRole("textbox", { name: "Text" })).toHaveFocus();
  });

  it(
    "saves on Save and on Enter, without leaving the page",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(NoteEditor, "initial");
      await view.user.type(view.getByRole("textbox", { name: "Title" }), "Plan");
      await view.user.click(view.getByRole("button", { name: "Save" }));
      await view.expectParity("saved");
      await expect.element(view.getByRole("status")).toHaveTextContent("Saves: 1");
      expect(view.emitted("saved")).toEqual([["Plan", false]]);
      await view.user.type(view.getByRole("textbox", { name: "Title" }), "s{Enter}");
      await view.expectParity("saved-on-enter");
      await expect.element(view.getByRole("status")).toHaveTextContent("Saves: 2");
      expect(view.emitted("saved")).toEqual([
        ["Plan", false],
        ["Plans", false],
      ]);
    },
  );
});
