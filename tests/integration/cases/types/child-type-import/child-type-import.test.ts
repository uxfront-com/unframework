// types/child-type-import: a parent types a prop with a type its child's module exports, imported
// from the child's output (ADR-0067).
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Form from "./Form.uf.tsx";

describeTargets("types/child-type-import", () => {
  it("passes the typed prop on to the child", async () => {
    const view = await mountScenario(Form, "email");
    await view.expectParity("email");
    await expect
      .element(view.getByRole("textbox", { name: "Email" }))
      .toHaveAttribute("name", "email");
  });
});
