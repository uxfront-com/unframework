// generics/list: `function List<T>(props: ListProps<T>)`, written in each target's generic form
// (ADR-0068). Each test mounts it with its own type argument, which the scenario's props hold.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import List from "./List.uf.tsx";

describeTargets("generics/list", () => {
  it("renders items of any type", async () => {
    const view = await mountScenario(List<number>, "numbers");
    await view.expectParity("numbers");
    await expect.element(view.getByRole("listitem").nth(1)).toHaveTextContent("2");
    await expect.element(view.getByRole("listitem").nth(1)).toHaveAttribute("aria-current", "true");
  });

  it("renders items of another type", async () => {
    const view = await mountScenario(List<string>, "words");
    await view.expectParity("words");
    await expect.element(view.getByRole("list", { name: "Words" })).toHaveTextContent("ab");
  });
});
