// bindings/vendor-prefixes: vendor-prefixed longhands that Chromium computes (ADR-0065), bound
// in a style object, whose keys each target spells its own way, and static in a declaration
// list that clamps a paragraph to two lines.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import Excerpt from "./Excerpt.uf.tsx";

describeTargets("bindings/vendor-prefixes", () => {
  it("applies prefixed fill, stroke and line clamp", async () => {
    const view = await mountScenario(Excerpt, "clamped");
    await view.expectParity("clamped");
    await expect
      .element(view.getByRole("heading", { name: "Release notes" }))
      .toHaveStyle(
        "-webkit-text-fill-color: rgb(250, 250, 250); -webkit-text-stroke-color: rgb(40, 60, 120); -webkit-text-stroke-width: 1px",
      );
    await expect
      .element(view.getByText(/^This release adds/))
      .toHaveStyle("-webkit-line-clamp: 2; -webkit-box-orient: vertical");
  });
});
