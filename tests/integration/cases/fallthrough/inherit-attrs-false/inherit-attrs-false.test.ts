// fallthrough/inherit-attrs-false: a field turns fallthrough off (ADR-0054's `defineOptions`), so
// its parent passes it its props alone; a `class` on it would be UF3045.
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import Form from "./Form.uf.tsx";

describeTargets("fallthrough/inherit-attrs-false", () => {
  it("renders the fields", async () => {
    const view = await mount(Form);
    await view.expectParity("initial");
    await expect.element(view.getByRole("textbox", { name: "Email" })).toBeVisible();
    await expect.element(view.getByRole("textbox", { name: "Name" })).toBeVisible();
  });
});
