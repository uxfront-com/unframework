// An error thrown from a timer, nothing logged: it fails the run, not a test's layers.
import { expect, it } from "vitest";

import "../../../../../src/setup.ts";
import { describeTargets } from "../../../../../src/index.ts";
import "../../../dom-target.ts";

describeTargets("stub/page-timer", () => {
  it("throws from a timer", async () => {
    setTimeout(() => {
      throw new Error("uf-probe-timer");
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(1).toBe(1);
  });
});
