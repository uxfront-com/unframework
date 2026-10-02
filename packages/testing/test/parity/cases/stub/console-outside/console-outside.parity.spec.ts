// L13 outside the test bodies: the capture starts when the setup file loads, so what the spec
// logs while it evaluates and in its beforeAll hook is judged with the first test, marked as
// logged before it. (What a file logs after its last test is recorded on the file, which fails:
// test/late-console.test.ts runs the stub/late-console fixtures and reads the parity matrix.)
import { beforeAll, expect, it } from "vitest";

import "../../../../../src/setup.ts";
import { describeTargets } from "../../../../../src/index.ts";
import "../../../dom-target.ts";

console.warn("[fixture] while the spec evaluates");

beforeAll(() => {
  console.error("[fixture] in a beforeAll hook");
});

describeTargets("stub/console-outside", () => {
  it.fails("fails the first test on the messages logged before it began", () => {});

  it("recorded them as L13 of that test, marked as logged before it", ({ task }) => {
    const before = "before the test: module evaluation, a beforeAll hook or an earlier teardown";
    expect(task.suite?.tasks[0]?.meta.uf?.layers.L13).toEqual({
      status: "fail",
      message: [
        "2 unexpected console message(s):",
        `  console.warn (${before}): [fixture] while the spec evaluates`,
        `  console.error (${before}): [fixture] in a beforeAll hook`,
      ].join("\n"),
    });
  });
});
