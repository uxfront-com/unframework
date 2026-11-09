// A layer that fails fails its test, after the test's own assertions have run. On purpose, so only
// test/fails.test.ts runs this.
import { expect, it } from "vitest";

import "../../../../../src/setup.ts";
import { describeTargets, mount } from "../../../../../src/index.ts";
import "../../../dom-target.ts";
import { sibling } from "../../../stub-api.ts";

const greeting = { html: '<p class="greeting">Hello, world!</p>' };

describeTargets("stub/match", () => {
  const failing = "fails the test, after its own assertions, with a layer that failed";

  it(failing, async ({ task }) => {
    const view = await mount(greeting);
    // A name of its own: a spec checks each scenario once.
    await view.expectParity("missing");
    expect(task.meta.uf?.layers.L7?.status).toBe("fail");
    await expect.element(view.getByText("Hello, world!")).toBeVisible();
  });

  it("recorded the failed layer and the passing behaviour above", () => {
    expect(sibling(failing)?.meta.uf?.layers).toMatchObject({
      L7: { status: "fail", message: expect.stringMatching(/Missing artefact/) },
      L8: { status: "pass" },
    });
  });
});
