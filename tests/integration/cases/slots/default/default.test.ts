// slots/default: a parent passes children, which fill the child's default slot (ADR-0054); the
// child renders them where it calls `slots.default?.()`.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Greeting from "./Greeting.uf.tsx";

describeTargets("slots/default", () => {
  it("renders the children in the panel", async () => {
    const view = await mountScenario(Greeting, "ada");
    await view.expectParity("ada");
    await expect.element(view.getByRole("region", { name: "Welcome" })).toBeVisible();
    await expect.element(view.getByText("Hello, Ada!")).toBeVisible();
    await expect.element(view.getByText("Your children render in the panel.")).toBeVisible();
  });
});
