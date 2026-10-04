// L8 end to end: the behaviour stubs run in Chromium, through Vitest's runner and its task
// updates to the parity reporter, in a run of the whole parity project, which must record L8
// failed, quarantined or passing in the matrix, and fail the quarantine entry of a cell that
// passes as stale.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { Writable } from "node:stream";

import { afterEach, expect, it } from "vitest";
import { startVitest } from "vitest/node";

import { ParityReporter } from "../src/node/reporter.ts";
import { packageRoot, parityProject } from "./parity/project.ts";

const exitCode = process.exitCode;
const reportsDir = mkdtempSync(join(tmpdir(), "uf-behaviour-"));

afterEach(() => {
  // The stale entry fails the run on purpose, and the reporter says so in the exit code.
  process.exitCode = exitCode;
  rmSync(reportsDir, { recursive: true, force: true });
});

it("records L8 in the parity matrix, and fails a stale L8 quarantine entry", async () => {
  let output = "";
  const sink = new Writable({
    write(chunk, _encoding, done) {
      output += String(chunk);
      done();
    },
  });
  // The run is of every project the reporter knows: complete, so staleness is judged.
  const reporter = new ParityReporter({ reportsDir, allProjects: ["parity"] });
  const vitest = await startVitest(
    [],
    {
      root: packageRoot,
      config: false,
      watch: false,
      reporters: [reporter],
      projects: [
        parityProject(process.env, ["test/parity/cases/stub/behaviour*/*.parity.spec.ts"]),
      ],
    },
    undefined,
    { stdout: sink, stderr: sink },
  );
  const states = Object.fromEntries(
    vitest.state.getTestModules().map((module) => [basename(module.moduleId), module.state()]),
  );
  expect(states, output).toEqual({
    "behaviour.parity.spec.ts": "passed",
    "behaviour-known.parity.spec.ts": "passed",
    "behaviour-stale.parity.spec.ts": "passed",
  });
  const cells = reporter.matrix?.cases;
  // Every failure of the cell's tests, each once, in the order of the tests.
  expect(cells?.["stub/behaviour"]?.dom?.L8, output).toMatch(
    /^fail: VitestBrowserElementError: Cannot find element with locator: getByTestId\('uf-root-\d+'\)\.getByText\('Goodbye'\)\n\nARIA tree:\n- paragraph: Hello\nThe test asserted nothing: [^\n]*\nUnmounting failed: \[fixture\] unmount\nError: \[fixture\] the spec's afterEach$/,
  );
  expect(cells?.["stub/behaviour-known"]?.dom?.L8, output).toBe("quarantined(#L8)");
  expect(cells?.["stub/behaviour-stale"]?.dom, output).toEqual({
    L8: "fail: stale quarantine entry: remove it. stub/behaviour-stale › dom › L8 passes (quarantined for #stale: fixture).",
    L13: "pass",
  });
  expect(output).toMatch(
    /\[uf:parity\] 1 problem\(s\) beyond the failed tests:\n {2}stale quarantine entry: remove it\. stub\/behaviour-stale › dom › L8 passes/,
  );
  expect(process.exitCode).toBe(1);
}, 120_000);
