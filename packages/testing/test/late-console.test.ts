// A console message logged after a file's last test (a late teardown, an afterAll hook), end to
// end: the parity fixtures that log one run in Chromium, through Vitest's runner and its task
// updates to the parity reporter, which must record L13 as failed (or quarantined) in the matrix
// although the last test recorded it as passing.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { Writable } from "node:stream";

import { afterEach, expect, it } from "vitest";
import { startVitest } from "vitest/node";

import { ParityReporter } from "../src/node/reporter.ts";
import { packageRoot, parityProject } from "./parity/project.ts";

const exitCode = process.exitCode;
const reportsDir = mkdtempSync(join(tmpdir(), "uf-late-"));

afterEach(() => {
  // The run fails on purpose, and Vitest says so in the exit code it leaves.
  process.exitCode = exitCode;
  rmSync(reportsDir, { recursive: true, force: true });
});

it("records an L13 failure logged after a file's last test in the parity matrix", async () => {
  let output = "";
  const sink = new Writable({
    write(chunk, _encoding, done) {
      output += String(chunk);
      done();
    },
  });
  const reporter = new ParityReporter({ reportsDir });
  const vitest = await startVitest(
    [],
    {
      root: packageRoot,
      config: false,
      watch: false,
      reporters: [reporter],
      projects: [parityProject(process.env, ["test/parity/cases/stub/late-*/*.late.spec.ts"])],
    },
    undefined,
    { stdout: sink, stderr: sink },
  );
  const states = Object.fromEntries(
    vitest.state.getTestModules().map((module) => [basename(module.moduleId), module.state()]),
  );
  expect(states, output).toEqual({
    "late-console.late.spec.ts": "failed",
    "late-console-known.late.spec.ts": "passed",
  });
  expect(reporter.matrix?.cases, output).toEqual({
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
}, 120_000);
