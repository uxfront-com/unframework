// state/identity-and-clone: state holds the very value written to it. A state given a prop
// list's item is that item, so comparing them by identity marks the picked row; and the value is
// plain data, so `structuredClone` copies it (Vue declares such state with `shallowRef`, as
// Svelte with `$state.raw`: state is replaced whole, never changed in place).
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import FruitPicker from "./FruitPicker.uf.tsx";

describeTargets("state/identity-and-clone", () => {
  it("renders the fruits, none picked", async () => {
    const view = await mountScenario(FruitPicker, "two-fruits");
    await view.expectParity("two-fruits");
    await expect
      .element(view.getByRole("button", { name: "Pear" }))
      .toHaveAttribute("aria-pressed", "false");
    await expect.element(view.getByRole("button", { name: "Keep a copy" })).toBeVisible();
  });

  it(
    "marks the picked fruit by identity with the prop's item",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(FruitPicker, "two-fruits");
      await view.user.click(view.getByRole("button", { name: "Pear" }));
      await view.expectParity("picked-pear");
      await expect
        .element(view.getByRole("button", { name: "Pear" }))
        .toHaveAttribute("aria-pressed", "true");
      await expect
        .element(view.getByRole("button", { name: "Apple" }))
        .toHaveAttribute("aria-pressed", "false");
    },
  );

  it("keeps a clone of the picked fruit", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(FruitPicker, "two-fruits");
    await view.user.click(view.getByRole("button", { name: "Pear" }));
    await view.user.click(view.getByRole("button", { name: "Keep a copy" }));
    await view.expectParity("kept-pear");
    const basket = view.getByRole("list", { name: "Basket" }).getByRole("listitem");
    await expect.element(basket.nth(0)).toHaveTextContent("Pear (green)");
    expect(view.emitted("kept")).toEqual([["Pear", "green"]]);
  });
});
