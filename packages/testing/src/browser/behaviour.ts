// L8, the spec's own behaviour (plan §7.2, ADR-0043): what a test asserts about the component it
// mounted, beyond the shared expectations. `expectParity` records L7, L10 and L11 and resolves,
// so the assertions after it always run; the setup file's afterEach then records L8 from the
// test's own errors and fails the test with every failed layer, in one error.
import { expect, TestRunner } from "vitest";
import type { RunnerTestCase } from "vitest";

import { formatError } from "../errors.ts";
import { LAYERS, LayerFailure, recordLayer } from "../layers.ts";
import type { LayerName, LayerSubject } from "../layers.ts";

/** The error Vitest records for a test without assertions under `expect.requireAssertions`. */
const NO_ASSERTIONS = "expected any number of assertion, but got none";

/** The layer failures each test consumed with `expectLayerFailure`. */
const consumed = new WeakMap<object, Set<LayerName>>();

/** A test's error as the afterEach sees it: serialised by Vitest. */
type TestError = NonNullable<NonNullable<RunnerTestCase["result"]>["errors"]>[number];

/**
 * For the testing package's own tests only: asserts that `layer` failed in the current test with
 * a message matching `pattern`, and consumes that failure, so the afterEach does not fail the
 * test with it. Returns the message. It is not part of the public API: a corpus spec never
 * expects a layer to fail (a known failure is a quarantine entry).
 */
export function expectLayerFailure(layer: LayerName, pattern: RegExp): string {
  const test = TestRunner.getCurrentTest<RunnerTestCase | undefined>();
  if (!test) throw new Error("expectLayerFailure must be called inside a test.");
  const outcome = test.meta.uf?.layers[layer];
  expect(outcome, `${layer}'s recorded outcome`).toEqual({
    status: "fail",
    message: expect.stringMatching(new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, ""))),
  });
  if (outcome?.status !== "fail") throw new Error(`${layer} did not fail.`);
  const layers = consumed.get(test) ?? new Set<LayerName>();
  layers.add(layer);
  consumed.set(test, layers);
  return outcome.message;
}

/**
 * Records L8 and decides how the test ends; the setup file's afterEach calls it last, after
 * L13. L8 fails with the test's own errors: what its body, its hooks and Vitest's assertion
 * count threw, but not a `LayerFailure` (a layer's own record), plus a failed unmount.
 *
 * - When L8 is quarantined, the test's own errors are removed from its result, which passes if
 *   no other layer failed (Vitest recorded them before the afterEach hooks ran).
 * - Then it throws one `LayerFailure` with every failed layer but L8, whose errors Vitest
 *   reports already (a failed unmount, which it never saw, is added).
 */
export function judgeTest(
  task: RunnerTestCase,
  subject: LayerSubject,
  unmountError?: unknown,
): void {
  const errors = task.result?.errors ?? [];
  const own = errors.filter((error) => error.name !== "LayerFailure");
  const messages = own.map(describeTestError);
  const unmounted =
    unmountError === undefined ? [] : [`Unmounting failed: ${formatError(unmountError)}`];
  const recorded = recordLayer(
    task,
    subject,
    "L8",
    messages.length || unmounted.length
      ? { status: "fail", message: [...messages, ...unmounted].join("\n") }
      : { status: "pass" },
  );

  const skipped = consumed.get(task) ?? new Set<LayerName>();
  const layers = task.meta.uf?.layers ?? {};
  const failures = LAYERS.flatMap((layer) => {
    const outcome = layers[layer];
    return layer !== "L8" && !skipped.has(layer) && outcome?.status === "fail"
      ? [`${layer}: ${outcome.message}`]
      : [];
  });
  if (recorded.status === "quarantined" && task.result) {
    const kept = errors.filter((error) => !own.includes(error));
    task.result.errors = kept.length ? kept : undefined;
    if (!kept.length && !failures.length) task.result.state = "pass";
  } else if (recorded.status === "fail" && unmounted.length) {
    failures.push(...unmounted.map((message) => `L8: ${message}`));
  }
  if (failures.length) throw new LayerFailure(subject, failures);
}

/** Terminal colours, which Vitest's element errors carry. */
// oxlint-disable-next-line no-control-regex -- the escape character is what it matches
const ANSI_COLOUR = /\u001b\[[0-9;]*m/g;

/** The page's HTML that Vitest prints after an element error: L7 records the DOM already. */
const PAGE_HTML = /\n+HTML:\n[\s\S]*$/;

/**
 * One error of the test, for the L8 record: its name and message, as plain text, without the
 * page's HTML that an element error appends (its ARIA tree stays, which says what was there).
 */
function describeTestError(error: TestError): string {
  const message = error.message.replace(ANSI_COLOUR, "");
  if (message === NO_ASSERTIONS) {
    return "The test asserted nothing: every test asserts at least one fact about what it rendered (expect.requireAssertions).";
  }
  const name = error.name ?? "Error";
  return `${name}: ${name === "VitestBrowserElementError" ? message.replace(PAGE_HTML, "") : message}`;
}
