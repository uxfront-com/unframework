// The page host's runner: `describeTargets` and `it`, one spec file per page, in the order Vitest
// 5.0.3 runs them (`vitest-dev/vitest@v5.0.3`, packages/vitest/src/runtime/runner/run.ts). The
// setup's judge reads a test's errors from its afterEach, so the steps stay the same: the before
// hooks and the body, the assertion count, then the after hooks as a stack, all inside the around
// hooks. No retries, repeats or concurrency: the spec rules refuse them.
import { getState, setState } from "@vitest/expect";

import type { HostHooks, HostTestFunction, HostTestOptions } from "../../browser/host.ts";
import { pageConfig, report } from "./config.ts";
import { expect } from "./expect.ts";
import type { PageError, PageFileRecord, PageTestRecord, PageUnhandledRecord } from "./protocol.ts";
import { currentPageTest, setCurrentPageTest } from "./state.ts";
import type { PageFile, PageTest } from "./state.ts";

/** Vitest's text, which L8 turns into its own (`behaviour.ts`). */
const NO_ASSERTIONS = "expected any number of assertion, but got none";

/** What a `skip` throws to end a test from its hook. */
class SkipTest extends Error {
  readonly note: string;

  constructor(note: string) {
    super(`test is skipped; ${note}`);
    this.note = note;
  }
}

interface TestEntry {
  test: PageTest;
  fn: HostTestFunction;
  timeout: number;
}

const entries: TestEntry[] = [];
const suites: string[] = [];
const unhandled: PageUnhandledRecord[] = [];

const beforeAlls: Parameters<HostHooks["beforeAll"]>[0][] = [];
const afterAlls: Parameters<HostHooks["afterAll"]>[0][] = [];
const beforeEachs: Parameters<HostHooks["beforeEach"]>[0][] = [];
const afterEachs: Parameters<HostHooks["afterEach"]>[0][] = [];
const aroundEachs: Parameters<HostHooks["aroundEach"]>[0][] = [];

/** The spec file this page runs, once {@link runSpecFile} has named it. */
let file: PageFile | undefined;

/** The hooks a setup file and a spec register. Each page runs one spec file, so they are its. */
export const hooks: HostHooks = {
  beforeAll: (fn) => void beforeAlls.push(fn),
  afterAll: (fn) => void afterAlls.push(fn),
  beforeEach: (fn) => void beforeEachs.push(fn),
  afterEach: (fn) => void afterEachs.push(fn),
  aroundEach: (fn) => void aroundEachs.push(fn),
};

/** Declares a suite: its tests take its name, as `describeTargets`' do. */
export function describe(name: string, fn: () => void): void {
  suites.push(name);
  try {
    fn();
  } finally {
    suites.pop();
  }
}

/** Declares a test of the spec file being loaded. */
export function it(name: string, options: HostTestOptions, fn: HostTestFunction): void {
  if (!file) throw new Error(`it("${name}"): a test is declared while its spec file loads.`);
  entries.push({
    test: {
      name,
      fullName: [...suites, name].join(" > "),
      suite: { name: suites.at(-1) ?? file.name },
      file,
      meta: { ...options.meta },
    },
    fn,
    timeout: options.timeout ?? pageConfig().testTimeout,
  });
}

/** Records what nothing caught, on the file running, and tells the driver now. */
export function recordUnhandled(
  error: Omit<PageUnhandledRecord, "kind" | "filepath" | "test">,
): void {
  const record: PageUnhandledRecord = {
    kind: "unhandled",
    ...error,
    ...(file ? { filepath: file.filepath } : {}),
    ...(currentPageTest() ? { test: currentPageTest()!.fullName } : {}),
  };
  unhandled.push(record);
  // Not left unhandled, which would bring it back here: a page going away rejects the binding.
  report(record).catch(console.error);
}

/** A test's or a file's result, which a hook may read and the judge rewrites. */
type Failable = { state: string; errors?: PageError[] };

function fail(result: Failable, thrown: unknown): void {
  result.state = "fail";
  for (const one of thrown instanceof AggregateError ? thrown.errors : [thrown]) {
    (result.errors ??= []).push(serializeError(one));
  }
}

/** A thrown value as a runner's result holds it: Vitest's `processError`, for what L8 reads. */
export function serializeError(thrown: unknown): PageError {
  if (typeof thrown !== "object" || thrown === null) return { message: String(thrown) };
  const { name, message, stack } = thrown as Partial<Error>;
  return {
    ...(name === undefined ? {} : { name }),
    message: String(message),
    ...(stack === undefined ? {} : { stack }),
  };
}

/** Rejects when `fn` runs past its time, in Vitest's words, naming the setting that gives it. */
async function withTimeout<T>(
  fn: () => T | Promise<T>,
  timeout: number,
  isHook: boolean,
): Promise<T> {
  const start = Date.now();
  const expired = () => {
    const kind = isHook ? "hook" : "test";
    return new Error(
      `${isHook ? "Hook" : "Test"} timed out in ${timeout}ms.\nIf this is a long-running ${kind}, pass a timeout value as the last argument or configure it globally with "${kind}Timeout".`,
    );
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const result = await Promise.race([
    Promise.resolve().then(fn),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(expired()), timeout);
    }),
  ]).finally(() => clearTimeout(timer));
  // A body that held the page past its time gives the timer no chance to fire.
  if (Date.now() - start > timeout) throw expired();
  return result;
}

