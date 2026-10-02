// L13: the setup records console hygiene for every test of a case and fails the test on any
// warning or error that is not allowlisted, from the page or from the adapter's server render.
import { expect, it, onTestFinished } from "vitest";

import "../../../../../src/setup.ts";
import { allowConsole, capturedConsole, describeTargets, mount } from "../../../../../src/index.ts";
import "../../../dom-target.ts";

describeTargets("stub/console", () => {
  it("records L13 as passing when nothing is logged", async ({ task }) => {
    onTestFinished(() => {
      expect(task.meta.uf).toEqual({
        case: "stub/console",
        target: "dom",
        layers: { L13: { status: "pass" } },
      });
    });
    await mount({ html: "<p>Quiet</p>" });
  });

  it.fails("fails the test on an unexpected console.warn", () => {
    console.warn("[fixture] an unexpected warning");
  });

  it.fails("fails the test on an unexpected console.error with printf arguments", () => {
    console.error("[fixture] %s went wrong", "something");
  });

  it.fails("fails the test on a message from the adapter's server render", async () => {
    await mount({
      html: "<p>Rendered</p>",
      console: [{ level: "warn", message: "[fixture] server" }],
    });
  });

  it.fails("fails the test whose unmount leaves a warning for later", async () => {
    await mount({ html: "<p>Rendered</p>", lateWarning: "[fixture] after the unmount" });
  });

  it("recorded L13 as failed, with the messages, for the tests above", ({ task }) => {
    const l13 = (name: string) =>
      task.suite?.tasks.find((sibling) => sibling.name === name)?.meta.uf?.layers.L13;
    expect(l13("fails the test on an unexpected console.warn")).toEqual({
      status: "fail",
      message: "1 unexpected console message(s):\n  console.warn: [fixture] an unexpected warning",
    });
    expect(l13("fails the test on an unexpected console.error with printf arguments")).toEqual({
      status: "fail",
      message: "1 unexpected console message(s):\n  console.error: [fixture] something went wrong",
    });
    expect(l13("fails the test on a message from the adapter's server render")).toEqual({
      status: "fail",
      message: "1 unexpected console message(s):\n  console.warn (server render): [fixture] server",
    });
    // The teardown's task ran before the test was judged, so the warning is its own.
    expect(l13("fails the test whose unmount leaves a warning for later")).toEqual({
      status: "fail",
      message: "1 unexpected console message(s):\n  console.warn: [fixture] after the unmount",
    });
  });

  it("allows a message with a reason, and still captures it", async () => {
    allowConsole(/\[fixture\] expected/, "this test checks the allowlist");
    console.warn("[fixture] expected noise");
    await mount({
      html: "<p>Rendered</p>",
      console: [{ level: "error", message: "[fixture] expected too" }],
    });
    expect(capturedConsole()).toEqual([
      { level: "warn", message: "[fixture] expected noise", source: "page" },
      { level: "error", message: "[fixture] expected too", source: "server" },
    ]);
  });

  it("allows every matching message, also with a global or sticky pattern", () => {
    // `test()` with `g` or `y` resumes at the last match's end, which would miss the second.
    allowConsole(/\[fixture\] repeated/gy, "this test checks a stateful pattern");
    console.warn("[fixture] repeated");
    console.warn("[fixture] repeated");
  });

  it("starts a test with an empty capture when nothing was logged since the last one", () => {
    expect(capturedConsole()).toEqual([]);
  });

  it("needs a reason to allow a message", () => {
    expect(() => allowConsole(/x/, "  ")).toThrow(/needs a reason/);
  });
});
