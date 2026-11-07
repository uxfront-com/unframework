// The stub tests that fail on purpose, which nothing inside a test can stand in for: L8, L9 and L13
// are judged after the body. Each run expects exit 1, and reads each test's state from the
// reporter's records, since a matrix test holds none. The 14 are the ones `it.fails` marked under
// Vitest: this file runs the 7 no other test reaches, and counts them all. Also the page errors
// (C3): nothing logged, on no layer, and still a failed run.
import { expect, it } from "vitest";

import { runStubs } from "./parity/run-stubs.ts";

/** The 7 `test/behaviour.test.ts` and `test/interactions.test.ts` run, by name. */
const ELSEWHERE = [
  "fails L8 with the test's own failed assertion",
  "fails L8 with an action on an element that is not there",
  "fails L8 when the test asserts nothing",
  "fails L8 when the unmount fails",
  "fails L8 with the error its afterEach threw",
  "still fails when another layer fails too",
  "fails L9 with a step no expectParity compared",
];

/** The 7 of this file. */
const HERE = [
  "fails the test on an unexpected console.warn",
  "fails the test on an unexpected console.error with printf arguments",
  "fails the test on a message from the adapter's server render",
  "fails the test on a message from a rerender's server render",
  "fails the test whose unmount leaves a warning for later",
  "fails the first test on the messages logged before it began",
  "fails the test, after its own assertions, with a layer that failed",
];

it("counts the 14 tests that fail on purpose", () => {
  expect(new Set([...ELSEWHERE, ...HERE]).size).toBe(14);
});

it("fails exactly the 7 of this file, and passes what reads their records", async () => {
  const { status, output, tests } = await runStubs([
    "console/console.fails.spec.ts",
    "console-outside/console-outside.fails.spec.ts",
    "match/match.fails.spec.ts",
  ]);
  expect(
    [...tests.values()]
      .filter(({ state }) => state === "fail")
      .map(({ name }) => name)
      .toSorted(),
    output,
  ).toEqual(HERE.toSorted());
  // The rest of each file read what those recorded, and passed.
  expect(tests.size).toBeGreaterThan(HERE.length);
  expect(status).toBe(1);
}, 180_000);

it("fails a run on an unhandled rejection, on the file's record", async () => {
  const { status, output, specs, tests } = await runStubs([
    "page-rejection/page-rejection.fails.spec.ts",
  ]);
  expect(status, output).toBe(1);
  expect(specs[0]?.file.uncaught).toMatchObject([
    { source: "page listener", message: "uf-probe-rejection" },
  ]);
  expect(tests.get("rejects with nothing to catch it")?.state).toBe("pass");
  expect(output).toMatch(/seen by the page listener.*uf-probe-rejection/);
}, 180_000);

it("fails a run on an error thrown from a timer, on the file's record", async () => {
  const { status, output, specs, tests } = await runStubs(["page-timer/page-timer.fails.spec.ts"]);
  expect(status, output).toBe(1);
  expect(specs[0]?.file.uncaught).toMatchObject([
    { source: "page listener", message: "uf-probe-timer" },
  ]);
  expect(tests.get("throws from a timer")?.state).toBe("pass");
}, 180_000);

it("leaves a rejection with no reason to L13, with nothing uncaught", async () => {
  const { status, output, specs, matrix } = await runStubs([
    "page-null-rejection/page-null-rejection.fails.spec.ts",
  ]);
  expect(status, output).toBe(1);
  expect(specs[0]?.file.uncaught).toEqual([]);
  expect(matrix.cases["stub/page-null-rejection"]?.dom?.L13).toMatch(/^fail: .*console\.error/s);
}, 180_000);
