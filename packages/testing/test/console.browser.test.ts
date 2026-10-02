// The console capture's bookkeeping (L13), without the setup file that drives it: what a test is
// judged on, from when, and against which allowances.
import { beforeAll, describe, expect, it } from "vitest";

import {
  allowConsole,
  beginTestConsole,
  captureExternalConsole,
  capturedConsole,
  describeConsole,
  endTestConsole,
  installConsoleCapture,
  unexpectedConsole,
} from "../src/browser/console.ts";

const BEFORE = "before the test: module evaluation, a beforeAll hook or an earlier teardown";

beforeAll(() => {
  installConsoleCapture();
  endTestConsole();
});

describe("the console capture", () => {
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
