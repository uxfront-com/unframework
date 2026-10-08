// A scenario whose committed artefacts (written by hand) differ from the render: L7 fails with
// both diffs, and the test fails with them. L10 is skipped: "dom" is the live reference here, so
// its capture is the expectation (the visual command's comparisons are unit-tested in Node).
import { expect, inject, it } from "vitest";

import "../../../../../src/setup.ts";
import { expectLayerFailure } from "../../../../../src/browser/behaviour.ts";
import { describeTargets, mount } from "../../../../../src/index.ts";
import { NO_INTERACTION_SKIP } from "../../../../../src/layers.ts";
import { LIVE_REFERENCE_SKIP } from "../../../../../src/visual-types.ts";
import "../../../dom-target.ts";

// Update mode would overwrite the hand-written artefacts this case compares against.
describeTargets("stub/mismatch", () => {
  it.skipIf(inject("ufHarness").update)(
    "fails L7 with the DOM and ARIA diffs, and records L11 as passing",
    async ({ task }) => {
      const view = await mount({ html: '<p class="greeting">Hello, world!</p>' });
      await view.expectParity("initial");
      const l7 = expectLayerFailure(
        "L7",
        /^cases\/stub\/mismatch\/__expected__\/dom\.initial\.html differs/,
      );
      expect(l7).toContain("Goodbye");
      expect(l7).toMatch(/aria\.initial\.yaml differs[\s\S]*- - paragraph: Goodbye/);
      // L7 is the only failure.
      expect(task.meta.uf?.layers).toEqual({
        L7: { status: "fail", message: l7 },
        L9: { status: "skip", reason: NO_INTERACTION_SKIP },
        L10: { status: "skip", reason: LIVE_REFERENCE_SKIP },
        L11: { status: "pass" },
      });
    },
  );
});
