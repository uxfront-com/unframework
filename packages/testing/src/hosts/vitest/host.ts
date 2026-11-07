// The Vitest host: the host port (`../../browser/host.ts`) over Vitest's browser mode. At run time,
// the only module of the spec runtime that imports Vitest. `./setup.ts` installs it.
import {
  afterAll,
  afterEach,
  aroundEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  inject,
  it,
  recordArtifact,
  TestRunner,
  vi,
} from "vitest";
import type { RunnerTestCase, TestFunction, TestOptions } from "vitest";
import { commands, page, server, userEvent } from "vitest/browser";

import type { Host, HostExpect } from "../../browser/host.ts";

/** The host a project on Vitest's browser mode runs its specs with. */
export const vitestHost: Host = {
  commands,
  page,
  expect: expect as HostExpect,
  userEvent: {
    unhover: (target) => userEvent.unhover(target),
    fill: (target, text) => userEvent.fill(target, text),
    clear: (target) => userEvent.clear(target),
    selectOptions: (target, values) => userEvent.selectOptions(target, values),
    cleanup: () => userEvent.cleanup(),
  },
  clock: {
    install() {
      // A native interval started before the clock (Vite's client pings its server) and cleared
      // while it runs reaches the native `clearInterval`, rather than a warning L13 would catch.
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"], shouldClearNativeTimers: true });
    },
    restore() {
      vi.useRealTimers();
    },
  },
  hooks: {
    // Vitest reads a hook's fixtures from its first parameter, which must be a destructuring
    // pattern even when, as here, the hook only needs the suite (the second).
    beforeAll(fn) {
      // oxlint-disable-next-line no-empty-pattern
      beforeAll(async ({}, suite) => {
        await fn(suite.file);
      });
    },
    afterAll(fn) {
      // oxlint-disable-next-line no-empty-pattern
      afterAll(async ({}, suite) => {
        await fn(suite.file);
      });
    },
    beforeEach(fn) {
      beforeEach(({ task, skip }) => {
        fn(task, skip);
      });
    },
    afterEach(fn) {
      afterEach(async ({ task }) => {
        await fn(task);
      });
    },
    aroundEach(fn) {
      // Its first parameter is the test's, the second its fixtures, which Vitest needs as a
      // destructuring pattern.
      aroundEach(async (runTest, { task }) => {
        await fn(runTest, task);
      });
    },
  },
  currentTest: () => TestRunner.getCurrentTest<RunnerTestCase | undefined>(),
  inject,
  // Vitest 5 gives `expect.element` the test's remaining time unless the call names a timeout:
  // the project's `expect.poll.timeout` never reaches it (`resolveActionTimeout` in
  // @vitest/browser 5.0.3).
  pollTimeout: () => server.config.expect?.poll?.timeout,
  recordVisualFailure: (test, { message, attachments }) =>
    // The artifact shape toMatchScreenshot uses, so reporters and the UI show the images.
    recordArtifact(test as RunnerTestCase, {
      type: "internal:toMatchScreenshot",
      kind: "visual-regression",
      message,
      attachments,
    }).then(() => undefined),
  describe: (name, fn) => {
    describe(name, fn);
  },
  it: (name, options, fn) => {
    it(name, options as TestOptions, fn as TestFunction);
  },
};
