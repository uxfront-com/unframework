import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import ReleaseCard from "./ReleaseCard.uf.tsx";

describeTargets("card", () => {
  it("renders each slot in its region", async () => {
    const view = await mountScenario(ReleaseCard, "filled");
    await view.expectParity("filled");
    await expect.element(view.getByRole("article")).toHaveAriaTree(`
      - article:
        - heading "Release notes" [level=2]
        - paragraph: Tests run on every target.
        - text: By Ada
    `);
  });
});
