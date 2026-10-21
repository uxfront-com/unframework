// A case that opts into the dark colour scheme (`case.json`'s `colorScheme`, ADR-0061). The setup
// file emulates it before anything mounts, and its startup check asserts it in place of light,
// so a stylesheet's `prefers-color-scheme: dark` rules apply to what the case mounts.
import { expect, it } from "vitest";

import "../../../../../src/setup.ts";
import { describeTargets, mount } from "../../../../../src/index.ts";
import "../../../dom-target.ts";

describeTargets("stub/color-scheme", () => {
  it("runs under prefers-color-scheme: dark", async () => {
    const view = await mount({
      html: '<style>@media (prefers-color-scheme: dark) { .themed { color: rgb(255, 255, 255); } }</style><p class="themed">x</p>',
    });
    await expect.element(view.getByText("x")).toBeVisible();
    expect(matchMedia("(prefers-color-scheme: dark)").matches).toBe(true);
    expect(matchMedia("(prefers-color-scheme: light)").matches).toBe(false);
    expect(getComputedStyle(view.container.querySelector(".themed")!).color).toBe(
      "rgb(255, 255, 255)",
    );
  });
});
