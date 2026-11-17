// async-setup/rows: an async child with no element of its parent's around it, as a list's row
// and as a conditional's branch (ADR-0101). Vue puts each in a `<Suspense>` of its own, which
// takes the row's `v-for` and the branch's `v-if`.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Roster from "./Roster.uf.tsx";

describeTargets("async-setup/rows", () => {
  it("renders each row's and the shown branch's data", async () => {
    const view = await mountScenario(Roster, "two");
    await view.expectParity("two");
    await expect.element(view.getByText("User grace")).toBeVisible();
    await expect.element(view.getByText("User edsger")).toBeVisible();
    await expect.element(view.getByText("User ada")).toBeVisible();
  });

  it(
    "renders a branch the client shows once its setup resolves",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(Roster, "two");
      await view.user.click(view.getByRole("button", { name: "Switch lead" }));
      await view.user.click(view.getByRole("button", { name: "Toggle guest" }));
      await view.expectParity("switched");
      await expect.element(view.getByText("User linus")).toBeVisible();
      await expect.element(view.getByText("User hopper")).toBeVisible();
      await expect.poll(() => view.getByRole("listitem").all()).toHaveLength(4);
    },
  );
});
