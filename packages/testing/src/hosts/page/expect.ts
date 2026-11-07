// The page host's `expect`: `@vitest/expect` with the plugins Vitest 5.0.3 uses that the corpus
// needs, and `expect.element` over the ported matchers. An assertion's count, verdict and message
// stay Vitest's, because L8 records them. Nothing else of Vitest's `expect` is here: the corpus and
// the runtime call `expect`, `expect.element` and `expect.stringMatching`.
//
// Ported from Vitest 5.0.3 (`vitest-dev/vitest@v5.0.3`, packages/vitest/src/integrations/chai and
// packages/browser/src/client/tester/expect-element.ts). MIT License, Copyright (c) 2021-Present
// VoidZero Inc. and Vitest contributors.
import "./storybook-expect.ts";
import {
  ASYMMETRIC_MATCHERS_OBJECT,
  chai,
  getState,
  GLOBAL_EXPECT,
  JestAsymmetricMatchers,
  JestChaiExpect,
  JestExtend,
  setState,
} from "@vitest/expect";
import type { Assertion, ExpectStatic, MatcherState } from "@vitest/expect";
import { getType } from "@vitest/utils/helpers";

import { pageConfig } from "./config.ts";
import { LOCATOR_MARK } from "./locators.ts";
import type { PageLocator } from "./locators.ts";
import { matchers } from "./matchers/index.ts";
import { currentPageTest } from "./state.ts";

chai.use(JestExtend);
chai.use(JestChaiExpect);
chai.use(JestAsymmetricMatchers);

/** How often `expect.poll` tries again, Vitest's default. */
const POLL_INTERVAL = 50;

/** `expect`, with the one way of waiting the corpus uses. */
export type PageExpect = ExpectStatic & { element: typeof element };

/** The `expect` of this page. */
export const expect: PageExpect = createExpect();

function createExpect(): PageExpect {
  const expect = ((value: unknown, message?: string): Assertion => {
    const { assertionCalls } = getState(expect);
    setState({ assertionCalls: assertionCalls + 1 }, expect);
    const assertion = chai.expect(value, message) as unknown as Assertion & {
      withTest(test: object): Assertion;
    };
    const test = currentPageTest();
    return test ? assertion.withTest(test) : assertion;
  }) as PageExpect;
  Object.assign(expect, chai.expect);
  Object.assign(
    expect,
    (globalThis as unknown as Record<symbol, object>)[ASYMMETRIC_MATCHERS_OBJECT],
  );
  expect.getState = () => getState<MatcherState>(expect);
  expect.setState = (state) => setState(state as Partial<MatcherState>, expect);
  setState<MatcherState>(
    {
      assertionCalls: 0,
      isExpectingAssertions: false,
      isExpectingAssertionsError: null,
      expectedAssertionsNumber: null,
      expectedAssertionsNumberErrorGen: null,
    },
    expect,
  );
  // @ts-expect-error chai's own `extend`, which the plugin adds and its types leave out.
  expect.extend = (added) => chai.expect.extend(expect, added);
  expect.extend(matchers);
  expect.element = element;
  Object.defineProperty(globalThis, GLOBAL_EXPECT, {
    value: expect,
    writable: true,
    configurable: true,
  });
  return expect;
}

/** Vitest's `withContext`, which its assertion types leave out. */
type ChaiContext = Assertion & { withContext(context: object): Assertion };

/** What `poll` takes. */
interface PollOptions {
  timeout?: number;
  interval?: number;
  message?: string;
}

/**
 * Vitest's `expect.poll`, which `expect.element` waits with. It tries again on real timers and
 * leaves the fake clock alone, where Vitest's advances its fake timers by the interval on each
 * try: a view's clock moves only through `tick` (ADR-0050), so an interval never fires outside
 * the step that names it.
 */
