// L8 end to end: the behaviour stubs run in Chromium on the page host, through the driver and its
// records to the parity reporter, in a complete run of the stub project, which must record L8
// failed, quarantined or passing in the matrix, and fail the quarantine entry of a cell that passes
// as stale.
import { expect, it } from "vitest";

import { runStubs } from "./parity/run-stubs.ts";

it("records L8 in the parity matrix, and fails a stale L8 quarantine entry", async () => {
  // The run is of every project the reporter knows: complete, so staleness is judged.
  const { status, output, tests, matrix } = await runStubs(
    [
      "behaviour/behaviour.fails.spec.ts",
      "behaviour-known/behaviour-known.fails.spec.ts",
      "behaviour-stale/behaviour-stale.parity.spec.ts",
    ],
    { complete: true },
  );
  const failed = [...tests.values()]
    .filter(({ state }) => state === "fail")
    .map(({ name }) => name)
    .toSorted();
  expect(failed, output).toEqual([
    "fails L8 when the test asserts nothing",
    "fails L8 when the unmount fails",
    "fails L8 with an action on an element that is not there",
    "fails L8 with the error its afterEach threw",
    "fails L8 with the test's own failed assertion",
    "still fails when another layer fails too",
  ]);
  const cells = matrix.cases;
  // Every failure of the cell's tests, each once, in the order of the tests.
  expect(cells["stub/behaviour"]?.dom?.L8, output).toMatch(
    /^fail: VitestBrowserElementError: Cannot find element with locator: getByTestId\('uf-root-\d+'\)\.getByText\('Goodbye'\)\n\nARIA tree:\n- paragraph: Hello\nTimeoutError: locator\.hover: Timeout 5000ms exceeded\.\nCall log:\n {2}- waiting for [^\n]*getByRole\('button', \{ name: 'Goodbye', exact: true \}\)\n\nThe test asserted nothing: [^\n]*\nUnmounting failed: \[fixture\] unmount\nError: \[fixture\] the spec's afterEach$/,
  );
  expect(cells["stub/behaviour-known"]?.dom?.L8, output).toBe("quarantined(#L8)");
  expect(cells["stub/behaviour-stale"]?.dom, output).toEqual({
    L8: "fail: stale quarantine entry: remove it. stub/behaviour-stale › dom › L8 passes (quarantined for #stale: fixture).",
    L13: "pass",
  });
  expect(output).toMatch(
    /\[uf:parity\] 1 problem\(s\) beyond the failed tests:\n {2}stale quarantine entry: remove it\. stub\/behaviour-stale › dom › L8 passes/,
  );
  expect(status).toBe(1);
}, 180_000);