/** Starts a test's count of assertions from nothing. */
function resetAssertions(test: PageTest): void {
  setState({ assertionCalls: 0, currentTestName: test.fullName }, expect);
}

/** Vitest's `onAfterTryTask`, for the one way of owing assertions the corpus has. */
function checkAssertions(): void {
  if (pageConfig().requireAssertions && getState(expect).assertionCalls === 0) {
    throw new Error(NO_ASSERTIONS);
  }
}

/** Runs a test, its hooks inside the around hooks, the first registered the outermost. */
async function runTest({ test, fn, timeout }: TestEntry): Promise<void> {
  const result: Failable & { note?: string } = { state: "run" };
  test.result = result;
  setCurrentPageTest(test);
  resetAssertions(test);
  const { hookTimeout } = pageConfig();
  const inner = async (): Promise<void> => {
    try {
      for (const hook of beforeEachs) {
        await withTimeout(
          () =>
            hook(test, (note) => {
              throw new SkipTest(note);
            }),
          hookTimeout,
          true,
        );
      }
      await withTimeout(() => fn({ task: test }), timeout, false);
      checkAssertions();
      if (result.state !== "fail") result.state = "pass";
    } catch (error) {
      if (error instanceof SkipTest) {
        result.state = "skip";
        result.note = error.note;
      } else fail(result, error);
    }
    try {
      for (const hook of afterEachs.toReversed()) {
        await withTimeout(() => hook(test), hookTimeout, true);
      }
    } catch (error) {
      fail(result, error);
    }
    for (const check of test.onFinished?.toReversed() ?? []) {
      try {
        check();
      } catch (error) {
        fail(result, error);
      }
    }
    test.onFinished = undefined;
  };
  const wrapped = aroundEachs.reduceRight<() => Promise<void>>(
    (next, hook) => () => hook(next, test),
    inner,
  );
  await wrapped().catch((error: unknown) => {
    fail(result, error);
  });
  setCurrentPageTest(undefined);
  await reportTest(test);
}

async function reportTest(test: PageTest): Promise<void> {
  const result = test.result as Failable & { note?: string };
  const record: PageTestRecord = {
    kind: "test",
    filepath: test.file.filepath,
    name: test.name,
    fullName: test.fullName,
    state: result.state as PageTestRecord["state"],
    meta: test.meta,
    ...(result.note === undefined ? {} : { note: result.note }),
    ...(result.errors?.length ? { errors: result.errors } : {}),
    ...(test.artifacts ? { artifacts: test.artifacts } : {}),
  };
  await report(record);
}

/**
 * Loads a spec file and runs its tests. A file that won't load, or a `beforeAll` that throws,
 * fails the file: its tests are skipped with no records, as Vitest's are, and the reporter's rule
 * for a skip without a reason reports them (`src/node/reporter.ts`). The result also reaches the
 * driver as the last event.
 */
export async function runSpecFile(options: {
  filepath: string;
  load: () => Promise<unknown>;
}): Promise<PageFileRecord> {
  const current: PageFile = {
    filepath: options.filepath,
    name: options.filepath.slice(options.filepath.lastIndexOf("/") + 1),
    meta: {},
  };
  file = current;
  const result: Failable = { state: "run" };
  try {
    await options.load();
    if (!entries.length) throw new Error(`No test suite found in file ${current.filepath}`);
  } catch (error) {
    fail(result, error);
    return finishFile(current, result);
  }
  const { hookTimeout } = pageConfig();
  let started = true;
  try {
    for (const hook of beforeAlls) await withTimeout(() => hook(current), hookTimeout, true);
  } catch (error) {
    fail(result, error);
    started = false;
    for (const { test } of entries) {
      test.result = { state: "skip" };
      await reportTest(test);
    }
  }
  if (started) {
    for (const entry of entries) await runTest(entry);
  }
  try {
    for (const hook of afterAlls.toReversed()) {
      await withTimeout(() => hook(current), hookTimeout, true);
    }
  } catch (error) {
    fail(result, error);
  }
  const failed = entries.some(({ test }) => test.result?.state === "fail");
  if (result.state !== "fail") result.state = failed ? "fail" : "pass";
  return finishFile(current, result);
}

async function finishFile(current: PageFile, result: Failable): Promise<PageFileRecord> {
  const record: PageFileRecord = {
    kind: "file",
    filepath: current.filepath,
    state: result.state as PageFileRecord["state"],
    meta: current.meta,
    unhandled: [...unhandled],
    ...(result.errors?.length ? { errors: result.errors } : {}),
  };
  current.result = { state: record.state, ...(record.errors ? { errors: record.errors } : {}) };
  await report(record);
  return record;
}
