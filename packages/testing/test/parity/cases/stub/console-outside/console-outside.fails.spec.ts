// L13 outside the test bodies: the capture starts when the setup file loads, so what the spec
// logs while it evaluates and in its beforeAll hook is judged with the first test, marked as
// logged before it. (What a file logs after its last test is recorded on the file, which fails:
// test/late-console.test.ts runs the stub/late-console fixtures and reads the parity matrix.) The
// first test fails on purpose, so only test/fails.test.ts runs this.
import { expect, it } from "vitest";

import "../../../../../src/setup.ts";
import { host } from "../../../../../src/browser/host.ts";
import { capturedConsole, describeTargets } from "../../../../../src/index.ts";
import "../../../dom-target.ts";
import { sibling } from "../../../stub-api.ts";

console.warn("[fixture] while the spec evaluates");

host().hooks.beforeAll(async () => {
  console.error("[fixture] in a beforeAll hook");
});

describeTargets("stub/console-outside", () => {
  const first = "fails the first test on the messages logged before it began";

  it(first, () => {
    // Asserted, so L13 is the only layer that fails it.
    expect(capturedConsole().map((entry) => entry.beforeTest)).toEqual([true, true]);
  });

  it("recorded them as L13 of that test, marked as logged before it", () => {
    const before = "before the test: module evaluation, a beforeAll hook or an earlier teardown";
    expect(sibling(first)?.meta.uf?.layers.L8).toEqual({ status: "pass" });
    expect(sibling(first)?.meta.uf?.layers.L13).toEqual({
      status: "fail",
      message: [
        "2 unexpected console message(s):",
        `  console.warn (${before}): [fixture] while the spec evaluates`,
        `  console.error (${before}): [fixture] in a beforeAll hook`,
      ].join("\n"),
    });
  });
});
