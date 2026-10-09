// models/textarea: `v-model` on a <textarea> binds its text (ADR-0054), both ways.
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import NoteEditor from "./NoteEditor.uf.tsx";

describeTargets("models/textarea", () => {
  it("shows the state in the field", async () => {
    const view = await mount(NoteEditor);
    await view.expectParity("initial");
    await expect.element(view.getByRole("textbox", { name: "Text" })).toHaveValue("Buy milk");
    await expect.element(view.getByRole("status")).toHaveTextContent("8 characters");
  });

  it("writes the state as the user types", { requires: ["interactivity"] }, async () => {
    const view = await mount(NoteEditor);
    await view.user.type(view.getByRole("textbox", { name: "Text" }), " and bread");
    await view.expectParity("typed");
    await expect.element(view.getByRole("status")).toHaveTextContent("18 characters");
    await view.user.click(view.getByRole("button", { name: "Discard" }));
    await view.expectParity("discarded");
    await expect.element(view.getByRole("textbox", { name: "Text" })).toHaveValue("");
    await expect.element(view.getByRole("status")).toHaveTextContent("0 characters");
  });
});
