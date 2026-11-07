// Run as a test of `stub/behaviour-known`, whose L8 is quarantined: the test's own failure is
// recorded as quarantined, and the setup's judge takes its errors out of its result.
import { expect, it } from "vitest";

import "../../../../../src/setup.ts";
import { describeTargets } from "../../../../../src/index.ts";
import "../../../dom-target.ts";

describeTargets("stub/page-quarantine", () => {
  it("fails its assertion", () => {
    expect(1).toBe(2);
  });
});
