// The first act after the mount is a `getBy*`: nothing has queried the page yet, so nothing but the
// module's own load can have set the selector engine's defaults. Run alone, in a page of its own.
import { expect, it } from "vitest";

import "../../../../../src/setup.ts";
import { describeTargets, mount } from "../../../../../src/index.ts";
import "../../../dom-target.ts";

const buttons = { html: "<button>Shipping</button><button>Toggle shipping</button>" };

describeTargets("stub/page-first-query", () => {
  it("names a button whose name another holds", async ({ task }) => {
    const view = await mount(buttons);
    const inexact = view.getByText("Shipping", { exact: false });
    (task.meta as { results?: unknown }).results = inexact.serialize();
    await expect.element(view.getByRole("button", { name: "Shipping" })).toBeVisible();
  });
});
