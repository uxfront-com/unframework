// bindings/style-expression: a `style` bound to a value (ADR-0065), an object prop with
// camel-case and custom properties, a declaration list prop, either of them absent, and a
// conditional between two objects whose properties differ, which a click switches. A child's
// root merges the object passed to it over its own declaration list, on every target's merge,
// and a `<component is>` passes a declaration list to whichever child it renders, whose root
// merges it over a list or declarations of its own.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Notice from "./Notice.uf.tsx";

describeTargets("bindings/style-expression", () => {
  it("renders a style object and a declaration list", async () => {
    const view = await mountScenario(Notice, "styled");
    await view.expectParity("styled");
    await expect
      .element(view.getByText("Delete the project"))
      .toHaveStyle(
        "color: rgb(20, 40, 90); background-color: rgb(230, 238, 250); border-left-style: solid; border-left-width: 4px",
      );
    await expect
      .element(view.getByText("Read the details before you continue."))
      .toHaveStyle("color: rgb(60, 60, 60); font-style: italic; margin-top: 12px");
    await expect
      .element(view.getByText("Optional"))
      .toHaveStyle("color: rgb(60, 60, 60); font-style: italic; font-weight: 700");
    // The consumer's declarations win over the root's own.
    await expect
      .element(view.getByText("Permanent"))
      .toHaveStyle(
        "color: rgb(20, 40, 90); background-color: rgb(230, 238, 250); padding-left: 6px; outline-style: solid",
      );
    await expect
      .element(view.getByText("This cannot be undone."))
      .toHaveStyle("color: rgb(160, 40, 40); font-weight: 700");
  });

  it("renders no style where the values are absent", async () => {
    const view = await mountScenario(Notice, "plain");
    await view.expectParity("plain");
    await expect
      .element(view.getByText("Permanent"))
      .toHaveStyle("color: rgb(120, 30, 30); padding-left: 6px; outline-style: solid");
    await expect
      .element(view.getByText("Archive the project"))
      .toHaveStyle("color: rgb(0, 0, 0); background-color: rgba(0, 0, 0, 0)");
    await expect
      .element(view.getByText("This cannot be undone."))
      .toHaveStyle("color: rgb(160, 40, 40); font-weight: 700");
  });

  it(
    "switches to an object without the other's properties",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(Notice, "styled");
      await view.user.click(view.getByRole("button", { name: "Quieten" }));
      await view.expectParity("quiet");
      await expect
        .element(view.getByText("Optional"))
        .toHaveStyle("color: rgb(60, 60, 60); font-style: italic; padding-left: 4px");
      await expect
        .element(view.getByText("This cannot be undone."))
        .toHaveStyle("color: rgb(90, 90, 90); font-weight: 400");
      await view.user.click(view.getByRole("button", { name: "Emphasise" }));
      await view.expectParity("emphasised");
      await expect
        .element(view.getByText("This cannot be undone."))
        .toHaveStyle("color: rgb(160, 40, 40); font-weight: 700");
    },
  );
});
