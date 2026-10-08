// slots/named: a slot object fills the header, the default and the footer slots of a card
// (ADR-0054), each with JSX that reads the parent's props.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Post from "./Post.uf.tsx";

describeTargets("slots/named", () => {
  it("renders each fill in its slot", async () => {
    const view = await mountScenario(Post, "grace");
    await view.expectParity("grace");
    await expect.element(view.getByRole("heading", { name: "Release notes" })).toBeVisible();
    await expect.element(view.getByText("By Grace")).toBeVisible();
    await expect.element(view.getByText("Slots arrive in M3.")).toBeVisible();
  });
});
