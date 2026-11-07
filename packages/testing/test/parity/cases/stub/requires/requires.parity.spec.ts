// `requires` (ADR-0050): a test that requires a capability its target lacks is skipped before it
// runs, and records why on every browser layer, so the skip shows in the parity matrix
// (test/interactions.test.ts reads it there). The stub lacks a list box (project.ts).
import { expect, it as vitestIt } from "vitest";

import "../../../../../src/setup.ts";
import { describeTargets, it, mount } from "../../../../../src/index.ts";
import "../../../dom-target.ts";

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
