import { diffLines } from "./diff.ts";

/**
 * The text of a thrown value, for a layer's failure message. Assertion errors on strings get a
 * line diff, because the message is all the parity matrix and the combined error keep.
 */
export function formatError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const assertion = error as Error & { actual?: unknown; expected?: unknown; showDiff?: boolean };
  if (
    assertion.showDiff &&
    typeof assertion.actual === "string" &&
    typeof assertion.expected === "string" &&
    assertion.actual.includes("\n")
  ) {
    return `${error.message}\n${diffLines(assertion.expected, assertion.actual)}`;
  }
  return error.message;
}

/**
 * A thrown or serialised error's message, then each of its causes' messages, outermost first.
 * Vitest wraps an error it cannot attribute to a test (a failed import, a closed browser
 * connection) in its own, so the cause is the part that says what happened.
 */
export function errorMessages(error: unknown): string[] {
  if (typeof error !== "object" || error === null) return [String(error)];
  const messages = [messageOf(error)];
  const seen = new Set<unknown>([error]);
  const first = "cause" in error ? error.cause : undefined;
  for (let cause = first; hasMessage(cause) && !seen.has(cause); cause = cause.cause) {
    seen.add(cause);
    messages.push(messageOf(cause));
  }
  return messages;
}

function hasMessage(value: unknown): value is { message: unknown; cause?: unknown } {
  return typeof value === "object" && value !== null && "message" in value;
}

/** A message as Vitest serialises it, or what `load-failures` has always said for none. */
function messageOf(error: object): string {
  const message = "message" in error ? error.message : undefined;
  return typeof message === "string" ? message : "an error without a message";
}
