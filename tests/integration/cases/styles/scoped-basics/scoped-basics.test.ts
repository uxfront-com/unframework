// styles/scoped-basics: a component imports its sheet, which the compiler scopes once
// (ADR-0063): every rule matches the component's elements through `data-uf-<id>`, and every
// target attaches the same scoped sheet.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Badge from "./Badge.uf.tsx";

describeTargets("styles/scoped-basics", () => {
  it("styles the badge, its label and its count", async () => {
    const view = await mountScenario(Badge, "inbox");
    await view.expectParity("inbox");
    await expect.element(view.getByText("Inbox")).toBeVisible();
    await expect.element(view.getByText("3")).toBeVisible();
  });
});
