// types/package-types: props whose members a package's generic type declares, beside one a `.ts`
// module declares (ADR-0067). Vue prints the props' keys, each read off the annotation, since
// compiler-sfc cannot resolve a package without TypeScript's classic API.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Status from "./Status.uf.tsx";

describeTargets("types/package-types", () => {
  it("renders the package's members with the module's", async () => {
    const view = await mountScenario(Status, "tick");
    await view.expectParity("tick");
    await expect.element(view.getByText("Feed: tick after 250 ms")).toBeVisible();
  });

  it("renders other values of the same members", async () => {
    const view = await mountScenario(Status, "tock");
    await view.expectParity("tock");
    await expect.element(view.getByText("Clock: tock after 1000 ms")).toBeVisible();
  });
});
