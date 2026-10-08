// components/branch-content: each branch of a conditional renders the child with other props
// (ADR-0053). Marking everything read swaps the branch.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Inbox from "./Inbox.uf.tsx";

describeTargets("components/branch-content", () => {
  it("renders the branch with unread mail", async () => {
    const view = await mountScenario(Inbox, "five");
    await view.expectParity("five");
    await expect.element(view.getByRole("status")).toHaveTextContent("5 unread");
  });

  it("swaps the branch", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(Inbox, "five");
    await view.user.click(view.getByRole("button", { name: "Mark all read" }));
    await view.expectParity("all-read");
    await expect.element(view.getByRole("status")).toHaveTextContent("All read");
  });
});
