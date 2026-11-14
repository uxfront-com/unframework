// L12's `ids` sub-check fails on its own: the hydrated DOM agrees with the client render, but an
// id is not the one the server wrote. The DOM check renames generated ids, so only the raw
// values show it (ADR-0095).
import { expect, it } from "vitest";

import "../../../../../src/setup.ts";
import { expectLayerFailure } from "../../../../../src/browser/behaviour.ts";
import { describeTargets, mount } from "../../../../../src/index.ts";
import "../../../dom-target.ts";
import Hint from "./component.ts";

describeTargets("hydrate/ids", () => {
  it("fails L12's ids, and nothing else", async ({ task }) => {
    const view = await mount(Hint, { props: { server: '<p id="hint">Pick one size.</p>' } });
    expect(view.container.querySelector("p")?.id).toBe("tip");
    const message = expectLayerFailure("L12", /^ids: the hydrated DOM's ids are not the server's/);
    expect(message).toContain('server:   id="hint"');
    expect(message).toContain('hydrated: id="tip"');
    expect(message).not.toMatch(/client agreement/);
    expect(Object.keys(task.meta.uf?.layers ?? {})).toEqual(["L12"]);
  });
});
