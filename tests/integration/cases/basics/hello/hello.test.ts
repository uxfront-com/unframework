// basics/hello: one element, one static attribute, one text node, on every target.
import { describeTargets, mount } from "@unframework/testing";
import { expect, it } from "vitest";

import Hello from "./Hello.uf.tsx";

describeTargets("basics/hello", () => {
  it("renders the greeting", async () => {
    const view = await mount(Hello);
    // The shared layers first, so they are recorded even when the behaviour below differs.
    await view.expectParity("initial");
    await expect.element(view.getByText("Hello, world!")).toBeVisible();
  });
});
