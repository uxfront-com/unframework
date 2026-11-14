// L12's `client agreement` sub-check fails on its own: the hydrated DOM keeps the server's text,
// with the same ids and no mismatch reported, but the client render shows another (ADR-0095).
import { expect, it } from "vitest";

import "../../../../../src/setup.ts";
import { expectLayerFailure } from "../../../../../src/browser/behaviour.ts";
import { describeTargets, mount } from "../../../../../src/index.ts";
import "../../../dom-target.ts";
import Plan from "./component.ts";

describeTargets("hydrate/client-agreement", () => {
  it("fails L12's client agreement, and nothing else", async ({ task }) => {
    const view = await mount(Plan, { props: { server: "<p>Monthly</p>" } });
    expect(view.container.textContent).toBe("Monthly");
    const message = expectLayerFailure(
      "L12",
      /^client agreement: the hydrated DOM is not the client render's/,
    );
    expect(message).toContain("Yearly");
    expect(message).not.toMatch(/^ids:/m);
    expect(Object.keys(task.meta.uf?.layers ?? {})).toEqual(["L12"]);
  });
});
