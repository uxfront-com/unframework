// effects/watch-immediate: an immediate watcher over a getter of a prop runs once with the setup,
// with no previous value, then on each change. Its callback only emits, so it is server-safe
// (UF2013): Vue runs it during the server's setup too, and the server render is unchanged.
// `onMounted` emits once the component is in the document. The two events come from different
// effects, so the spec checks each apart (semantics contract, watch semantics).
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import SectionHeading from "./SectionHeading.uf.tsx";

describeTargets("effects/watch-immediate", () => {
  it("renders the heading", async () => {
    const view = await mountScenario(SectionHeading, "intro");
    await view.expectParity("intro");
    await expect.element(view.getByRole("heading", { name: "Introduction" })).toBeVisible();
  });

  // Browser-only: a rerender has no server twin.
  it(
    "emits at setup and on mount, then on each change",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(SectionHeading, "intro");
      await view.rerender({ title: "Setup" });
      await view.expectParity("after-rerender");
      await expect.element(view.getByRole("heading", { name: "Setup" })).toBeVisible();
      expect(view.emitted("change")).toEqual([["Introduction"], ["Setup", "Introduction"]]);
      expect(view.emitted("ready")).toEqual([[]]);
    },
  );
});
