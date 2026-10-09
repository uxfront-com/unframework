// models/text-field: `v-model` on a text input without a `type` and on an email input binds their
// value (ADR-0054): typing writes the state, and a write of the state shows in the field.
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import ContactForm from "./ContactForm.uf.tsx";

describeTargets("models/text-field", () => {
  it("shows the state in the fields", async () => {
    const view = await mount(ContactForm);
    await view.expectParity("initial");
    await expect.element(view.getByRole("textbox", { name: "Name" })).toHaveValue("Ada");
    await expect.element(view.getByRole("textbox", { name: "Email" })).toHaveValue("");
    await expect.element(view.getByRole("status")).toHaveTextContent("Ada at no address");
  });

  it("writes the state as the user types", { requires: ["interactivity"] }, async () => {
    const view = await mount(ContactForm);
    await view.user.fill(view.getByRole("textbox", { name: "Name" }), "Linus");
    await view.user.type(view.getByRole("textbox", { name: "Email" }), "linus@example.com");
    await view.expectParity("typed");
    await expect.element(view.getByRole("status")).toHaveTextContent("Linus at linus@example.com");
    await view.user.click(view.getByRole("button", { name: "Use Grace" }));
    await view.expectParity("written");
    await expect.element(view.getByRole("textbox", { name: "Name" })).toHaveValue("Grace");
    await expect.element(view.getByRole("status")).toHaveTextContent("Grace at linus@example.com");
  });
});
