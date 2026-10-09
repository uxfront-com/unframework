// context/reactive: a parent provides a ref under an `InjectionKey<Ref<number>>` (ADR-0054). The
// child that injects it reads `count.value`, and renders each write of the parent's.
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import Counter from "./Counter.uf.tsx";

describeTargets("context/reactive", () => {
  it("injects the ref's value", async () => {
    const view = await mount(Counter);
    await view.expectParity("initial");
    await expect.element(view.getByRole("status")).toHaveTextContent("Count: 1");
  });

  it("renders each write of the ref", { requires: ["interactivity"] }, async () => {
    const view = await mount(Counter);
    await view.user.click(view.getByRole("button", { name: "Add one" }));
    await view.expectParity("added");
    await expect.element(view.getByRole("status")).toHaveTextContent("Count: 2");
  });
});
