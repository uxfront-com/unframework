// A `beforeAll` that throws fails the file, and skips its tests with no records (PLAN v6 review).
import { expect, it } from "vitest";

import "../../../../../src/setup.ts";
import { host } from "../../../../../src/browser/host.ts";
import { describeTargets } from "../../../../../src/index.ts";
import "../../../dom-target.ts";

host().hooks.beforeAll(() => Promise.reject(new Error("uf-probe-before-all")));

describeTargets("stub/page-before-all", () => {
  it("never runs", () => {
    expect(1).toBe(1);
  });
});
