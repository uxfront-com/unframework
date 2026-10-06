// bindings/spreads: a typed attributes prop spread onto an element beside written attributes
// (each declared key renders as a bound attribute, a boolean key as a boolean attribute), and an
// optional spread source, which renders nothing when it is absent.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import TextField from "./TextField.uf.tsx";

describeTargets("bindings/spreads", () => {
  it("renders every key of both spreads beside the written attributes", async () => {
    const view = await mountScenario(TextField, "with-hint");
    await view.expectParity("with-hint");
    const field = view.getByLabelText("Work email");
    await expect.element(field).toHaveAttribute("id", "work-email");
    await expect.element(field).toHaveAttribute("name", "email");
    await expect.element(field).toHaveAttribute("placeholder", "ada@example.com");
    await expect.element(field).toHaveAttribute("autocomplete", "email");
    await expect.element(field).toHaveAttribute("maxlength", "120");
    await expect.element(field).toBeRequired();
    await expect
      .element(view.getByText("We never share your address."))
      .toHaveAttribute("id", "work-email-hint");
  });

  it("renders only the given keys, and nothing for an absent spread", async () => {
    const view = await mountScenario(TextField, "without-hint");
    await view.expectParity("without-hint");
    const field = view.getByLabelText("Nickname");
    await expect.element(field).toHaveAttribute("name", "nickname");
    await expect.element(field).not.toHaveAttribute("placeholder");
    await expect.element(view.getByText("Shown on your profile.")).not.toHaveAttribute("id");
  });
});
