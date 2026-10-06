// Vitest 5 gives `expect.element` the test's remaining time unless the call names a timeout:
// the project's `expect.poll.timeout` never reaches it (`resolveActionTimeout` in
// @vitest/browser 5.0.3). A locator that never matches would then hold its test for the whole
// test timeout (60 s), and a failing L8 cell, or a browser canary, for minutes.
import { expect } from "vitest";
import { server } from "vitest/browser";

/**
 * Gives every `expect.element` call that names no timeout the project's poll timeout. A locator
 * that never matches then fails at that deadline, mostly with the element's own error, which
 * names the locator, but sometimes (53 of the L8 canary's 497 failures) with Vitest's bare
 * "expect.poll() function didn't resolve in time.": `expect.element` gives the poll's timer and
 * `findElement`'s retries one deadline, from the one `timeout` option, and whichever notices it
 * first words the failure. No public option sets them apart, so both messages are L8 evidence
 * (the L8 canary's, ADR-0043); the failure's stack names the spec's assertion either way. A
 * project without a poll timeout cannot bound its assertions, so that throws.
 */
export function boundElementTimeout(): void {
  const timeout = server.config.expect?.poll?.timeout;
  if (timeout === undefined) {
    throw new Error(
      "[uf] The browser project sets no `expect.poll.timeout`: `expect.element` would wait for the whole test timeout.",
    );
  }
  const element = expect.element;
  expect.element = ((subject, options) =>
    element(subject, { timeout, ...options })) as typeof expect.element;
}
