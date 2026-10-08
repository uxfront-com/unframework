// `requires` (ADR-0050): a test that requires a capability its target lacks is skipped before it
// runs, and records why on every browser layer, so the skip shows in the parity matrix
// (test/requires.test.ts reads it there). The stub lacks a list box (project.ts).
import { expect, it as vitestIt } from "vitest";

import "../../../../../src/setup.ts";
import { describeTargets, it, mount } from "../../../../../src/index.ts";
import "../../../dom-target.ts";

/** The stub's reason for the list box it lacks (`STUB_LISTBOX_REASON` in project.ts). */
const SKIP = "requires listbox: the stub target renders no list box";

describeTargets("stub/requires", () => {
  it(
    "runs a test whose capabilities its target supports",
    { requires: ["interactivity"] },
    async ({ task }) => {
      const view = await mount({ html: "<p>Runs</p>" });
      await view.expectParity("supported");
      await expect.element(view.getByText("Runs")).toBeVisible();
      expect(task.meta.ufRequires).toEqual(["interactivity"]);
    },
  );

  it(
    "skips a test that requires a list box, which the stub lacks",
    { requires: ["interactivity", "listbox"] },
    async () => {
      const view = await mount({ html: "<p>Never</p>" });
      await view.expectParity("unsupported");
      throw new Error("[fixture] a test skipped by capability never runs");
    },
  );

  vitestIt("recorded why the test above was skipped, on every browser layer", ({ task }) => {
    const sibling = task.suite?.tasks.find(
      (test) => test.name === "skips a test that requires a list box, which the stub lacks",
    );
    expect(sibling?.result?.state).toBe("skip");
    const skip = { status: "skip", reason: SKIP };
    expect(sibling?.meta.uf).toEqual({
      case: "stub/requires",
      target: "dom",
      layers: { L7: skip, L8: skip, L9: skip, L10: skip, L11: skip, L13: skip },
      skipped: SKIP,
    });
  });

  vitestIt("refuses the options that would skip, repeat or reorder a test", () => {
    const fn = () => undefined;
    for (const option of [
      "skip",
      "only",
      "todo",
      "fails",
      "retry",
      "repeats",
      "concurrent",
      "tags",
    ]) {
      expect(() => it("refused", { [option]: true } as never, fn), option).toThrow(
        `it("refused"): a corpus test does not set ${option}.`,
      );
    }
    expect(() => it("refused", { requires: [] }, fn)).toThrow(
      'it("refused"): requires names one or more capabilities.',
    );
    expect(() => it("refused", { requires: ["teleport" as never] }, fn)).toThrow(
      /^"teleport" is not a capability: the capabilities are element, /,
    );
  });
});
