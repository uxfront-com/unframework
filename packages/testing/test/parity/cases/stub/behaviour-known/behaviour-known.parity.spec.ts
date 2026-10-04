// L8 under a quarantine entry (project.ts): the test's own failed assertion is recorded as
// quarantined and removed from the test's result, which then passes, unless another layer
// failed. A known failure still runs, and still fails (plan §7.7).
import { expect, it } from "vitest";

import "../../../../../src/setup.ts";
import { describeTargets, mount } from "../../../../../src/index.ts";
import "../../../dom-target.ts";

describeTargets("stub/behaviour-known", () => {
  it("passes when its assertion fails, as L8 is quarantined", async () => {
    const view = await mount({ html: "<p>Hello</p>" });
    // What is never rendered never appears: no need to wait the default 15 seconds.
    await expect.element(view.getByText("Goodbye"), { timeout: 100 }).toBeVisible();
  });

  it.fails("still fails when another layer fails too", async () => {
    console.warn("[fixture] a warning beside the known failure");
    const view = await mount({ html: "<p>Hello</p>" });
    // What is never rendered never appears: no need to wait the default 15 seconds.
    await expect.element(view.getByText("Goodbye"), { timeout: 100 }).toBeVisible();
  });

  it("recorded L8 as quarantined, and kept the other layer's failure", ({ task }) => {
    const [known, alsoL13] = task.suite?.tasks ?? [];
    expect(known?.meta.uf?.layers).toEqual({
      L8: { status: "quarantined", issue: "#L8" },
      L13: { status: "pass" },
    });
    expect(known?.result?.state).toBe("pass");
    expect(known?.result?.errors).toBeUndefined();
    expect(alsoL13?.meta.uf?.layers).toEqual({
      L8: { status: "quarantined", issue: "#L8" },
      L13: {
        status: "fail",
        message:
          "1 unexpected console message(s):\n  console.warn: [fixture] a warning beside the known failure",
      },
    });
  });
});
