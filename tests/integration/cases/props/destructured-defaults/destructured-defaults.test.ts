// props/destructured-defaults: string, number, boolean, array and object defaults, taken when a
// prop is left out or passed as undefined, and overridden when it is given.
import { describeTargets, mount, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import Notice from "./Notice.uf.tsx";

describeTargets("props/destructured-defaults", () => {
  it("renders every default when only the required prop is given", async () => {
    const view = await mountScenario(Notice, "defaults");
    await view.expectParity("defaults");
    await expect.element(view.getByRole("heading", { name: "Notice" })).toBeVisible();
    await expect
      .element(view.getByRole("region", { name: "Notice" }))
      .toHaveAttribute("data-tone", "info");
    await expect.element(view.getByText("Priority 1")).toBeVisible();
  });

  it("renders the given props instead of the defaults", async () => {
    const view = await mountScenario(Notice, "overridden");
    await view.expectParity("overridden");
    await expect.element(view.getByRole("heading", { name: "Maintenance" })).toBeVisible();
    await expect.element(view.getByText("Priority 3")).toBeVisible();
    await expect.element(view.getByText("Tagged ops, database, posted by Ada.")).toBeVisible();
  });

  // Browser-only: JSON cannot carry `undefined`, so this scenario has no SSR twin.
  it("takes the defaults for props passed explicitly as undefined", async () => {
    const view = await mount(Notice, {
      props: {
        message: "Backups run every night.",
        title: undefined,
        tone: undefined,
        priority: undefined,
        expanded: undefined,
        tags: undefined,
        author: undefined,
      },
    });
    await view.expectParity("explicit-undefined");
    await expect.element(view.getByRole("heading", { name: "Notice" })).toBeVisible();
    await expect
      .element(view.getByRole("region", { name: "Notice" }))
      .toHaveAttribute("data-tone", "info");
    await expect.element(view.getByText("Priority 1")).toBeVisible();
  });
});
