// The setup file every browser project loads first (plan §7.3). It runs again for every spec
// file, and spec files may share a page (ADR-0092), so what it installs on the page installs once:
// - determinism: the case's colour scheme and the startup assertions, for every spec file, and
//   the bundled font and the motion and caret reset, once per page;
// - console capture from the moment this file loads, recorded as L13 for every test of a case,
//   then failed on; a message logged outside a test is judged with the next test, and one
//   logged after the last test is recorded on the file and fails it;
// - capabilities: a test that requires one its target does not support is skipped before it
//   runs, and every layer it would have recorded says why (ADR-0050); so is every test of a
//   case the target has no output for, with the case's expected errors; a test of a case the
//   target cannot compile yet runs against a stand-in, and every browser layer fails with that
//   cause (ADR-0068);
// - navigation: a form submission or a link the component does not prevent is prevented, and
//   fails the test, rather than taking the whole spec file's frame away;
// - cleanup: whatever a test mounted is unmounted inside the capture window, so unmount warnings
//   count too; then a view's clock gives the page its real intervals back, and the mouse, the
//   keys and the focus are reset for the next test;
// - traces: a step of a view's trace that no `expectParity` compared fails L9;
// - behaviour: the test's own errors (its assertions, its hooks, a test without assertions, a
//   failed unmount) recorded as L8, then one error with every failed layer (ADR-0043);
// - bounds: `expect.element` waits the project's poll timeout, not the whole test's;
// - matchers: `toHaveNoAxeViolations` and `toHaveAriaTree`, for the specs' own assertions
//   (ADR-0085);
// - finished files: once a spec file's tests and afterAll hooks have run, the project says so,
//   so a follower can tell a reference that never finished the case from one that captured no
//   such scenario (ADR-0091).
import { afterAll, afterEach, aroundAll, aroundEach, beforeAll, beforeEach, inject } from "vitest";
import type { RunnerTestCase } from "vitest";
import { commands, userEvent } from "vitest/browser";

import "./commands.ts";
import { judgeTest } from "./browser/behaviour.ts";
import { noOutputReason, requiredSkip, standInCause } from "./browser/capabilities.ts";
import { restoreClock } from "./browser/clock.ts";
import {
  beginSpecFileConsole,
  beginTestConsole,
  describeConsole,
  endSpecFileConsole,
  endTestConsole,
  installConsoleCapture,
  unexpectedConsole,
} from "./browser/console.ts";
import { prepareSpecFile } from "./browser/determinism.ts";
import { boundElementTimeout } from "./browser/element-timeout.ts";
import { isHydrateProject } from "./browser/hydrate.ts";
import { installMatchers } from "./browser/matchers.ts";
import { installNavigationGuard, takePreventedNavigations } from "./browser/navigation.ts";
import { currentTarget } from "./browser/target.ts";
import { closeTraces } from "./browser/trace.ts";
import { releaseKeys } from "./browser/user.ts";
import { cleanup } from "./browser/view.ts";
import { caseOfFile } from "./harness.ts";
import type { ColorScheme } from "./harness.ts";
import { BROWSER_LAYERS, recordEveryLayerAs, recordLayer, recordStandIn } from "./layers.ts";
import type { LayerSubject } from "./layers.ts";

/** A hydrate project (L12, ADR-0095): every check a spec runs is recorded as L12. */
const hydrating = isHydrateProject();
if (hydrating) recordEveryLayerAs("L12");

installConsoleCapture();
beginSpecFileConsole();
boundElementTimeout();
installMatchers();
installNavigationGuard();

// Around the whole file, so it reports the file after every afterAll hook, even one that threw:
// Vitest records an afterAll error on the file and resolves `runSuite`. The command resolves
// before the file ends, so before a later `sequence.groupOrder` group starts. A file whose page
// died never gets here. The second parameter is the file's fixtures, a destructuring pattern.
// oxlint-disable-next-line no-empty-pattern
aroundAll(async (runSuite, {}, suite) => {
  await runSuite();
  // A hydrate project captures no pixels, so no follower waits on it.
  if (hydrating) return;
  await commands.ufSpecFinished({ case: caseOfFile(suite.file.filepath, inject("ufHarness")) });
});

// The first parameter is the file's fixtures, a destructuring pattern (see the afterAll below).
// oxlint-disable-next-line no-empty-pattern
beforeAll(async ({}, suite) => {
  await prepareSpecFile(await emulateColorScheme(suite.file.filepath));
});

/**
 * Emulates the colour scheme the spec file's case opts into (`case.json`'s `colorScheme`, ADR-0061),
 * `light` by default, before anything mounts, and returns it for the startup check.
 */
async function emulateColorScheme(file: string): Promise<ColorScheme> {
  const harness = inject("ufHarness");
  const scheme = harness.cases[caseOfFile(file, harness)]?.colorScheme ?? "light";
  await commands.ufColorScheme(scheme);
  return scheme;
}

beforeEach(({ task, skip }) => {
  beginTestConsole();
  // A trace a test before this one left behind is that test's, judged already.
  closeTraces();
  const requires = task.meta.ufRequires;
  const subject = subjectOf(task);
  // A case the target has no output for has a stand-in for its component, which renders
  // nothing: each of its tests is skipped there, whatever it requires, with the errors the case
  // expects.
  // A hydrate project skips every test where the target does not hydrate, whatever else would
  // skip it there, so every L12 cell of such a target says why (ADR-0095).
  const reason =
    (hydrating ? requiredSkip(["hydration"]) : undefined) ??
    noOutputReason(subject.case) ??
    (requires ? requiredSkip(requires) : undefined);
  if (reason === undefined) {
    // A case the target cannot compile yet has a stand-in for its component too, which throws
    // when the spec mounts it, before `expectParity` records L7, L9, L10 or L11: every browser
    // layer fails here with the stand-in's cause, the test still runs, and its quarantine
    // entries hold only while it fails (ADR-0068).
    const cause = standInCause(subject.case);
    if (cause !== undefined) recordStandIn(task, subject, cause);
    return;
  }
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
  const file = suite.file;
  const harness = inject("ufHarness");
  const caseId = caseOfFile(file.filepath, harness);
  // What the page logs from here on, before the next spec file that shares it starts, is judged
  // with that file's first test, which names this case (ADR-0092).
  endSpecFileConsole(caseId);
  if (!late.length) return;
  // The last test has recorded L13 already; the file's own record reaches the parity reporter
  // with the file's result, and the quarantine applies to it as to any record.
  const recorded = recordLayer(
    file,
    {
      case: caseId,
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
