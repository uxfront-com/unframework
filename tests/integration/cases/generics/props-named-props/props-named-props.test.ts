// generics/props-named-props: `function Options<T>(props: Props<T>)`, a generic props interface
// named `Props` (ADR-0068). Each test mounts it with its own type argument, which the scenario's
// props hold.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Options from "./Options.uf.tsx";

describeTargets("generics/props-named-props", () => {
  it("renders options of any type", async () => {
    const view = await mountScenario(Options<number>, "numbers");
    await view.expectParity("numbers");
    await expect.element(view.getByRole("heading", { name: "Numbers" })).toBeVisible();
    await expect.element(view.getByRole("listitem").nth(1)).toHaveTextContent("2");
    await expect.element(view.getByRole("listitem").nth(1)).toHaveAttribute("aria-current", "true");
  });

  it("renders options of another type", async () => {
    const view = await mountScenario(Options<string>, "words");
    await view.expectParity("words");
    await expect.element(view.getByRole("list", { name: "Words" })).toHaveTextContent("ab");
  });
});
