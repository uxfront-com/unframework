// styleframe/utilities: utility classes written in a `class` (ADR-0064). Styleframe's scanner reads
// the case's source, so the arbitrary value `_border-radius:[4px]`, which no configuration lists,
// is in Styleframe's stylesheet too.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Tag from "./Tag.uf.tsx";

describeTargets("styleframe/utilities", () => {
  it("renders the utility classes", async () => {
    const view = await mountScenario(Tag, "default");
    await view.expectParity("default");
    await expect.element(view.getByText("Utility")).toBeVisible();
  });
});
