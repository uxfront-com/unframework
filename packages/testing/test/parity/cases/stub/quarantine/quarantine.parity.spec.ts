// The quarantine (project.ts lists L7 and L11 of this case): a test never decides whether an
// entry is stale, because another test of the same (case, target, layer) cell may still fail.
// A quarantined layer that fails is recorded as quarantined and does not fail the test; one
// that passes is recorded as a pass, and the run's reporter fails the entry once every record of
// the cell is in (test/reporter.test.ts).
import { expect, inject, it } from "vitest";

import "../../../../../src/setup.ts";
import { describeTargets, mount } from "../../../../../src/index.ts";
import { LIVE_REFERENCE_SKIP } from "../../../../../src/visual-types.ts";
import "../../../dom-target.ts";

// Update mode would write the artefacts whose absence makes L7 fail here.
describeTargets("stub/quarantine", () => {
  it.skipIf(inject("ufHarness").update)(
    "records a quarantined failure, and a pass under an entry as it is",
    async ({ task }) => {
      const view = await mount({ html: "<p>Known differences</p>" });
      await view.expectParity("initial");
      expect(task.meta.uf?.layers).toEqual({
        L7: { status: "quarantined", issue: "#L7" },
        L10: { status: "skip", reason: LIVE_REFERENCE_SKIP },
        L11: { status: "pass" },
      });
    },
  );
});
