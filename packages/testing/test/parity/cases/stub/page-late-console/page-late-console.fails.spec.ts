// A warning after the last test has nothing left to judge it but the file.
import { expect, it } from "vitest";

import "../../../../../src/setup.ts";
import { host } from "../../../../../src/browser/host.ts";
import { describeTargets } from "../../../../../src/index.ts";
import "../../../dom-target.ts";

host().hooks.afterAll(() => {
  console.warn("uf-probe-late");
  return Promise.resolve();
});

describeTargets("stub/page-late-console", () => {
  it("passes", () => {
    expect(1).toBe(1);
  });
});
