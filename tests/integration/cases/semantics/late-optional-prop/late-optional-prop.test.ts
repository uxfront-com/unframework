// semantics/late-optional-prop: an optional prop the parent did not pass at mount, then passes in
// a rerender, reaches a computed and a watcher that read it, as it reaches the template; removed
// again, it takes its default (reactive props).
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import PageCount from "./PageCount.uf.tsx";

describeTargets("semantics/late-optional-prop", () => {
  it("renders the default page", async () => {
    const view = await mountScenario(PageCount, "first-page");
    await view.expectParity("first-page");
    await expect.element(view.getByRole("status")).toHaveTextContent("Page 1 of 5");
    await expect.element(view.getByText("Direct: 1")).toBeVisible();
  });

  // Browser-only: a rerender has no server twin. Qwik declares `late-prop` unsupported: its
  // computed and task never subscribe to a prop key absent at mount.
  it(
    "follows the optional prop a rerender adds, in a computed and a watcher",
    { requires: ["interactivity", "late-prop"] },
    async () => {
      const view = await mountScenario(PageCount, "first-page");
      await view.rerender({ page: 3, total: 5 });
      await view.expectParity("page-added");
      await expect.element(view.getByRole("status")).toHaveTextContent("Page 3 of 5");
      await expect.element(view.getByText("Direct: 3")).toBeVisible();
      expect(view.emitted("pageChange")).toEqual([[3, 1]]);
      await view.rerender({ total: 5 });
      await view.expectParity("page-removed");
      await expect.element(view.getByRole("status")).toHaveTextContent("Page 1 of 5");
      expect(view.emitted("pageChange")).toEqual([
        [3, 1],
        [1, 3],
      ]);
    },
  );
});
