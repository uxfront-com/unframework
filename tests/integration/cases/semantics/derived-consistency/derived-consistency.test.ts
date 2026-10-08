// semantics/derived-consistency: a computed read in client code right after a write of its
// dependency is consistent, through a chain (seats, total, summary), and again after a second
// write in the same handler (semantics contract, derived consistency).
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import SeatPicker from "./SeatPicker.uf.tsx";

describeTargets("semantics/derived-consistency", () => {
  it("renders the summary for one seat", async () => {
    const view = await mountScenario(SeatPicker, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("status")).toHaveTextContent("1 seat for 40");
  });

  it("emits the derived values right after a write", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(SeatPicker, "initial");
    await view.user.click(view.getByRole("button", { name: "Add a seat" }));
    await view.expectParity("two-seats");
    await expect.element(view.getByRole("status")).toHaveTextContent("2 seats for 80");
    expect(view.emitted("quote")).toEqual([[2, 80, "2 seats for 80"]]);
  });

  it("recomputes between two writes in one handler", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(SeatPicker, "initial");
    await view.user.click(view.getByRole("button", { name: "Add a group and a guide" }));
    await view.expectParity("group-added");
    await expect.element(view.getByRole("status")).toHaveTextContent("6 seats for 240");
    expect(view.emitted("quote")).toEqual([[6, 240, "6 seats for 240, 200 without the guide"]]);
  });
});
