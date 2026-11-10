// L14's thrown errors (plan §7.2, ADR-0078): the step a case scripts to make its component throw.
// It runs the same on every target. What each framework does after a throw differs (React
// unmounts the root, Vue leaves it, Qwik logs and rethrows in a task of its own), so nothing after
// the throw is compared: the first `Error` is captured, whichever way it reaches the page, and the
// browser project's Vite server maps its stack (`ufMapStack`).
import { expect, inject, TestRunner } from "vitest";
import type { RunnerTestCase } from "vitest";
import { commands } from "vitest/browser";

import "../commands.ts";
import { caseOfFile } from "../harness.ts";
import { recordLayer } from "../layers.ts";
import { consoleMark, excuseConsoleSince, watchConsoleErrors } from "./console.ts";
import { currentTarget } from "./target.ts";

/** Why the messages of the throwing step are excused from L13: the step throws on purpose. */
const EXCUSE = "the step throws on purpose, and each framework reports that in its own words";

/** The rounds of waiting for an error a framework rethrows in a task of its own. */
const SETTLE_ROUNDS = 3;

/** What the wrapper needs from its view. */
export interface ThrownStepHost {
  /** Settles the view; a throw may have left it in any state, so this may fail too. */
  settle(): Promise<void>;
  /** Forgets the steps the trace recorded since `mark`. */
  forgetSteps(mark: number): void;
  /** How many steps the trace holds now. */
  stepMark(): number;
}

/**
 * Runs `step`, which must make the component throw, and records L14 from the first `Error` it
 * raised. Vitest treats a window `error` as a failure of the run only while no page listener is
 * registered, so these listeners also keep the deliberate throw from failing it.
 */
export async function expectThrown(host: ThrownStepHost, step: () => Promise<void>): Promise<void> {
  const test = TestRunner.getCurrentTest<RunnerTestCase | undefined>();
  if (!test) throw new Error("expectThrown must be called inside a test.");
  const harness = inject("ufHarness");
  const subject = {
    case: caseOfFile(test.file.filepath, harness),
    target: currentTarget(),
    quarantine: harness.quarantine,
  };

  // A thrown error comes first: Vitest logs a window error as a new Error of its own, with a stack
  // of its own, before any listener here hears it. The console is for a framework that only logs.
  let thrown: Error | undefined;
  let logged: Error | undefined;
  const take = (value: unknown) => {
    if (value instanceof Error) thrown ??= value;
  };
  const onError = (event: ErrorEvent) => take(event.error);
  const onRejection = (event: PromiseRejectionEvent) => take(event.reason);
  const unwatch = watchConsoleErrors((value) => {
    if (value instanceof Error) logged ??= value;
  });
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  const console = consoleMark();
  const steps = host.stepMark();
  try {
    // A framework's scheduler may rethrow through the action (React's `act`).
    await step().catch(take);
    for (let round = 0; round < SETTLE_ROUNDS; round += 1) {
      await host.settle().catch(take);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  } finally {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    unwatch();
  }
  excuseConsoleSince(console, EXCUSE);
  host.forgetSteps(steps);

  const first = thrown ?? logged;
  const failure = await problem(subject.case, first);
  recordLayer(
    test,
    subject,
    "L14",
    failure ? { status: "fail", message: failure } : { status: "pass" },
  );
  // Counted by `requireAssertions`: this wrapper is what the test verifies.
  expect(first).toBeInstanceOf(Error);
}

/** What is wrong with the captured error's mapped stack, or nothing. */
async function problem(caseId: string, error: Error | undefined): Promise<string | undefined> {
  if (!error) return "The step threw no Error.";
  const { message } = await commands.ufMapStack({ case: caseId, stack: error.stack ?? "" });
  return message;
}
