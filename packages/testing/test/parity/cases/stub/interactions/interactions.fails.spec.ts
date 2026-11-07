// A step the test never compares fails L9 when it ends: the setup records it. On purpose, so only
// test/interactions.test.ts runs this.
import { expect, it } from "vitest";

import "../../../../../src/setup.ts";
import { describeTargets, mount } from "../../../../../src/index.ts";
import type { StubComponent } from "../../../dom-target.ts";
import "../../../dom-target.ts";
import { sibling } from "../../../stub-api.ts";

/** A status and a button that counts. */
const counter: StubComponent = {
  html: '<p role="status">0</p><button type="button">Add one</button>',
  setup(container, _emit, signal) {
    const status = container.querySelector("p")!;
    container.querySelector("button")!.addEventListener(
      "click",
      () => {
        status.textContent = String(Number(status.textContent) + 1);
      },
      { signal },
    );
  },
};

const failing = "fails L9 with a step no expectParity compared";

describeTargets("stub/interactions", () => {
  it(failing, async () => {
    const view = await mount(counter);
    await view.user.click(view.getByRole("button", { name: "Add one" }));
    await expect.element(view.getByRole("status")).toHaveTextContent("1");
  });

  it("recorded the step left at the end of the test above", () => {
    expect(sibling(failing)?.meta.uf?.layers.L9).toEqual({
      status: "fail",
      message: expect.stringMatching(
        /^1 step\(s\) of uf-root-\d+ were never compared \(click getByRole\('button', \{ name: 'Add one' \}\)\): every view\.user action and rerender is followed by an expectParity/,
      ),
    });
    // L8 passes: the test's own assertions held.
    expect(sibling(failing)?.meta.uf?.layers.L8).toEqual({ status: "pass" });
  });
});
