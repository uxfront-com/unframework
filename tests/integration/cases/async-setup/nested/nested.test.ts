// async-setup/nested: async children of a sync parent (ADR-0101). The parent's ref reaches the
// first child's exposed function once its setup resolves, and the class the parent passes to
// `Lead` falls through to the async child that is `Lead`'s root.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Team from "./Team.uf.tsx";

describeTargets("async-setup/nested", () => {
  it("renders every async child's data", async () => {
    const view = await mountScenario(Team, "two");
    await view.expectParity("two");
    await expect.element(view.getByRole("heading", { name: "User ada" })).toBeVisible();
    await expect.element(view.getByRole("heading", { name: "User grace" })).toBeVisible();
    await expect.element(view.getByRole("heading", { name: "User linus" })).toBeVisible();
    await expect.element(view.getByRole("heading", { name: "User hopper" })).toBeVisible();
  });

  it(
    "counts in a child, and resets it through the parent's ref",
    { requires: ["interactivity", "expose"] },
    async () => {
      const view = await mountScenario(Team, "two");
      await view.user.click(view.getByRole("button", { name: "User ada visits: 3" }));
      await view.expectParity("after-count");
      await view.user.click(view.getByRole("button", { name: "Reset" }));
      await view.expectParity("after-reset");
      await expect
        .element(view.getByRole("button", { name: "User ada visits: 0" }))
        .toBeVisible();
      await expect
        .element(view.getByRole("button", { name: "User grace visits: 5" }))
        .toBeVisible();
    },
  );
});
