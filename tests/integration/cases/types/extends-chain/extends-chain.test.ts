// types/extends-chain: props whose interface extends another across two modules (ADR-0067): every
// member of the chain is a prop.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Button from "./Button.uf.tsx";

describeTargets("types/extends-chain", () => {
  it("renders every member of the chain", async () => {
    const view = await mountScenario(Button, "enabled");
    await view.expectParity("enabled");
    await expect.element(view.getByRole("button", { name: "Save" })).toHaveAttribute("id", "save");
    await expect.element(view.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("renders the inherited props with its own", async () => {
    const view = await mountScenario(Button, "disabled");
    await view.expectParity("disabled");
    await expect.element(view.getByRole("button", { name: "Delete" })).toBeDisabled();
  });
});
