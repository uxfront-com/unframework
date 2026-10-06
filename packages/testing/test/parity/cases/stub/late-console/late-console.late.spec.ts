// L13 after the last test: a message an afterAll hook logs is recorded on the file, which fails.
// It fails on purpose, so only test/late-console.test.ts runs it (`lateConsoleProject`), and
// checks the parity matrix it leads to.
import { afterAll, expect, it } from "vitest";

import "../../../../../src/setup.ts";
import { describeTargets, mount } from "../../../../../src/index.ts";
import "../../../dom-target.ts";

describeTargets("stub/late-console", () => {
  afterAll(() => {
    console.warn("[fixture] after the last test");
  });

  it("renders", async () => {
    const view = await mount({ html: "<p>Late</p>" });
    await expect.element(view.getByText("Late")).toBeVisible();
  });
});
