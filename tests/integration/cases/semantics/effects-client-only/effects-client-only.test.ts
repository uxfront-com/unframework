// semantics/effects-client-only: `onMounted` and a watcher run in the browser only. The server
// render (L6, ssr.initial.html) shows the initial state on every target; once mounted, the hook
// writes state and the watcher derives the label from it (semantics contract, effects are
// client-only). The mounted state depends on client code, so this case's first test needs
// `interactivity` (case.json's `requires` note): Astro is covered by L6.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import NetworkBadge from "./NetworkBadge.uf.tsx";

describeTargets("semantics/effects-client-only", () => {
  it("updates the badge once mounted in the browser", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(NetworkBadge, "initial");
    await view.expectParity("mounted");
    await expect.element(view.getByRole("status")).toHaveTextContent("Online");
    await expect.element(view.getByRole("status")).toHaveAttribute("data-checked", "yes");
  });
});
