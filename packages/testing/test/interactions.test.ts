// Interactions, traces and capability skips end to end (ADR-0050): the interaction stubs run in
// Chromium on the page host, through the driver and its records to the parity reporter, which must
// record each test by its name, its scenarios and its capability skip in the matrix (version 5), and
// L9 as it was judged; the summary then accepts every skip they recorded.
import { expect, it } from "vitest";

import { LAYERS } from "../src/layers.ts";
import { MATRIX_VERSION } from "../src/node/matrix.ts";
import { summarise } from "../src/node/summary.ts";
import { STUB_CAPABILITIES } from "./parity/project.ts";
import { runStubs } from "./parity/run-stubs.ts";

const SKIP = "requires listbox: the stub target renders no list box";
const SKIPPED = "skips a test that requires a list box, which the stub lacks";

it("records each test's scenarios and capability skip, and L9, in the parity matrix", async () => {
  const { status, output, tests, matrix } = await runStubs([
    "interactions/*.spec.ts",
    "requires/*.parity.spec.ts",
  ]);
  // The one test that leaves a step uncompared fails on purpose, and it alone.
  expect(
    [...tests.values()].filter(({ state }) => state === "fail").map(({ name }) => name),
    output,
  ).toEqual(["fails L9 with a step no expectParity compared"]);
  expect(status).toBe(1);
  // A skipped test that recorded why is no problem for the reporter.
  expect(output).not.toContain("problem(s) beyond the failed tests");

  const skip = { status: "skip", reason: SKIP };
  expect(tests.get(SKIPPED)?.state).toBe("skip");
  expect(tests.get(SKIPPED)?.meta.uf).toEqual({
    case: "stub/requires",
    target: "dom",
    layers: { L7: skip, L8: skip, L9: skip, L10: skip, L11: skip, L13: skip },
    skipped: SKIP,
  });

  expect(matrix.version).toBe(MATRIX_VERSION);
  const requires = matrix.tests["stub/requires"]?.dom;
  expect(requires).toEqual({
    "stub/requires > runs a test whose capabilities its target supports": {
      scenarios: ["supported"],
    },
    [`stub/requires > ${SKIPPED}`]: { scenarios: [], skipped: SKIP },
  });
  const interactions = matrix.tests["stub/interactions"]?.dom ?? {};
  expect(
    interactions["stub/interactions > counts clicks and emits each count, as the trace records"],
  ).toEqual({
    scenarios: ["after-clicks"],
  });
  // The test that left a step uncompared fails the cell's L9, whatever its siblings passed.
  expect(matrix.cases["stub/interactions"]?.dom?.L9).toMatch(
    /^fail: 1 step\(s\) of uf-root-\d+ were never compared \(click getByRole/,
  );

  // Every skip they recorded names a capability or a mechanical cause.
  const summary = summarise([matrix], {
    projects: ["parity"],
    cases: ["stub/interactions", "stub/requires"],
    targets: ["dom"],
    liveLayers: LAYERS.filter((layer) => ["L7", "L8", "L9", "L10", "L11", "L13"].includes(layer)),
    notLiveReason: "not live in the stub suite",
    capabilities: Object.keys(STUB_CAPABILITIES),
  });
  expect(summary.problems.filter((problem) => problem.includes("skipped"))).toEqual([]);
  expect(summary.markdown).toContain(
    `- skipped on dom by capability: "stub/requires > ${SKIPPED}" (${SKIP}).`,
  );
}, 180_000);
