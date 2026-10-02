// L13 after the last test, under a quarantine entry (project.ts): recorded on the file as
// quarantined, and the file passes. Run by test/late-console.test.ts only.
import { afterAll, it } from "vitest";

import "../../../../../src/setup.ts";
import { describeTargets, mount } from "../../../../../src/index.ts";
import "../../../dom-target.ts";

describeTargets("stub/late-console-known", () => {
  afterAll(() => {
    console.warn("[fixture] a known late warning");
  });

  it("renders", async () => {
    await mount({ html: "<p>Known</p>" });
  });
});
