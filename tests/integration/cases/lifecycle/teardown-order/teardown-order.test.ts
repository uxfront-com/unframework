// lifecycle/teardown-order: cleanups run when their watcher calls back again and when the
// component is removed, never at another time. A post watcher's cleanup waits for its next
// callback, not for a change of the state a pre watcher writes; a `watchEffect` that reads that
// state runs once after the pre watcher's write renders. When the component is removed, every
// watcher's and `watchEffect`'s cleanup runs before `onUnmounted`, though the hook is declared
// first. The order of the cleanups among themselves is not part of the contract (it is the order
// of different watchers), so each has an event of its own and the spec checks them as a set.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import SearchSession from "./SearchSession.uf.tsx";

describeTargets("lifecycle/teardown-order", () => {
  it("renders the empty search", async () => {
    const view = await mountScenario(SearchSession, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("textbox", { name: "Query" })).toBeVisible();
    await expect.element(view.getByRole("button", { name: "Clear results" })).toBeVisible();
  });

  it(
    "runs a post watcher's cleanup only before its next callback",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(SearchSession, "initial");
      await view.user.fill(view.getByRole("textbox", { name: "Query" }), "vue");
      await view.expectParity("searched");
      const results = view.getByRole("list", { name: "Results" }).getByRole("listitem");
      expect(results.elements().map((result) => result.textContent)).toEqual(["vue", "vue docs"]);
      expect(view.emitted("searched")).toEqual([["vue", 2]]);
      await view.user.click(view.getByRole("button", { name: "Clear results" }));
      await view.expectParity("results-cleared");
      await expect.element(view.getByRole("textbox", { name: "Query" })).toHaveValue("vue");
      expect(view.getByRole("listitem").elements()).toEqual([]);
      expect(view.emitted("searchCleaned")).toEqual([]);
      await view.user.fill(view.getByRole("textbox", { name: "Query" }), "vite");
      await view.expectParity("searched-again");
      await expect.element(view.getByRole("textbox", { name: "Query" })).toHaveValue("vite");
      expect(view.emitted("searchCleaned")).toEqual([["vue"]]);
      expect(view.emitted("searched")).toEqual([
        ["vue", 2],
        ["vite", 2],
      ]);
    },
  );

  it(
    "runs a watchEffect once after a pre watcher's write renders",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(SearchSession, "initial");
      await view.user.fill(view.getByRole("textbox", { name: "Query" }), "vue");
      await view.user.click(view.getByRole("button", { name: "Clear results" }));
      await view.user.fill(view.getByRole("textbox", { name: "Query" }), "vite");
      await view.expectParity("summarised");
      await expect.element(view.getByRole("textbox", { name: "Query" })).toHaveValue("vite");
      expect(view.emitted("summary")).toEqual([
        ['0 results for ""'],
        ['2 results for "vue"'],
        ['0 results for "vue"'],
        ['2 results for "vite"'],
      ]);
    },
  );

  it(
    "runs every cleanup before onUnmounted when the component is removed",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(SearchSession, "initial");
      await view.user.fill(view.getByRole("textbox", { name: "Query" }), "vue");
      await view.expectParity("before-removal");
      await expect.element(view.getByRole("textbox", { name: "Query" })).toHaveValue("vue");
      const before = view.events().length;
      await view.unmount();
      const removal = view.events().slice(before);
      expect(removal.at(-1)).toEqual(["unmounted"]);
      expect(
        removal
          .slice(0, -1)
          .map((event) => event.join(" "))
          .toSorted(),
      ).toEqual(["effectCleaned vue", "searchCleaned vue", "watchCleaned vue"]);
    },
  );
});
