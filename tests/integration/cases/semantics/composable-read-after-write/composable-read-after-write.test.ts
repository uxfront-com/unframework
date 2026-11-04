// semantics/composable-read-after-write: client code that calls a composable's function reads
// the composable's ref and derived value after it, and sees the write (semantics contract, read
// after write, across a composable's boundary, ADR-0069). React's caller reads them through the
// hook's live readers, never the render's values.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Cart from "./Cart.uf.tsx";

describeTargets("semantics/composable-read-after-write", () => {
  it("renders an empty cart", async () => {
    const view = await mountScenario(Cart, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("status")).toHaveTextContent("Items: 0");
  });

  it(
    "reads the composable's writes in the same function",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(Cart, "initial");
      await view.user.click(view.getByRole("button", { name: "Add three" }));
      await view.expectParity("added");
      await expect.element(view.getByRole("status")).toHaveTextContent("Items: 3");
      expect(view.emitted("total")).toEqual([[3]]);
      await view.user.click(view.getByRole("button", { name: "Clear" }));
      await view.expectParity("cleared");
      await expect.element(view.getByRole("status")).toHaveTextContent("Items: 0");
      expect(view.emitted("cleared")).toEqual([[true]]);
    },
  );
});
