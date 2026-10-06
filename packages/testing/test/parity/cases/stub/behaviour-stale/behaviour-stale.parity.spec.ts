// L8 under a quarantine entry (project.ts) that no longer fails: the test passes and records L8
// as a pass, as one test cannot tell a stale entry from one another test of the cell still
// needs. The run's reporter fails the entry once every record of the cell is in
// (test/behaviour.test.ts).
import { expect, it } from "vitest";

import "../../../../../src/setup.ts";
import { describeTargets, mount } from "../../../../../src/index.ts";
import "../../../dom-target.ts";

describeTargets("stub/behaviour-stale", () => {
  it("passes, and records the pass under the entry as it is", async () => {
    const view = await mount({ html: "<p>Fixed</p>" });
    await expect.element(view.getByText("Fixed")).toBeVisible();
  });

  it("recorded L8 as a pass", ({ task }) => {
    expect(task.suite?.tasks[0]?.meta.uf?.layers.L8).toEqual({ status: "pass" });
  });
});
