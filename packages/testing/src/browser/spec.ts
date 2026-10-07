// `it` and `test` for the corpus's specs (plan §7.1, ADR-0050): Vitest's, plus `requires`, the
// capabilities a test needs. The setup file skips such a test on a target whose cell for one of
// them is unsupported, and records why on every layer the test would have recorded, so the skip
// shows in the parity matrix. The options that would skip, repeat or reorder a test some other
// way are refused: a known failure is a quarantine entry, and a flaky test is a bug (AGENTS.md).
import type { CapabilityName } from "@unframework/codegen";
import { it as vitestIt } from "vitest";
import type { TestFunction, TestOptions } from "vitest";

import { capabilityCell } from "./capabilities.ts";

/** The options of Vitest's that a corpus test may not set. */
const REFUSED = [
  "skip",
  "only",
  "todo",
  "fails",
  "retry",
  "repeats",
  "concurrent",
  "tags",
] as const;

/** A corpus test's options: Vitest's (a timeout, metadata), and the capabilities it requires. */
export interface SpecOptions extends Omit<TestOptions, (typeof REFUSED)[number]> {
  /**
   * The capabilities the test needs: on a target whose cell for one of them is unsupported, the
   * test is skipped and every browser layer records `requires <capability>: <the reason>`. A
   * test whose expectations depend on client code requires `"interactivity"`.
   */
  requires?: readonly CapabilityName[];
}

/** `it(name, fn)` or `it(name, { requires }, fn)`. */
export interface SpecTest {
  (name: string, fn: TestFunction): void;
  (name: string, options: SpecOptions, fn: TestFunction): void;
}

/** Declares a corpus test, with the capabilities it requires (see {@link SpecOptions}). */
export const it: SpecTest = (
  name: string,
  optionsOrFn: SpecOptions | TestFunction,
  maybeFn?: TestFunction,
): void => {
  const options = typeof optionsOrFn === "function" ? {} : optionsOrFn;
  const fn = typeof optionsOrFn === "function" ? optionsOrFn : maybeFn;
  if (!fn) throw new TypeError(`it("${name}"): a test needs a function.`);
  const refused = REFUSED.filter((key) => Object.hasOwn(options, key));
  if (refused.length) {
    throw new TypeError(
      `it("${name}"): a corpus test does not set ${refused.join(", ")}. A known failure is a quarantine entry, a flaky test is a bug, and a test runs on every target unless a capability it requires is unsupported.`,
    );
  }
  const { requires, meta, ...rest } = options;
  if (requires !== undefined) {
    if (!Array.isArray(requires) || !requires.length) {
      throw new TypeError(`it("${name}"): requires names one or more capabilities.`);
    }
    // An unknown name throws here, when the tests are collected.
    for (const capability of requires) capabilityCell(capability);
  }
  vitestIt(
    name,
    { ...rest, meta: { ...meta, ...(requires ? { ufRequires: [...requires] } : {}) } },
    fn,
  );
};

/** {@link it}, by its other name. */
export const test: SpecTest = it;
