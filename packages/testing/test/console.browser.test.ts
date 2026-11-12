// The console capture's bookkeeping (L13), without the setup file that drives it: what a test is
// judged on, from when, and against which allowances.
import { beforeAll, describe, expect, it } from "vitest";

import {
  allowConsole,
  beginTestConsole,
  captureExternalConsole,
  capturedConsole,
  consoleMark,
  beginSpecFileConsole,
  describeConsole,
  endSpecFileConsole,
  endTestConsole,
  excuseConsoleSince,
  installConsoleCapture,
  unexpectedConsole,
  watchConsoleErrors,
} from "../src/browser/console.ts";

const BEFORE = "before the test: module evaluation, a beforeAll hook or an earlier teardown";

beforeAll(() => {
  installConsoleCapture();
  endTestConsole();
});

describe("the console capture", () => {
  it("excuses only what was logged since the mark", () => {
    beginTestConsole();
    console.warn("[unit] before the step");
    const mark = consoleMark();
    console.error("[unit] the step");
    excuseConsoleSince(mark, "the step throws on purpose");
    console.warn("[unit] after the step");
    expect(unexpectedConsole().map((entry) => entry.message)).toEqual([
      "[unit] before the step",
      "[unit] after the step",
    ]);
    endTestConsole();
  });

  it("needs a reason to excuse anything", () => {
    expect(() => excuseConsoleSince(0, " ")).toThrow(/reason/);
  });

  it("hands each logged argument to the watcher until it is removed", () => {
    beginTestConsole();
    const seen: unknown[] = [];
    const unwatch = watchConsoleErrors((value) => seen.push(value));
    const error = new Error("[unit] logged");
    console.error("[unit] prefix", error);
    unwatch();
    console.error("[unit] after", error);
    expect(seen).toEqual(["[unit] prefix", error]);
    endTestConsole();
  });

  it("keeps what was logged outside a test for the next one, marked as logged before it", () => {
    console.warn("[unit] between tests");
    beginTestConsole();
    console.error("[unit] in the test");
    expect(capturedConsole()).toEqual([
      { level: "warn", message: "[unit] between tests", source: "page", beforeTest: true },
      { level: "error", message: "[unit] in the test", source: "page" },
    ]);
    expect(describeConsole(unexpectedConsole())).toBe(
      [
        "2 unexpected console message(s):",
        `  console.warn (${BEFORE}): [unit] between tests`,
        "  console.error: [unit] in the test",
      ].join("\n"),
    );
    endTestConsole();
    expect(capturedConsole()).toEqual([]);
  });

  // Spec files share a page (ADR-0092): what one logs after its last judgement reaches the next.
  it("names the spec file a message came after, until the next file starts", () => {
    endSpecFileConsole("state/counter");
    console.warn("[unit] after the file");
    beginSpecFileConsole();
    console.warn("[unit] in the next file");
    beginTestConsole();
    expect(capturedConsole()).toEqual([
      {
        level: "warn",
        message: "[unit] after the file",
        source: "page",
        afterFile: "state/counter",
        beforeTest: true,
      },
      { level: "warn", message: "[unit] in the next file", source: "page", beforeTest: true },
    ]);
    expect(describeConsole(unexpectedConsole())).toBe(
      [
        "2 unexpected console message(s):",
        `  console.warn (${BEFORE}; after the last test of state/counter, which ran earlier on this page): [unit] after the file`,
        `  console.warn (${BEFORE}): [unit] in the next file`,
      ].join("\n"),
    );
    endTestConsole();
  });

  it("ends a test's allowances when the next test begins", () => {
    beginTestConsole();
    allowConsole(/\[unit\] allowed/, "this test allows it");
    console.warn("[unit] allowed");
    expect(unexpectedConsole()).toEqual([]);
    endTestConsole();
    beginTestConsole();
    console.warn("[unit] allowed");
    expect(unexpectedConsole()).toHaveLength(1);
    endTestConsole();
  });

  it("matches every message against a global or sticky pattern, not every other one", () => {
    beginTestConsole();
    allowConsole(/\[unit\] repeated/g, "global");
    allowConsole(/\[unit\] sticky/y, "sticky");
    for (const message of [
      "[unit] repeated",
      "[unit] repeated",
      "[unit] sticky",
      "[unit] sticky",
    ]) {
      console.warn(message);
    }
    expect(unexpectedConsole()).toEqual([]);
    endTestConsole();
  });

  it("names a message from the adapter's server render, also when it came before the test", () => {
    captureExternalConsole([{ level: "warn", message: "[unit] server" }]);
    beginTestConsole();
    captureExternalConsole([{ level: "error", message: "[unit] server, in the test" }]);
    expect(describeConsole(unexpectedConsole())).toBe(
      [
        "2 unexpected console message(s):",
        `  console.warn (server render; ${BEFORE}): [unit] server`,
        "  console.error (server render): [unit] server, in the test",
      ].join("\n"),
    );
    endTestConsole();
  });
});
