// L9 against a trace that differs from the run (committed by hand): a step whose DOM, ARIA tree
// and events differ fails with the diff of the trace file; and a scenario no step led to fails
// when a trace for it is committed all the same, which no test would read otherwise.
import { expect, inject, it } from "vitest";

import "../../../../../src/setup.ts";
import { expectLayerFailure } from "../../../../../src/browser/behaviour.ts";
import { describeTargets, mount } from "../../../../../src/index.ts";
import type { StubComponent } from "../../../dom-target.ts";
import "../../../dom-target.ts";

/** A counter: a status and a button that counts and emits the count. */
const counter: StubComponent = {
  html: '<p role="status">0</p><button type="button">Add one</button>',
  emits: [{ name: "change", optional: [false] }],
  setup(container, emit, signal) {
    const status = container.querySelector("p")!;
    container.querySelector("button")!.addEventListener(
      "click",
      () => {
        status.textContent = String(Number(status.textContent) + 1);
        emit("change", Number(status.textContent));
      },
      { signal },
    );
  },
};

// Update mode would overwrite the hand-written traces this case compares against.
describeTargets("stub/trace-mismatch", () => {
  it.skipIf(inject("ufHarness").update)(
    "fails L9 with the diff of a step that differs from the trace",
    async ({ task }) => {
      const view = await mount(counter);
      await view.user.click(view.getByRole("button", { name: "Add one" }));
      await view.expectParity("after-click");
      // No DOM or ARIA artefact is committed: L7 is not the subject.
      expectLayerFailure("L7", /Missing artefact/);
      const l9 = expectLayerFailure(
        "L9",
        /^cases\/stub\/trace-mismatch\/__expected__\/trace\.after-click\.json differs from this run's output:/,
      );
      // The status, its ARIA node and the payload: each line that differs.
      expect(l9).toMatch(/^- +"  \\"2\\"",$/m);
      expect(l9).toMatch(/^\+ +"  \\"1\\"",$/m);
      expect(l9).toMatch(/^- +"- status: \\"2\\"",$/m);
      expect(l9).toMatch(/^- +2$/m);
      expect(l9).toMatch(/^\+ +1$/m);
      expect(task.meta.uf?.scenarios).toEqual(["after-click"]);
    },
  );

  it.skipIf(inject("ufHarness").update)(
    "fails L9 on a trace committed for a scenario that no step led to",
    async () => {
      const view = await mount(counter);
      await view.expectParity("no-steps");
      expectLayerFailure("L7", /Missing artefact/);
      expectLayerFailure(
        "L9",
        /^Stale artefact cases\/stub\/trace-mismatch\/__expected__\/trace\.no-steps\.json: this run no longer produces it/,
      );
    },
  );
});
