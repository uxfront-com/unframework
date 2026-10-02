// The setup file every browser project loads first (DESIGN §4.3):
// - determinism: the bundled font, the motion and caret reset, and the startup assertions;
// - console capture from the moment this file loads, recorded as L13 for every test of a case,
//   then failed on; a message logged outside a test is judged with the next test, and one
//   logged after the last test is recorded on the file and fails it;
// - cleanup: whatever a test mounted is unmounted inside the capture window, so unmount warnings
//   count too.
import { afterAll, afterEach, beforeAll, beforeEach, inject } from "vitest";

import {
  beginTestConsole,
  describeConsole,
  endTestConsole,
  installConsoleCapture,
  unexpectedConsole,
} from "./browser/console.ts";
import { installDeterminism } from "./browser/determinism.ts";
import { currentTarget } from "./browser/target.ts";
import { cleanup } from "./browser/view.ts";
import { formatError } from "./errors.ts";
import { caseOfFile } from "./harness.ts";
import { recordLayer } from "./layers.ts";

installConsoleCapture();

beforeAll(async () => {
  await installDeterminism();
});

beforeEach(() => {
  beginTestConsole();
});

afterEach(async ({ task }) => {
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
  const recorded = recordLayer(
    task,
    subject,
    "L13",
    unexpected.length
      ? { status: "fail", message: describeConsole(unexpected) }
      : { status: "pass" },
  );
  if (cleanupError) {
    throw new Error(`Unmounting failed: ${formatError(cleanupError)}`, { cause: cleanupError });
  }
  if (recorded.status === "fail") {
    // Throwing from afterEach fails the test (verified by the browser-projects spike).
    throw new Error(`L13: ${recorded.message}`);
  }
});

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
