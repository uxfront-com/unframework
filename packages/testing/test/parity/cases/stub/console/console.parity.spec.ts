// L13: the setup records console hygiene for every test of a case and fails the test on any
// warning or error that is not allowlisted, from the page or from the adapter's server render.
import { expect, it, onTestFinished } from "vitest";

import "../../../../../src/setup.ts";
import { allowConsole, capturedConsole, describeTargets, mount } from "../../../../../src/index.ts";
import type { StubComponent } from "../../../dom-target.ts";
import "../../../dom-target.ts";

describeTargets("stub/console", () => {
  it("records L13 as passing when nothing is logged", async ({ task }) => {
    onTestFinished(() => {
      expect(task.meta.uf).toEqual({
        case: "stub/console",
        target: "dom",
        layers: { L8: { status: "pass" }, L13: { status: "pass" } },
      });
    });
    const view = await mount({ html: "<p>Quiet</p>" });
    await expect.element(view.getByText("Quiet")).toBeVisible();
  });

  // Each of these asserts what it did, so L13 is the only layer that fails it.
  it.fails("fails the test on an unexpected console.warn", () => {
    console.warn("[fixture] an unexpected warning");
    expect(capturedConsole()).toEqual([
      { level: "warn", message: "[fixture] an unexpected warning", source: "page" },
    ]);
  });

  it.fails("fails the test on an unexpected console.error with printf arguments", () => {
    console.error("[fixture] %s went wrong", "something");
    expect(capturedConsole()).toEqual([
      { level: "error", message: "[fixture] something went wrong", source: "page" },
    ]);
  });

  it.fails("fails the test on a message from the adapter's server render", async () => {
    const view = await mount({
      html: "<p>Rendered</p>",
      console: [{ level: "warn", message: "[fixture] server" }],
    });
    await expect.element(view.getByText("Rendered")).toBeVisible();
  });

  it.fails("fails the test on a message from a rerender's server render", async () => {
    const stub: StubComponent = {
      html: ({ text = "Rendered" }) => `<p>${String(text)}</p>`,
      rerenderConsole: [{ level: "error", message: "[fixture] server rerender" }],
    };
    const view = await mount(stub);
    await view.rerender({ text: "Again" });
    await expect.element(view.getByText("Again")).toBeVisible();
  });

  it.fails("fails the test whose unmount leaves a warning for later", async () => {
    const view = await mount({
      html: "<p>Rendered</p>",
      lateWarning: "[fixture] after the unmount",
    });
    await expect.element(view.getByText("Rendered")).toBeVisible();
  });

  it("recorded L13 as failed, with the messages, for the tests above", ({ task }) => {
    const layers = (name: string) =>
      task.suite?.tasks.find((sibling) => sibling.name === name)?.meta.uf?.layers;
    const l13 = (name: string) => layers(name)?.L13;
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
    expect(l13("fails the test on a message from a rerender's server render")).toEqual({
      status: "fail",
      message:
        "1 unexpected console message(s):\n  console.error (server render): [fixture] server rerender",
    });
    // The teardown's task ran before the test was judged, so the warning is its own.
    expect(l13("fails the test whose unmount leaves a warning for later")).toEqual({
      status: "fail",
      message: "1 unexpected console message(s):\n  console.warn: [fixture] after the unmount",
    });
    // The console was all they failed on: their own assertions passed.
    for (const sibling of task.suite?.tasks ?? []) {
      if (sibling.name.startsWith("fails the test")) {
        expect(layers(sibling.name)?.L8, sibling.name).toEqual({ status: "pass" });
      }
    }
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
    expect(capturedConsole()).toHaveLength(2);
  });

  it("starts a test with an empty capture when nothing was logged since the last one", () => {
    expect(capturedConsole()).toEqual([]);
  });

  it("needs a reason to allow a message", () => {
    expect(() => allowConsole(/x/, "  ")).toThrow(/needs a reason/);
  });
});
