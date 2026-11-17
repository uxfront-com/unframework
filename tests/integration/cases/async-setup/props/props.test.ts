// async-setup/props: the awaited call reads `prefix` and `id` once (ADR-0101). A rerender changes
// the template's own read of `id`, and the name the setup loaded stays.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Greeting from "./Greeting.uf.tsx";

describeTargets("async-setup/props", () => {
  it("passes the props to the awaited call", async () => {
    const view = await mountScenario(Greeting, "ada");
    await view.expectParity("ada");
    await expect.element(view.getByRole("heading")).toHaveTextContent("Hello, User dr-ada");
    await expect.element(view.getByText("Signed in as ada")).toBeVisible();
  });

  it("renders another scenario's data", async () => {
    const view = await mountScenario(Greeting, "grace");
    await view.expectParity("grace");
    await expect
      .element(view.getByRole("heading"))
      .toHaveTextContent("Hello, User rear-admiral-grace");
  });

  it("reads the props once in the setup", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(Greeting, "ada");
    await view.rerender({ id: "linus", prefix: "dr-" });
    await view.expectParity("rerendered");
    await expect.element(view.getByText("Signed in as linus")).toBeVisible();
    await expect.element(view.getByRole("heading")).toHaveTextContent("Hello, User dr-ada");
  });
});
