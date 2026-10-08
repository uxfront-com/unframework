// The setup file every browser project loads first (plan §7.3):
// - determinism: the bundled font, the motion and caret reset, and the startup assertions;
// - console capture from the moment this file loads, recorded as L13 for every test of a case,
//   then failed on; a message logged outside a test is judged with the next test, and one
//   logged after the last test is recorded on the file and fails it;
// - capabilities: a test that requires one its target does not support is skipped before it
//   runs, and every layer it would have recorded says why (ADR-0050); so is every test of a
//   case the target has no output for, with the case's expected errors;
// - navigation: a form submission or a link the component does not prevent is prevented, and
//   fails the test, rather than taking the whole spec file's frame away;
// - cleanup: whatever a test mounted is unmounted inside the capture window, so unmount warnings
//   count too; then a view's clock gives the page its real intervals back, and the mouse, the
//   keys and the focus are reset for the next test;
// - traces: a step of a view's trace that no `expectParity` compared fails L9;
// - behaviour: the test's own errors (its assertions, its hooks, a test without assertions, a
//   failed unmount) recorded as L8, then one error with every failed layer (ADR-0043);
// - bounds: `expect.element` waits the project's poll timeout, not the whole test's.
import { afterAll, afterEach, aroundEach, beforeAll, beforeEach, inject } from "vitest";
import type { RunnerTestCase } from "vitest";
import { commands, userEvent } from "vitest/browser";

import "./commands.ts";
import { judgeTest } from "./browser/behaviour.ts";
import { noOutputReason, requiredSkip } from "./browser/capabilities.ts";
import { restoreClock } from "./browser/clock.ts";
import {
  beginTestConsole,
  describeConsole,
  endTestConsole,
  installConsoleCapture,
  unexpectedConsole,
} from "./browser/console.ts";
import { installDeterminism } from "./browser/determinism.ts";
import { boundElementTimeout } from "./browser/element-timeout.ts";
import { installNavigationGuard, takePreventedNavigations } from "./browser/navigation.ts";
import { currentTarget } from "./browser/target.ts";
import { closeTraces } from "./browser/trace.ts";
import { releaseKeys } from "./browser/user.ts";
import { cleanup } from "./browser/view.ts";
import { caseOfFile } from "./harness.ts";
import { recordLayer } from "./layers.ts";
import type { LayerName, LayerSubject } from "./layers.ts";

installConsoleCapture();
boundElementTimeout();
installNavigationGuard();

/** The layers a browser test records, which a test skipped by capability records as skipped. */
const BROWSER_LAYERS: readonly LayerName[] = ["L7", "L8", "L9", "L10", "L11", "L13"];

beforeAll(async () => {
  await installDeterminism();
});

beforeEach(({ task, skip }) => {
  beginTestConsole();
  // A trace a test before this one left behind is that test's, judged already.
  closeTraces();
  const requires = task.meta.ufRequires;
  const subject = subjectOf(task);
  // A case the target has no output for has a stand-in for its component, which renders
  // nothing: each of its tests is skipped there, whatever it requires, with the errors the case
  // expects.
  const reason = noOutputReason(subject.case) ?? (requires ? requiredSkip(requires) : undefined);
  if (reason === undefined) return;
  // Recorded before skipping: the parity reporter fails a skip that records no reason, and the
  // summary excuses this test's scenarios on this target alone (`meta.uf.skipped`).
  for (const layer of BROWSER_LAYERS) recordLayer(task, subject, layer, { status: "skip", reason });
  task.meta.uf!.skipped = reason;
  skip(reason);
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
 * Unmounts what the test mounted, restores the real intervals a view's clock faked, resets the
 * input, records L9's leftover steps, L13 and then L8, and fails the test with every failed
 * layer. Throwing from afterEach fails the test (verified by the browser-projects spike). A test
 * skipped by capability ran nothing: it has recorded every layer, and the console's entries are
 * the next test's to judge.
 */
async function afterTest(task: RunnerTestCase): Promise<void> {
  if (task.meta.uf?.skipped !== undefined) return;
  let cleanupError: unknown;
  try {
    await cleanup();
  } catch (error) {
    cleanupError = error;
  }
  // After the unmount, so a component's teardown clears its interval on the clock that set it.
  restoreClock();
  await resetInput();
  await settleTeardown();
  const subject = subjectOf(task);
  for (const message of closeTraces()) {
    recordLayer(task, subject, "L9", { status: "fail", message });
  }
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
  judgeTest(task, subject, cleanupError, takePreventedNavigations());
}

/** The case and target a test verifies, with the run's quarantine. */
function subjectOf(task: RunnerTestCase): LayerSubject {
  const harness = inject("ufHarness");
  return {
    case: caseOfFile(task.file.filepath, harness),
    target: currentTarget(),
    quarantine: harness.quarantine,
  };
}

/**
 * Leaves the page as the next test expects it, since every test of a file shares it: the mouse
 * in the frame's corner, off every root (a hover changes pixels and `:hover` geometry), no key
 * held, and the focus nowhere, with the frame focused again (a blur leaves the sequential focus
 * where it was, so a later Tab would start there, or leave the frame).
 */
async function resetInput(): Promise<void> {
  await commands.ufResetInput();
  await releaseKeys();
  await userEvent.cleanup();
  const active = document.activeElement;
  if (active instanceof HTMLElement || active instanceof SVGElement) active.blur();
  window.focus();
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
