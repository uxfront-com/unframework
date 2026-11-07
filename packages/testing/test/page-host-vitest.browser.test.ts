// What the page host is held to: Vitest's own verdicts, messages and strings on the page host's
// fixtures. `./page-host.test.ts` compares the page host with the same file, so a Vitest bump that
// moves an answer fails here, and a port that drifts fails there. `VITE_UF_RECORD=1` writes the file.
import { expect, it } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import type { Locator } from "vitest/browser";

import {
  callLocators,
  resolveLocators,
  runActions,
  runActionTimeouts,
  runMatchers,
  serializeLocators,
} from "./page-host/fixtures.ts";
import type { FixtureLocator, FixtureRunner } from "./page-host/fixtures.ts";
import recorded from "./page-host/vitest-results.json" with { type: "json" };

/** Short enough to keep this file quick; the page host's context sets the same. */
const ACTION_TIMEOUT = 300;

const asVitest = (target: FixtureLocator) => target as unknown as Locator;

const runner: FixtureRunner = {
  page: page as unknown as FixtureRunner["page"],
  element: (subject, options) =>
    expect.element(subject as never, options) as unknown as Record<string, unknown>,
  expect: (actual) => expect(actual) as unknown as Record<string, unknown>,
  hover: (target) => userEvent.hover(asVitest(target)),
  unhover: (target) => userEvent.unhover(asVitest(target)),
  fill: (target, text) => userEvent.fill(asVitest(target), text, { timeout: ACTION_TIMEOUT }),
  clear: (target) => userEvent.clear(asVitest(target), { timeout: ACTION_TIMEOUT }),
  selectOptions: (target, values) =>
    userEvent.selectOptions(asVitest(target), values, { timeout: ACTION_TIMEOUT }),
};

it("gives the verdicts, the messages and the strings the page host is compared with", async () => {
  const results = {
    matchers: await runMatchers(runner),
    locators: serializeLocators(runner),
    resolved: resolveLocators(runner),
    called: await callLocators(runner),
    actions: await runActions(runner),
    actionTimeouts: await runActionTimeouts(runner),
  };
  if (import.meta.env["VITE_UF_RECORD"]) {
    await commands.writeFile(
      "./test/page-host/vitest-results.json",
      `${JSON.stringify(results, null, 2)}\n`,
    );
    return;
  }
  expect(results).toEqual(recorded);
}, 60_000);
