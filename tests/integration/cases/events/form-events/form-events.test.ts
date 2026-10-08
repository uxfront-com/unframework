// events/form-events: form events keep the DOM's semantics on every target: `input` fires on each
// key, `change` on a text field fires when the edit is committed (on blur), not per key as
// React's `onChange` would, `change` on a select and a checkbox fires on each pick, `focus` and
// `blur` follow the field, and `submit` is prevented, so the form never navigates. The select is
// found by its role and name: Playwright's label query finds no `<select>` inside its `<label>`.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import SignupForm from "./SignupForm.uf.tsx";

describeTargets("events/form-events", () => {
  it("renders the empty form", async () => {
    const view = await mountScenario(SignupForm, "initial");
    await view.expectParity("initial");
    await expect
      .element(view.getByRole("status"))
      .toHaveTextContent("Name: ; email: ; plan: free; newsletter: no; focus: none");
    await expect.element(view.getByRole("button", { name: "Sign up" })).toBeVisible();
  });

  it(
    "commits a text field's change on blur, not on each key",
    { requires: ["interactivity", "event-semantics"] },
    async () => {
      const view = await mountScenario(SignupForm, "initial");
      await view.user.type(view.getByLabelText("Name"), "Ada");
      await view.expectParity("name-typed");
      await expect
        .element(view.getByRole("status"))
        .toHaveTextContent("Name: ; email: ; plan: free; newsletter: no; focus: name");
      await view.user.tab();
      await view.expectParity("name-committed");
      await expect
        .element(view.getByRole("status"))
        .toHaveTextContent("Name: Ada; email: ; plan: free; newsletter: no; focus: email");
    },
  );

  it(
    "follows input, focus and blur on the email field",
    { requires: ["interactivity", "event-semantics"] },
    async () => {
      const view = await mountScenario(SignupForm, "initial");
      await view.user.type(view.getByLabelText("Email"), "ada@example.com");
      await view.expectParity("email-focused");
      await expect
        .element(view.getByRole("status"))
        .toHaveTextContent(
          "Name: ; email: ada@example.com; plan: free; newsletter: no; focus: email",
        );
      await view.user.tab();
      await view.expectParity("email-typed");
      await expect
        .element(view.getByRole("status"))
        .toHaveTextContent(
          "Name: ; email: ada@example.com; plan: free; newsletter: no; focus: none",
        );
      await expect.element(view.getByRole("combobox", { name: "Plan" })).toHaveFocus();
    },
  );

  it(
    "reads a select and a checkbox on change, and submits without navigating",
    { requires: ["interactivity", "event-semantics"] },
    async () => {
      const view = await mountScenario(SignupForm, "initial");
      await view.user.selectOptions(view.getByRole("combobox", { name: "Plan" }), "pro");
      await view.user.click(view.getByRole("checkbox", { name: "Send me the newsletter" }));
      await view.user.click(view.getByRole("button", { name: "Sign up" }));
      await view.expectParity("submitted");
      await expect
        .element(view.getByRole("status"))
        .toHaveTextContent("Name: ; email: ; plan: pro; newsletter: yes; focus: none");
      expect(view.emitted("signup")).toEqual([["", "", "pro", true]]);
    },
  );
});
