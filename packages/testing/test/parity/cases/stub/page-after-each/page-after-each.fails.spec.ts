// A spec's own afterEach that never finishes stops the setup's from running, as a throw does, so
// the setup's around hook has to judge the test.
import { expect, it } from "vitest";

import "../../../../../src/setup.ts";
import { host } from "../../../../../src/browser/host.ts";
import { describeTargets } from "../../../../../src/index.ts";
import "../../../dom-target.ts";

host().hooks.afterEach(() => new Promise(() => {}));

describeTargets("stub/page-after-each", () => {
  it("has a stuck after hook", () => {
    expect(1).toBe(1);
  });
});
