// types/utility-types: props built with `Pick`, `Omit`, `Partial`, `Required` and `Readonly` from an
// imported interface (ADR-0067): the picked members are required, the rest optional.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import TextField from "./TextField.uf.tsx";

describeTargets("types/utility-types", () => {
  it("renders the required members", async () => {
    const view = await mountScenario(TextField, "required-only");
    await view.expectParity("required-only");
    await expect
      .element(view.getByRole("textbox", { name: "Email" }))
      .toHaveAttribute("name", "email");
  });

  it("renders the optional members it is given", async () => {
    const view = await mountScenario(TextField, "every-member");
    await view.expectParity("every-member");
    await expect
      .element(view.getByRole("textbox", { name: "Email" }))
      .toHaveAttribute("placeholder", "you@example.com");
    await expect.element(view.getByRole("textbox", { name: "Email" })).toBeRequired();
  });
});
