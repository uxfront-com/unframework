// An action that failed, told apart from a component that threw (L14, ADR-0078). A
// step's rejection can be the component's throw: React's `act` rethrows it through the action.
// It can also be the action's own failure, like Playwright's `TimeoutError` when the element
// never became actionable, and then the component never threw. `view.user`'s inputs mark their
// own rejections, so `expectThrown` names a failed action instead of mapping its stack as if the
// component had thrown it. Pure, with no browser import, so Node tests it.

/** Set on an error an input of `view.user` rejected with. */
const FAILED_ACTION: unique symbol = Symbol.for("unframework.testing.failedAction");

/** Marks `error` as an action's own failure, and returns it to be rethrown. */
export function markFailedAction(error: unknown): unknown {
  if (error instanceof Error && !isFailedAction(error)) {
    Object.defineProperty(error, FAILED_ACTION, { value: true });
  }
  return error;
}

/** Whether `error` is an action's own failure, as {@link markFailedAction} marked it. */
export function isFailedAction(error: unknown): error is Error {
  return error instanceof Error && Object.hasOwn(error, FAILED_ACTION);
}

/** What `expectThrown` captured while its step ran. */
export interface ThrownCapture {
  /** The first `Error` the page raised, or the step rejected with when it was not an action's. */
  thrown?: Error;
  /** The first `Error` a framework only logged. */
  logged?: Error;
  /** The first failure of an action of the step, as {@link isFailedAction} tells it. */
  failedAction?: Error;
}

/** The error L14 reads, or why there is none. */
export type ThrownChoice =
  /** The component's throw: L14 maps its stack. */
  | { kind: "thrown"; error: Error }
  /** No throw, because the step's action failed first: L14 fails with `message`. */
  | { kind: "failed-action"; error: Error; message: string }
  /** No throw and no failed action. */
  | { kind: "none" };

/** The start of L14's message for a step whose action failed. */
export const FAILED_ACTION_MESSAGE = "The step's action failed, so the component never threw:";

/**
 * Chooses the error L14 reads. A throw the page saw wins, and then one a framework logged, as
 * before. Only with neither does a failed action count, since an action can still time out after
 * the component threw.
 */
export function chooseThrown(capture: ThrownCapture): ThrownChoice {
  const error = capture.thrown ?? capture.logged;
  if (error) return { kind: "thrown", error };
  if (capture.failedAction) {
    return {
      kind: "failed-action",
      error: capture.failedAction,
      message: `${FAILED_ACTION_MESSAGE} ${capture.failedAction.message}`,
    };
  }
  return { kind: "none" };
}
