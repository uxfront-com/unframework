// L13 after the last test, under a quarantine entry (project.ts): recorded on the file as
// quarantined, and the file passes. Run by test/late-console.test.ts only.
import { expect, it } from "vitest";

import "../../../../../src/setup.ts";
import { host } from "../../../../../src/browser/host.ts";
import { describeTargets, mount } from "../../../../../src/index.ts";
import "../../../dom-target.ts";

describeTargets("stub/late-console-known", () => {
  host().hooks.afterAll(async () => {
    console.warn("[fixture] a known late warning");
  });

  it("renders", async () => {
    const view = await mount({ html: "<p>Known</p>" });
    await expect.element(view.getByText("Known")).toBeVisible();
  });
});
