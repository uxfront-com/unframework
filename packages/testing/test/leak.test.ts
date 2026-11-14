// The after-test check (ADR-0098), end to end: a spec whose component leaves an element in `body`
// once its views are unmounted fails, and the parity reporter records L8 as failed, naming the
// element, in the matrix.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { Writable } from "node:stream";

import { afterEach, expect, it } from "vitest";
import { startVitest } from "vitest/node";

import { ParityReporter } from "../src/node/reporter.ts";
import { packageRoot, parityProject } from "./parity/project.ts";

const exitCode = process.exitCode;
const reportsDir = mkdtempSync(join(tmpdir(), "uf-leak-"));

afterEach(() => {
  // The run fails on purpose, and Vitest says so in the exit code it leaves.
  process.exitCode = exitCode;
  rmSync(reportsDir, { recursive: true, force: true });
});

it("fails L8 for an element a test left in body", async () => {
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
      projects: [parityProject(process.env, ["test/parity/cases/stub/leak/*.late.spec.ts"])],
    },
    undefined,
    { stdout: sink, stderr: sink },
  );
  const states = Object.fromEntries(
    vitest.state.getTestModules().map((module) => [basename(module.moduleId), module.state()]),
  );
  expect(states, output).toEqual({ "leak.late.spec.ts": "failed" });
  expect(reporter.matrix?.cases["stub/leak"]?.dom?.L8, output).toMatch(
    /^fail: .*The test left an element in <body> once its views were unmounted: <div class="toast">\./,
  );
}, 120_000);
