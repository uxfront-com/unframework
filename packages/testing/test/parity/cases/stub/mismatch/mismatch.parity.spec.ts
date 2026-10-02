// A scenario whose committed artefacts (written by hand) differ from the render: L7 fails with
// both diffs, and the test fails with them. L10 is skipped: "dom" is the live reference here, so
// its capture is the expectation (the visual command's comparisons are unit-tested in Node).
import { expect, inject, it } from "vitest";

import "../../../../../src/setup.ts";
import { describeTargets, LayerFailure, mount } from "../../../../../src/index.ts";
import { LIVE_REFERENCE_SKIP } from "../../../../../src/visual-types.ts";
import "../../../dom-target.ts";

// Update mode would overwrite the hand-written artefacts this case compares against.
describeTargets("stub/mismatch", () => {
  it.skipIf(inject("ufHarness").update)(
    "fails L7 with the DOM and ARIA diffs, and records L11 as passing",
    async ({ task }) => {
      const view = await mount({ html: '<p class="greeting">Hello, world!</p>' });
      const error = await view.expectParity("initial").then(
        () => undefined,
        (caught: unknown) => caught,
      );
      expect(error).toBeInstanceOf(LayerFailure);
      const failures = (error as LayerFailure).failures;
      expect(failures).toHaveLength(1);
      expect(failures[0]).toMatch(
        /^L7: cases\/stub\/mismatch\/__expected__\/dom\.initial\.html differs/,
      );
      expect(failures[0]).toContain("Goodbye");
      expect(failures[0]).toMatch(/aria\.initial\.yaml differs[\s\S]*- - paragraph: Goodbye/);
      expect(task.meta.uf?.layers).toMatchObject({
        L7: { status: "fail" },
        L10: { status: "skip", reason: LIVE_REFERENCE_SKIP },
        L11: { status: "pass" },
      });
    },
  );
});
