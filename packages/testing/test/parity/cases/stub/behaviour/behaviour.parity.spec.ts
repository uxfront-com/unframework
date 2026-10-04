// L8, the spec's own behaviour (ADR-0043): the setup file records it after each test, from the
// errors of the test itself (its assertions, its hooks, Vitest's assertion count) and a failed
// unmount. test/behaviour.test.ts runs these stubs again and reads the parity matrix they make.
import { afterEach, describe, expect, it, onTestFinished } from "vitest";

import "../../../../../src/setup.ts";
import { describeTargets, mount } from "../../../../../src/index.ts";
import "../../../dom-target.ts";

describeTargets("stub/behaviour", () => {
  it("records L8 as passing when the test's assertions pass", async ({ task }) => {
    onTestFinished(() => {
      expect(task.meta.uf?.layers.L8).toEqual({ status: "pass" });
    });
    const view = await mount({ html: "<p>Hello</p>" });
    await expect.element(view.getByText("Hello")).toBeVisible();
  });

  it.fails("fails L8 with the test's own failed assertion", async () => {
    const view = await mount({ html: "<p>Hello</p>" });
    // What is never rendered never appears: no need to wait the default 15 seconds.
    await expect.element(view.getByText("Goodbye"), { timeout: 100 }).toBeVisible();
  });

  it.fails("fails L8 when the test asserts nothing", async () => {
    await mount({ html: "<p>Hello</p>" });
  });

  it.fails("fails L8 when the unmount fails", async () => {
    const view = await mount({ html: "<p>Hello</p>", failUnmount: "[fixture] unmount" });
    await expect.element(view.getByText("Hello")).toBeVisible();
  });

  describe("a spec's own afterEach", () => {
    afterEach(({ task }) => {
      if (task.name.startsWith("fails L8")) throw new Error("[fixture] the spec's afterEach");
    });

    it.fails("fails L8 with the error its afterEach threw", async () => {
      const view = await mount({ html: "<p>Hello</p>" });
      await expect.element(view.getByText("Hello")).toBeVisible();
    });

    it("recorded it as the test's own error", ({ task }) => {
      expect(task.suite?.tasks[0]?.meta.uf?.layers.L8).toEqual({
        status: "fail",
        message: "Error: [fixture] the spec's afterEach",
      });
    });
  });

  it("recorded L8 as failed, with the test's own errors, for the tests above", ({ task }) => {
    const l8 = (name: string) =>
      task.suite?.tasks.find((sibling) => sibling.name === name)?.meta.uf?.layers.L8;
    // What a canary that empties the render makes of every spec (ADR-0043): plain text, with
    // what the container held instead, and without the page's HTML.
    expect(l8("fails L8 with the test's own failed assertion")).toEqual({
      status: "fail",
      message: expect.stringMatching(
        /^VitestBrowserElementError: Cannot find element with locator: getByTestId\('uf-root-\d+'\)\.getByText\('Goodbye'\)\n\nARIA tree:\n- paragraph: Hello$/,
      ),
    });
    expect(l8("fails L8 when the test asserts nothing")).toEqual({
      status: "fail",
      message:
        "The test asserted nothing: every test asserts at least one fact about what it rendered (expect.requireAssertions).",
    });
    expect(l8("fails L8 when the unmount fails")).toEqual({
      status: "fail",
      message: "Unmounting failed: [fixture] unmount",
    });
    // A failed L8 is all they failed on.
    for (const name of [
      "fails L8 with the test's own failed assertion",
      "fails L8 when the test asserts nothing",
      "fails L8 when the unmount fails",
    ]) {
      const layers = task.suite?.tasks.find((sibling) => sibling.name === name)?.meta.uf?.layers;
      expect(layers?.L13, name).toEqual({ status: "pass" });
    }
  });
});
