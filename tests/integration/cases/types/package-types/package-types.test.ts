// types/package-types: props that pick a member from a package's type (ADR-0067). Vue prints the
// members, since compiler-sfc cannot resolve a package without TypeScript's classic API.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Status from "./Status.uf.tsx";

describeTargets("types/package-types", () => {
  it("renders an open subscription", async () => {
    const view = await mountScenario(Status, "open");
    await view.expectParity("open");
    await expect.element(view.getByText("Feed: open")).toBeVisible();
  });

  it("renders a closed subscription", async () => {
    const view = await mountScenario(Status, "closed");
    await view.expectParity("closed");
    await expect.element(view.getByText("Feed: closed")).toBeVisible();
  });
});
