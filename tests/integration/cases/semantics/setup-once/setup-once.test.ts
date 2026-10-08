// semantics/setup-once: the setup runs once per instance, so a const evaluates once. `greeting`
// reads a prop, which the compiler warns about (UF2007, in diagnostics.json): it keeps the value
// it had when the component was created, while the template's own read of the prop follows it.
// A static const (`tips`) renders as written.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import WelcomeBanner from "./WelcomeBanner.uf.tsx";

describeTargets("semantics/setup-once", () => {
  it("renders the const from the first props", async () => {
    const view = await mountScenario(WelcomeBanner, "ada");
    await view.expectParity("ada");
    await expect.element(view.getByRole("heading", { name: "Welcome, Ada" })).toBeVisible();
    await expect.element(view.getByText("Signed in as Ada")).toBeVisible();
    await expect.element(view.getByRole("listitem").nth(1)).toHaveTextContent("Invite your team");
  });

  // Browser-only: a rerender has no server twin. Astro renders every rerender as a new instance,
  // so a const that survives one needs `interactivity` (semantics contract, setup runs once).
  it(
    "keeps the const's first value after a rerender",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(WelcomeBanner, "ada");
      await view.rerender({ name: "Grace" });
      await view.expectParity("after-rerender");
      await expect.element(view.getByRole("heading", { name: "Welcome, Ada" })).toBeVisible();
      await expect.element(view.getByText("Signed in as Grace")).toBeVisible();
      await expect
        .element(view.getByRole("listitem").nth(0))
        .toHaveTextContent("Set up your profile");
    },
  );
});
