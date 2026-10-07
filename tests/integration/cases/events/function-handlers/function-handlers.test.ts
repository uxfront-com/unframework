// events/function-handlers: handlers named by a setup function, `onClick={save}`, one of them on
// two buttons, and `onKeydown={recordKey}` on two fields, whose annotated parameter receives the
// keyboard event. `addTag(event: MouseEvent | KeyboardEvent)` is a button's click listener and is
// called with the keyboard event by the tag field's Enter handler: a union of the events it takes.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import NoteEditor from "./NoteEditor.uf.tsx";

describeTargets("events/function-handlers", () => {
  it("renders the editor", async () => {
    const view = await mountScenario(NoteEditor, "initial");
    await view.expectParity("initial");
    await expect
      .element(view.getByRole("status"))
      .toHaveTextContent("Saved 0 times, last key none");
    await expect.element(view.getByLabelText("Title")).toBeVisible();
  });

  it("runs one function from two buttons", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(NoteEditor, "initial");
    await view.user.click(view.getByRole("button", { name: "Save", exact: true }));
    await view.user.click(view.getByRole("button", { name: "Save and close" }));
    await view.expectParity("saved-twice");
    await expect
      .element(view.getByRole("status"))
      .toHaveTextContent("Saved 2 times, last key none");
    expect(view.emitted("saved")).toEqual([[1], [2]]);
  });

  it(
    "passes the keyboard event to one function on two fields",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(NoteEditor, "initial");
      await view.user.type(view.getByLabelText("Title"), "a");
      await view.user.type(view.getByLabelText("Body"), "b");
      await view.user.keyboard("{Escape}");
      await view.expectParity("keys-recorded");
      await expect
        .element(view.getByRole("status"))
        .toHaveTextContent("Saved 0 times, last key Escape");
      await expect.element(view.getByLabelText("Title")).toHaveValue("a");
      await expect.element(view.getByLabelText("Body")).toHaveValue("b");
    },
  );

  it(
    "adds a tag on Enter and on a click through one function",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(NoteEditor, "initial");
      await view.user.type(view.getByLabelText("Tag"), "home{Enter}");
      await view.expectParity("tagged-by-key");
      await expect.element(view.getByText("Tags: home")).toBeVisible();
      await expect.element(view.getByLabelText("Tag")).toHaveValue("");
      expect(view.emitted("tagged")).toEqual([["home", "keydown"]]);
      await view.user.type(view.getByLabelText("Tag"), "work");
      await view.user.click(view.getByRole("button", { name: "Add tag" }));
      await view.expectParity("tagged-by-click");
      await expect.element(view.getByText("Tags: home, work")).toBeVisible();
      expect(view.emitted("tagged")).toEqual([
        ["home", "keydown"],
        ["work", "click"],
      ]);
    },
  );
});
