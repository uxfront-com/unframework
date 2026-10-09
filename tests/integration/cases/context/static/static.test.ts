// context/static: a parent provides a static object under an `InjectionKey` its module declares
// and exports (ADR-0054), and a child imports the key and injects the object.
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import ThemeProvider from "./ThemeProvider.uf.tsx";

describeTargets("context/static", () => {
  it("injects what the parent provides", async () => {
    const view = await mount(ThemeProvider);
    await view.expectParity("initial");
    await expect.element(view.getByText("New in Teal")).toHaveClass("badge teal");
  });
});
