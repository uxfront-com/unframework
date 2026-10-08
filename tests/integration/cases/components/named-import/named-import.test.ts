// components/named-import: a parent imports two components by name from one file, the second
// under a name of its own (ADR-0053): each output imports each child's own file.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Status from "./Status.uf.tsx";

describeTargets("components/named-import", () => {
  it("renders both children", async () => {
    const view = await mountScenario(Status, "passing");
    await view.expectParity("passing");
    await expect.element(view.getByText("Build")).toBeVisible();
    await expect.element(view.getByText("passing")).toBeVisible();
  });
});
