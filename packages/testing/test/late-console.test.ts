// A console message logged after a file's last test (a late teardown, an afterAll hook), end to
// end: the parity fixtures that log one run in Chromium on the page host, through the driver and its
// records to the parity reporter, which must record L13 as failed (or quarantined) in the matrix
// although the last test recorded it as passing.
import { basename } from "node:path";

import { expect, it } from "vitest";

import { runStubs } from "./parity/run-stubs.ts";

it("records an L13 failure logged after a file's last test in the parity matrix", async () => {
  const { status, output, specs, matrix } = await runStubs(["late-*/*.late.spec.ts"]);
  const states = Object.fromEntries(
    specs.map(({ filepath, file }) => [basename(filepath), file.state]),
  );
  expect(states, output).toEqual({
    "late-console.late.spec.ts": "fail",
    "late-console-known.late.spec.ts": "pass",
  });
  expect(status).toBe(1);
  expect(matrix.cases, output).toEqual({
    "stub/late-console": {
      dom: {
        L8: "pass",
        L13: expect.stringMatching(
          /^fail: after the last test of this file \(a late teardown or an afterAll hook\): 1 unexpected console message\(s\):\n {2}console\.warn: \[fixture\] after the last test$/,
        ),
      },
    },
    "stub/late-console-known": { dom: { L8: "pass", L13: "quarantined(#late)" } },
  });
}, 180_000);