function poll(fn: (this: object) => unknown, options: PollOptions = {}): Record<string, unknown> {
  const { interval = POLL_INTERVAL, timeout = pageConfig().pollTimeout, message } = options;
  const assertion = (expect as unknown as (value: unknown, message?: string) => ChaiContext)(
    null,
    message,
  ).withContext({ poll: true });
  const bound = fn.bind(assertion);
  const test = chai.util.flag(assertion, "vitest-test") as
    | ReturnType<typeof currentPageTest>
    | undefined;
  if (!test) throw new Error("expect.poll() must be called inside a test");
  const proxy: unknown = new Proxy(assertion as object, {
    get(target, key, receiver) {
      const matcher = Reflect.get(target, key, receiver) as unknown;
      if (typeof matcher !== "function") {
        return matcher instanceof chai.Assertion ? proxy : matcher;
      }
      if (key === "assert") return matcher;
      return function (...args: unknown[]) {
        const source = new Error("STACK_TRACE_ERROR");
        const run = async (): Promise<unknown> => {
          chai.util.flag(assertion, "_name", key);
          chai.util.flag(assertion, "error", source);
          let timer: ReturnType<typeof setTimeout> | undefined;
          const expired = new Promise<void>((resolve) => {
            timer = setTimeout(resolve, timeout);
          });
          let lastError: unknown;
          try {
            while (true) {
              try {
                const value = await raceWith(
                  Promise.resolve().then(() => bound()),
                  expired,
                );
                if (!value.ok) {
                  lastError ??= new Error("expect.poll() function didn't resolve in time.");
                  break;
                }
                chai.util.flag(assertion, "object", value.value);
                const verdict = await raceWith(
                  Promise.resolve().then(() =>
                    (matcher as (...values: unknown[]) => unknown).apply(assertion, args),
                  ),
                  expired,
                );
                if (!verdict.ok) {
                  lastError ??= new Error("expect.poll() assertion didn't resolve in time.");
                  break;
                }
                return verdict.value;
              } catch (error) {
                lastError = error;
                const waited = await raceWith(
                  new Promise((resolve) => setTimeout(resolve, interval)),
                  expired,
                );
                if (!waited.ok) break;
              }
            }
          } finally {
            clearTimeout(timer);
          }
          if (lastError) throw withSourceStack(lastError, source);
          return undefined;
        };
        let awaited = false;
        (test.onFinished ??= []).push(() => {
          if (awaited) return;
          const negated = chai.util.flag(assertion, "negate") ? "not." : "";
          const name = chai.util.flag(assertion, "_poll.element")
            ? "element(locator)"
            : "poll(assertion)";
          const call = `expect.${name}.${negated}${String(key)}()`;
          throw withSourceStack(
            new Error(
              `${call} was not awaited. This assertion is asynchronous and must be awaited; otherwise, it is not executed to avoid unhandled rejections:\n\nawait ${call}\n`,
            ),
            source,
          );
        });
        let result: Promise<unknown> | undefined;
        const start = () => (result ??= run());
        // As Vitest's: it starts when awaited, so an assertion nobody awaited can fail its test
        // rather than reject unhandled.
        return {
          // oxlint-disable-next-line unicorn/no-thenable
          then(onFulfilled: never, onRejected: never) {
            awaited = true;
            return start().then(onFulfilled, onRejected);
          },
          catch(onRejected: never) {
            awaited = true;
            return start().catch(onRejected);
          },
          finally(onFinally: never) {
            awaited = true;
            return start().finally(onFinally);
          },
          [Symbol.toStringTag]: "Promise",
        };
      };
    },
  });
  return proxy as Record<string, unknown>;
}

/** `expect.element`: polls a locator for its element, then asserts on that. */
function element(
  subject: HTMLElement | SVGElement | PageLocator | null,
  options?: { timeout?: number; interval?: number; message?: string },
): unknown {
  if (
    subject !== null &&
    subject !== undefined &&
    !(subject instanceof HTMLElement) &&
    !(subject instanceof SVGElement) &&
    !(LOCATOR_MARK in subject)
  ) {
    throw new Error(
      `Invalid element or locator: ${String(subject)}. Expected an instance of HTMLElement, SVGElement or Locator, received ${getType(subject)}`,
    );
  }
  const deadline = options?.timeout ? Date.now() + options.timeout : undefined;
  const assertion = poll(async function (this: object) {
    if (subject instanceof Element || subject === null || subject === undefined) return subject;
    const isNot = chai.util.flag(this, "negate") as boolean;
    const name = chai.util.flag(this, "_name") as string;
    if (isNot && name === "toBeInTheDocument") return subject.query();
    if (name === "toHaveLength") return subject.elements();
    return subject.findElement({
      ...options,
      ...(deadline === undefined ? {} : { timeout: Math.max(deadline - Date.now(), 0) }),
    });
  }, options);
  chai.util.flag(assertion, "_poll.element", true);
  return assertion;
}

function withSourceStack(error: unknown, source: Error): unknown {
  if (error instanceof Error) {
    error.cause ??= new Error("Matcher did not succeed in time.");
    if (source.stack !== undefined) {
      error.stack = source.stack.replace(source.message, error.message);
    }
  }
  return error;
}

function raceWith<A>(
  promise: Promise<A>,
  other: Promise<void>,
): Promise<{ ok: true; value: A } | { ok: false }> {
  return Promise.race([
    promise.then((value) => ({ ok: true as const, value })),
    other.then(() => ({ ok: false as const })),
  ]);
}
