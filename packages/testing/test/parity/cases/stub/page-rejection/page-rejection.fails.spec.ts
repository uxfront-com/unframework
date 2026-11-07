// An unhandled rejection with a value, nothing logged: it fails the run, not a test's layers.
import { expect, it } from "vitest";

import "../../../../../src/setup.ts";
import { describeTargets } from "../../../../../src/index.ts";
import "../../../dom-target.ts";

describeTargets("stub/page-rejection", () => {
  it("rejects with nothing to catch it", async () => {
    void Promise.reject(new Error("uf-probe-rejection"));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(1).toBe(1);
  });
});
