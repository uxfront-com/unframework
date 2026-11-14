// hydration/interactive: a count from a prop that the first click changes, and the event that
// click emits. In the hydrate projects the click lands on the server's HTML, once hydrated (L12).
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Stepper from "./Stepper.uf.tsx";

describeTargets("hydration/interactive", () => {
  it("renders the count it starts from", async () => {
    const view = await mountScenario(Stepper, "from-four");
    await view.expectParity("from-four");
    await expect.element(view.getByRole("status")).toHaveTextContent("4");
  });

  it(
    "counts the first click and emits the new count",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(Stepper, "from-four");
      await view.user.click(view.getByRole("button", { name: "Add one" }));
      await view.expectParity("after-click");
      await expect.element(view.getByRole("status")).toHaveTextContent("5");
      expect(view.emitted("change")).toEqual([[5]]);
    },
  );
});
