// The setup file every browser project loads first (DESIGN §4.3):
// - determinism: the bundled font, the motion and caret reset, and the startup assertions;
// - console capture from the moment this file loads, recorded as L13 for every test of a case,
//   then failed on; a message logged outside a test is judged with the next test, and one
//   logged after the last test is recorded on the file and fails it;
// - cleanup: whatever a test mounted is unmounted inside the capture window, so unmount warnings
//   count too;
// - behaviour: the test's own errors (its assertions, its hooks, a test without assertions, a
//   failed unmount) recorded as L8, then one error with every failed layer (ADR-0043);
// - bounds: `expect.element` waits the project's poll timeout, not the whole test's.
import { afterAll, afterEach, aroundEach, beforeAll, beforeEach, inject } from "vitest";
import type { RunnerTestCase } from "vitest";

import { judgeTest } from "./browser/behaviour.ts";
import {
  beginTestConsole,
  describeConsole,
  endTestConsole,
  installConsoleCapture,
  unexpectedConsole,
} from "./browser/console.ts";
import { installDeterminism } from "./browser/determinism.ts";
import { boundElementTimeout } from "./browser/element-timeout.ts";
import { currentTarget } from "./browser/target.ts";
import { cleanup } from "./browser/view.ts";
import { caseOfFile } from "./harness.ts";
import { recordLayer } from "./layers.ts";

installConsoleCapture();
boundElementTimeout();

beforeAll(async () => {
  await installDeterminism();
});

beforeEach(() => {
  beginTestConsole();
});

/** The tests this file's afterEach has judged. */
const judged = new WeakSet<object>();

afterEach(async ({ task }) => {
  judged.add(task);
  await afterTest(task);
});

// A spec's own afterEach that throws stops Vitest from running the afterEach hooks after it,
// this file's among them. The test would then keep its views mounted and record neither L13
// nor L8, so this hook, around every test, judges it when the afterEach could not. Its first
// parameter is the test's, the second its fixtures, which Vitest needs as a destructuring pattern.
aroundEach(async (runTest, { task }) => {
  await runTest();
  if (!judged.has(task)) await afterTest(task);
});

/**
 * Unmounts what the test mounted, records L13 and then L8, and fails the test with every failed
 * layer. Throwing from afterEach fails the test (verified by the browser-projects spike).
 */
async function afterTest(task: RunnerTestCase): Promise<void> {
  let cleanupError: unknown;
  try {
    await cleanup();
  } catch (error) {
    cleanupError = error;
  }
  await settleTeardown();
  const harness = inject("ufHarness");
  const subject = {
    case: caseOfFile(task.file.filepath, harness),
    target: currentTarget(),
    quarantine: harness.quarantine,
  };
  const unexpected = unexpectedConsole();
  endTestConsole();
  recordLayer(
    task,
    subject,
    "L13",
    unexpected.length
      ? { status: "fail", message: describeConsole(unexpected) }
      : { status: "pass" },
  );
  // Last, so L8 sees every error the spec's own hooks threw (they ran before this one).
  judgeTest(task, subject, cleanupError);
}

// Registered before any spec's hooks, so it runs after them (Vitest runs after-hooks as a stack).
// Vitest reads a hook's fixtures from its first parameter, which must be a destructuring
// pattern even when, as here, the hook only needs the suite (the second).
// oxlint-disable-next-line no-empty-pattern
afterAll(async ({}, suite) => {
  await settleTeardown();
  const late = unexpectedConsole();
  endTestConsole();
  if (!late.length) return;
  const file = suite.file;
  const harness = inject("ufHarness");
  // The last test has recorded L13 already; the file's own record reaches the parity reporter
  // with the file's result, and the quarantine applies to it as to any record.
  const recorded = recordLayer(
    file,
    {
      case: caseOfFile(file.filepath, harness),
      target: currentTarget(),
      quarantine: harness.quarantine,
    },
    "L13",
    {
      status: "fail",
      message: `after the last test of this file (a late teardown or an afterAll hook): ${describeConsole(late)}`,
    },
  );
  if (recorded.status === "fail") throw new Error(`L13: ${recorded.message}`);
});

/**
 * Lets work a teardown scheduled run before the console is judged: a task, then a frame. A
 * framework scheduler's warning after unmount then lands in the test that unmounted.
 */
async function settleTeardown(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}
