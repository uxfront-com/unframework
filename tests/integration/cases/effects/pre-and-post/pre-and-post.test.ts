// effects/pre-and-post: a watcher runs before the render by default and after it with
// `flush: "post"`, and `await nextTick()` waits for every write before it to render. A post
// watcher measures the list a pre watcher's write rendered; `onMounted` reads the DOM its own
// write produced once it awaited `nextTick()`; a handler reads the DOM a watcher's write produced
// once it awaited `nextTick()`.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import SearchResults from "./SearchResults.uf.tsx";

describeTargets("effects/pre-and-post", () => {
  it(
    "waits in onMounted for the DOM to show its own write",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(SearchResults, "empty");
      await view.expectParity("ready");
      await expect.element(view.getByText("Ready")).toBeVisible();
      expect(view.emitted("ready")).toEqual([["Ready"]]);
    },
  );

  it(
    "measures in a post watcher the list a pre watcher's write rendered",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(SearchResults, "empty");
      await view.user.fill(view.getByRole("textbox", { name: "Query" }), "vue");
      await view.expectParity("searched");
      const results = view.getByRole("list", { name: "Results" }).getByRole("listitem");
      expect(results.elements().map((result) => result.textContent)).toEqual(["vue", "vue docs"]);
      expect(view.emitted("rendered")).toEqual([[2]]);
      await view.user.clear(view.getByRole("textbox", { name: "Query" }));
      await view.expectParity("cleared");
      await expect.element(view.getByRole("textbox", { name: "Query" })).toHaveValue("");
      expect(view.emitted("rendered")).toEqual([[2], [0]]);
    },
  );

  it(
    "waits in a handler for the DOM to show a watcher's write",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(SearchResults, "empty");
      await view.user.click(view.getByRole("button", { name: "Add one" }));
      await view.user.click(view.getByRole("button", { name: "Add one" }));
      await view.expectParity("added-twice");
      await expect.element(view.getByRole("status")).toHaveTextContent("4");
      expect(view.emitted("shown")).toEqual([["2"], ["4"]]);
    },
  );
});
