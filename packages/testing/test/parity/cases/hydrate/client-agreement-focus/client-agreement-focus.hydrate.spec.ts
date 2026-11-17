// L12's `client agreement` render leaves the focus where the hydrated view put it: a component
// that focuses as it mounts focuses its client render's copy too, which the check then removes
// (ADR-0101).
import { expect, it } from "vitest";

import "../../../../../src/setup.ts";
import { describeTargets, mount } from "../../../../../src/index.ts";
import "../../../dom-target.ts";
import Note from "./component.ts";

describeTargets("hydrate/client-agreement-focus", () => {
  it("keeps the focus in the hydrated view after the client render", async ({ task }) => {
    const view = await mount(Note, {
      props: { server: '<label>Note <input type="text"></label>' },
    });
    expect(document.activeElement).toBe(view.container.querySelector("input"));
    expect(Object.keys(task.meta.uf?.layers ?? {})).not.toContain("L12");
  });
});
