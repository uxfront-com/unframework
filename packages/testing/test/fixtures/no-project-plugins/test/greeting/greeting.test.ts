import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Greeting from "./Greeting.uf.tsx";

describeTargets("greeting", () => {
  it("renders the class names the plugin's module gives", async () => {
    const view = await mountScenario(Greeting, "warm");
    await view.expectParity("warm");
    await expect
      .element(view.getByText("Hello"))
      .toHaveClass("uf-greeting uf-greeting--warm", { exact: true });
  });
});
