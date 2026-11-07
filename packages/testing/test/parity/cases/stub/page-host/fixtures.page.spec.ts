// The fixtures `test/page-host.test.ts` compares with Vitest's answers, on the page host.
import { expect, it } from "vitest";

import "../../../../../src/setup.ts";
import { host } from "../../../../../src/browser/host.ts";
import type { Locator } from "../../../../../src/browser/host.ts";
import { describeTargets } from "../../../../../src/index.ts";
import {
  callLocators,
  resolveLocators,
  runActions,
  runActionTimeouts,
  runClearTimeout,
  runMatchers,
  serializeLocators,
} from "../../../../page-host/fixtures.ts";
import type { FixtureLocator, FixtureRunner } from "../../../../page-host/fixtures.ts";
import "../../../dom-target.ts";

const asHost = (target: FixtureLocator) => target as unknown as Locator;

const runner: FixtureRunner = {
  page: host().page as unknown as FixtureRunner["page"],
  element: (subject, options) =>
    expect.element(subject as never, options) as unknown as Record<string, unknown>,
  expect: (actual) => expect(actual) as unknown as Record<string, unknown>,
  stringMatching: (pattern) => expect.stringMatching(pattern),
  hover: async (target) => {
    await host().commands.ufInput({ kind: "move", locator: target.serialize(), check: "hover" });
  },
  unhover: (target) => host().userEvent.unhover(asHost(target)),
  fill: (target, text) => host().userEvent.fill(asHost(target), text),
  clear: (target) => host().userEvent.clear(asHost(target)),
  selectOptions: (target, values) => host().userEvent.selectOptions(asHost(target), values),
};

/** Bounds what the context waits for, around the actions that are to time out. */
function setActionTimeout(ms: number): Promise<void> {
  return (
    host().commands as unknown as { setActionTimeout(ms: number): Promise<void> }
  ).setActionTimeout(ms);
}

/** What the page sends Node when the tests are done, through the test's own metadata. */
function record(task: { meta: object }, results: object): void {
  (task.meta as { results?: object }).results = results;
}

describeTargets("stub/page-host", () => {
  it("locators", ({ task }) => {
    record(task, serializeLocators(runner));
    expect(1).toBe(1);
  });

  it("matchers", async ({ task }) => {
    record(task, await runMatchers(runner));
    expect(1).toBe(1);
  });

  it("resolved", ({ task }) => {
    record(task, resolveLocators(runner));
    expect(1).toBe(1);
  });

  it("called", async ({ task }) => {
    record(task, await callLocators(runner));
    expect(1).toBe(1);
  });

  it("actions", async ({ task }) => {
    record(task, await runActions(runner));
    expect(1).toBe(1);
  });

  it("action timeouts", async ({ task }) => {
    await setActionTimeout(300);
    record(task, await runActionTimeouts(runner));
    await setActionTimeout(5_000);
    expect(1).toBe(1);
  });

  it("clear timeout", async ({ task }) => {
    await setActionTimeout(300);
    record(task, await runClearTimeout(runner));
    await setActionTimeout(5_000);
    expect(1).toBe(1);
  });
});
