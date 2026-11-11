import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import TextField from "../../src/TextField.uf.tsx";

describeTargets("text-field", () => {
  it("labels its input", async () => {
    const view = await mountScenario(TextField, "empty");
    await view.expectParity("empty");
    await expect.element(view.getByRole("textbox", { name: "Name" })).toHaveValue("");
  });
});
