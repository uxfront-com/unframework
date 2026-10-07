// semantics/read-after-write: a read of a ref after a write in client code sees the new value: in
// the same function after `++` and `+=`, inside a loop after each write, after a write made by a
// function it called, and in another listener of the same event (semantics contract, read after
// write). React's output keeps this with mirror refs, never with the render's snapshot.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Tally from "./Tally.uf.tsx";

describeTargets("semantics/read-after-write", () => {
  it("renders the initial count", async () => {
    const view = await mountScenario(Tally, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("status")).toHaveTextContent("Count: 0");
  });

  it("reads its own writes after ++ and +=", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(Tally, "initial");
    await view.user.click(view.getByRole("button", { name: "Add two" }));
    await view.user.click(view.getByRole("button", { name: "Add five" }));
    await view.expectParity("after-writes");
    await expect.element(view.getByRole("status")).toHaveTextContent("Count: 7");
    expect(view.emitted("total")).toEqual([[2], [7]]);
  });

  it("reads the latest value inside a loop", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(Tally, "initial");
    await view.user.click(view.getByRole("button", { name: "Count up three" }));
    await view.expectParity("counted-up");
    await expect.element(view.getByRole("status")).toHaveTextContent("Count: 3");
    expect(view.emitted("steps")).toEqual([[[1, 2, 3]]]);
  });

  it("reads a write made by a function it called", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(Tally, "initial");
    await view.user.click(view.getByRole("button", { name: "Add ten" }));
    await view.expectParity("added-ten");
    await expect.element(view.getByRole("status")).toHaveTextContent("Count: 10");
    expect(view.emitted("total")).toEqual([[10]]);
  });

  it(
    "reads in the bubble listener what the capture listener wrote",
    { requires: ["interactivity", "event-capture"] },
    async () => {
      const view = await mountScenario(Tally, "initial");
      await view.user.click(view.getByRole("button", { name: "Log the phases" }));
      await view.user.click(view.getByRole("button", { name: "Log the phases" }));
      await view.expectParity("phases-logged");
      await expect
        .element(view.getByText("Phases: capture then bubble then capture then bubble"))
        .toBeVisible();
      expect(view.emitted("logged")).toEqual([
        [["capture", "bubble"]],
        [["capture", "bubble", "capture", "bubble"]],
      ]);
    },
  );
});
