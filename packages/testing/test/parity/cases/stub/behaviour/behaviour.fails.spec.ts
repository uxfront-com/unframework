// L8, the spec's own behaviour (ADR-0043): the setup file records it after each test, from the
// errors of the test itself (its assertions, its hooks, Vitest's assertion count) and a failed
// unmount. They fail on purpose, so only test/behaviour.test.ts, which reads each test's state and
// the parity matrix they make, and test/fails.test.ts run them.
import { expect, it } from "vitest";

import "../../../../../src/setup.ts";
import { host } from "../../../../../src/browser/host.ts";
import { describeTargets, mount } from "../../../../../src/index.ts";
import "../../../dom-target.ts";
import { sibling } from "../../../stub-api.ts";

describeTargets("stub/behaviour", () => {
  it("records L8 as passing when the test's assertions pass", async () => {
    const view = await mount({ html: "<p>Hello</p>" });
    await expect.element(view.getByText("Hello")).toBeVisible();
  });

  it("fails L8 with the test's own failed assertion", async () => {
    const view = await mount({ html: "<p>Hello</p>" });
    // What is never rendered never appears: no need to wait the default 15 seconds.
    await expect.element(view.getByText("Goodbye"), { timeout: 100 }).toBeVisible();
  });

  it("fails L8 with an action on an element that is not there", async () => {
    const view = await mount({ html: "<p>Hello</p>" });
    // An action waits the provider's action timeout, as an assertion waits the poll's.
    await view.user.click(view.getByRole("button", { name: "Goodbye" }));
  });

  it("fails L8 when the test asserts nothing", async () => {
    await mount({ html: "<p>Hello</p>" });
  });

  it("fails L8 when the unmount fails", async () => {
    const view = await mount({ html: "<p>Hello</p>", failUnmount: "[fixture] unmount" });
    await expect.element(view.getByText("Hello")).toBeVisible();
  });

  const hookFails = "fails L8 with the error its afterEach threw";

  host().hooks.afterEach(async (test) => {
    if (test === sibling(hookFails)) throw new Error("[fixture] the spec's afterEach");
  });

  it(hookFails, async () => {
    const view = await mount({ html: "<p>Hello</p>" });
    await expect.element(view.getByText("Hello")).toBeVisible();
  });

  it("recorded it as the test's own error", () => {
    expect(sibling(hookFails)?.meta.uf?.layers.L8).toEqual({
      status: "fail",
      message: "Error: [fixture] the spec's afterEach",
    });
  });

  it("recorded L8 as failed, with the test's own errors, for the tests above", () => {
    const l8 = (name: string) => sibling(name)?.meta.uf?.layers.L8;
    expect(l8("records L8 as passing when the test's assertions pass")).toEqual({ status: "pass" });
    // What a canary that empties the render makes of every spec (ADR-0043): plain text, with
    // what the container held instead, and without the page's HTML.
    expect(l8("fails L8 with the test's own failed assertion")).toEqual({
      status: "fail",
      message: expect.stringMatching(
        /^VitestBrowserElementError: Cannot find element with locator: getByTestId\('uf-root-\d+'\)\.getByText\('Goodbye'\)\n\nARIA tree:\n- paragraph: Hello$/,
      ),
    });
    // What a canary that empties the render makes of a spec whose first statement after its
    // first expectParity acts: Playwright's timeout, naming the locator under the view's root.
    expect(l8("fails L8 with an action on an element that is not there")).toEqual({
      status: "fail",
      message: expect.stringMatching(
        /^TimeoutError: locator\.hover: Timeout 5000ms exceeded\.\nCall log:\n {2}- waiting for .*getByTestId\('uf-root-\d+'\)\.getByRole\('button', \{ name: 'Goodbye', exact: true \}\)\n?$/,
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
      "fails L8 with an action on an element that is not there",
      "fails L8 when the test asserts nothing",
      "fails L8 when the unmount fails",
    ]) {
      expect(sibling(name)?.meta.uf?.layers.L13, name).toEqual({ status: "pass" });
    }
  });
});
