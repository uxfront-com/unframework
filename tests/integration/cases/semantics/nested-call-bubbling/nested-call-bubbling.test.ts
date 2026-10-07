// semantics/nested-call-bubbling: client code calls local functions synchronously, as Vue does.
// A container's bubble listener reads what the clicked button's listener wrote through a local
// function, on the very first click (semantics contract: read after write, in another listener of
// the same event); a call of an async local function that the source does not await lets the
// caller go on at the callee's first `await`, so the caller's write lands before the callee's
// continuation.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Picker from "./Picker.uf.tsx";

describeTargets("semantics/nested-call-bubbling", () => {
  it("renders the choices and the idle status", async () => {
    const view = await mountScenario(Picker, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("status")).toHaveTextContent("idle");
    await expect.element(view.getByRole("button", { name: "Alpha" })).toBeVisible();
  });

  it(
    "reads in the container's listener what the button's listener wrote through a function",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(Picker, "initial");
      await view.user.click(view.getByRole("button", { name: "Alpha" }));
      await view.expectParity("picked-alpha");
      const entries = view.getByRole("list", { name: "Log" }).getByRole("listitem");
      await expect.element(entries.nth(0)).toHaveTextContent("picked alpha #1");
      await view.user.click(view.getByRole("button", { name: "Beta" }));
      await view.expectParity("picked-beta");
      expect(entries.elements().map((entry) => entry.textContent)).toEqual([
        "picked alpha #1",
        "picked beta #2",
      ]);
    },
  );

  it(
    "goes on after an unawaited async call before the call's continuation",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(Picker, "initial");
      await view.user.click(view.getByRole("button", { name: "Start" }));
      await view.expectParity("started");
      await expect.element(view.getByRole("status")).toHaveTextContent("loaded 2");
      expect(view.emitted("done")).toEqual([[2, "loaded 2"]]);
    },
  );
});
