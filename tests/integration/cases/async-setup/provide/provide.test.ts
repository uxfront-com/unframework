// async-setup/provide: a `provide` after the await reaches the provider's own child and the
// child its parent fills in (ADR-0101). Svelte moves a provide of a constant above the awaits.
import { describeTargets, it, mount } from "@unframework.dev/testing";
import { expect } from "vitest";

import Page from "./Page.uf.tsx";

describeTargets("async-setup/provide", () => {
  it("provides to its children after the await", { requires: ["context"] }, async () => {
    const view = await mount(Page);
    await view.expectParity("provided");
    await expect.element(view.getByRole("region", { name: "User ada" })).toBeVisible();
    await expect.element(view.getByText("Tone: calm").first()).toBeVisible();
    await expect.poll(() => view.getByText("Tone: calm").all()).toHaveLength(2);
  });
});
