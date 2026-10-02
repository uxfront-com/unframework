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
