// A setup file the page cannot import, end to end: Vitest's browser tester wraps the error in
// `Failed to import test file <setup file>`, and the parity reporter, which matches that message
// against the project's own `setupFiles`, records the failure in the partial matrix and leaves
// the project out of its zero-tests problem (ADR-0092).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";

import { afterEach, expect, it } from "vitest";
import { startVitest } from "vitest/node";

import { ParityReporter } from "../src/node/reporter.ts";
import { packageRoot, parityProject } from "./parity/project.ts";

const exitCode = process.exitCode;
const reportsDir = mkdtempSync(join(tmpdir(), "uf-setup-import-"));

afterEach(() => {
  // The run fails on purpose, and Vitest says so in the exit code it leaves.
  process.exitCode = exitCode;
  rmSync(reportsDir, { recursive: true, force: true });
});

it("records a setup file the page could not import, with Vitest's cause", async () => {
  let output = "";
  const sink = new Writable({
    write(chunk, _encoding, done) {
      output += String(chunk);
      done();
    },
  });
  const project = parityProject(process.env, ["test/parity/cases/stub/clock/*.parity.spec.ts"]);
  const reporter = new ParityReporter({ reportsDir, allProjects: ["parity"] });
  const vitest = await startVitest(
    [],
    {
      root: packageRoot,
      config: false,
      watch: false,
      reporters: [reporter],
      projects: [
        {
          ...project,
          test: { ...project.test, setupFiles: ["test/parity/unimportable-setup.ts"] },
        },
      ],
    },
    undefined,
    { stdout: sink, stderr: sink },
  );
  const states = vitest.state.getTestModules().map((module) => module.state());
  expect(states, output).toEqual(["failed"]);
  expect(reporter.matrix?.setupFailures, output).toEqual([
    {
      project: "parity",
      target: "dom",
      file: "test/parity/unimportable-setup.ts",
      specs: [
        {
          file: "test/parity/cases/stub/clock/clock.parity.spec.ts",
          case: "stub/clock",
        },
      ],
      errors: ["SyntaxError: [fixture] this setup file cannot be imported"],
    },
  ]);
  expect(reporter.matrix?.empty).toEqual(["parity"]);
  expect(output).not.toMatch(/collected zero tests/);
}, 120_000);
