// Interactions, traces and capability skips end to end (ADR-0050): the interaction stubs run in
// Chromium, through Vitest's runner and its task updates to the parity reporter, which must
// record each test by its name, its scenarios and its capability skip in the matrix (version 5),
// and L9 as it was judged; the summary then accepts every skip they recorded.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { Writable } from "node:stream";

import { afterEach, expect, it } from "vitest";
import { startVitest } from "vitest/node";

import { LAYERS } from "../src/layers.ts";
import { MATRIX_VERSION } from "../src/node/matrix.ts";
import { ParityReporter } from "../src/node/reporter.ts";
import { summarise } from "../src/node/summary.ts";
import { packageRoot, parityProject, STUB_CAPABILITIES } from "./parity/project.ts";

const exitCode = process.exitCode;
const reportsDir = mkdtempSync(join(tmpdir(), "uf-interactions-"));

afterEach(() => {
  process.exitCode = exitCode;
  rmSync(reportsDir, { recursive: true, force: true });
});

const SKIP = "requires listbox: the stub target renders no list box";

it("records each test's scenarios and capability skip, and L9, in the parity matrix", async () => {
  let output = "";
  const sink = new Writable({
    write(chunk, _encoding, done) {
      output += String(chunk);
      done();
    },
  });
  const reporter = new ParityReporter({ reportsDir, allProjects: ["parity"] });
  const vitest = await startVitest(
    [],
    {
      root: packageRoot,
      config: false,
      watch: false,
      reporters: [reporter],
      projects: [
        parityProject(process.env, [
          "test/parity/cases/stub/interactions/*.parity.spec.ts",
          "test/parity/cases/stub/requires/*.parity.spec.ts",
        ]),
      ],
    },
    undefined,
    { stdout: sink, stderr: sink },
  );
  const states = Object.fromEntries(
    vitest.state.getTestModules().map((module) => [basename(module.moduleId), module.state()]),
  );
  expect(states, output).toEqual({
    "interactions.parity.spec.ts": "passed",
    "requires.parity.spec.ts": "passed",
  });
  // A skipped test that recorded why is no problem for the reporter.
  expect(output).not.toContain("problem(s) beyond the failed tests");
  expect(process.exitCode).toBe(exitCode);

  const matrix = reporter.matrix!;
  expect(matrix.version).toBe(MATRIX_VERSION);
  const requires = matrix.tests["stub/requires"]?.dom;
  expect(requires).toEqual({
    "stub/requires > runs a test whose capabilities its target supports": {
      scenarios: ["supported"],
    },
    "stub/requires > skips a test that requires a list box, which the stub lacks": {
      scenarios: [],
      skipped: SKIP,
    },
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
    `- skipped on dom by capability: "stub/requires > skips a test that requires a list box, which the stub lacks" (${SKIP}).`,
  );
}, 120_000);
