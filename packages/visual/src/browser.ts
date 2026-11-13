// The browser half of a visual run (ADR-0087): each generated spec calls `captureExample` with
// its example. One test mounts the example with no props, lets it settle and captures it with
// L10's own browser code (`captureVisual`), sent to `ufExampleCapture`, which locates it at the
// example. The test fails with L10's message when the capture does, so the run fails too.
import { describeTargets, it, mount } from "@unframework.dev/testing";
import { captureVisual } from "@unframework.dev/testing/harness";
import { expect, TestRunner } from "vitest";
import type { RunnerTestCase } from "vitest";
import { commands } from "vitest/browser";

import "./types.ts";

/** The test's name, which the run reads back from each spec. */
export const EXAMPLE_TEST = "renders like the reference";

/**
 * Declares the example's test: `id` is the example's id, `case` the generated spec's case id, and
 * `component` the example's default export.
 */
export function captureExample(id: string, caseId: string, component: () => unknown): void {
  describeTargets(id, () => {
    it(EXAMPLE_TEST, async () => {
      const test = TestRunner.getCurrentTest<RunnerTestCase | undefined>();
      if (!test) throw new Error("captureExample's test has no current test.");
      const view = await mount(component);
      await view.settle();
      const result = await captureVisual(
        test,
        { case: caseId, name: "example", container: view.container, locator: view.locator },
        (request) => commands.ufExampleCapture({ ...request, example: id }),
      );
      expect(
        result.pass,
        `${result.outcome} (${result.mode}, ${result.role}): ${result.message}`,
      ).toBe(true);
    });
  });
}
