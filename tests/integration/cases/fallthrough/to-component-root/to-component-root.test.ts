// fallthrough/to-component-root: a toolbar passes `class` to a component whose root is another
// component, which passes it on to its own root element (ADR-0054), beside its own class.
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import Toolbar from "./Toolbar.uf.tsx";

describeTargets("fallthrough/to-component-root", () => {
  it("passes the class down to the root element", async () => {
    const view = await mount(Toolbar);
    await view.expectParity("initial");
    await expect
      .element(view.getByRole("button", { name: "Save" }))
      .toHaveClass("base", "primary", "wide");
  });
});
