// A case the target has no output for: the setup skips its tests before they run.
import { expect, it } from "vitest";

import "../../../../../src/setup.ts";
import { describeTargets } from "../../../../../src/index.ts";
import "../../../dom-target.ts";

describeTargets("stub/page-no-output", () => {
  it("has no output on this target", () => {
    expect(1).toBe(1);
  });
});
