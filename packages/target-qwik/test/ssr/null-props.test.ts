// `null` props on Qwik's server (ADR-0034: `null` is a value). Qwik keeps a `null` a parent
// writes as an attribute, which the optimizer compiles to `_jsxSorted`, and deletes it from a
// spread or a `jsx()` call, which go through `_jsxSplit`: the component reads `undefined`
// there. The server adapter hands the props over as written attributes, so a scenario's `null`
// reaches the component as `null`.
import { describe, expect, it } from "vitest";

import { renderToString } from "../../src/toolchain/server.ts";

/** A fixture's components, compiled by Qwik's plugin (a computed path: see server.test.ts). */
const load = async (name: string): Promise<Readonly<Record<string, unknown>>> =>
  import(`../fixtures/${name}.tsx`);
const fixtures = await load("NullProps");

/** The text a component renders: what its probe read. */
async function read(name: string, props?: Record<string, unknown>): Promise<string> {
  return (await renderToString(fixtures[name], { props })).replace(/<[^>]*>/g, "");
}

describe("null props on Qwik's server", () => {
  it("reach the component as `null` from the adapter, and an absent prop as `undefined`", async () => {
    expect(await read("NullProbe", { value: null })).toBe("null");
    expect(await read("NullProbe", { value: undefined })).toBe("undefined");
    expect(await read("NullProbe", {})).toBe("undefined");
    expect(await read("NullProbe", { value: "x" })).toBe("x");
  });

  it("keep `null` as a parent writes it, and lose it through a spread or `jsx()`", async () => {
    // Qwik's own behaviour, pinned: a consumer that spreads its props loses a `null`.
    expect({
      written: await read("Written"),
      held: await read("Held"),
      spread: await read("Spread"),
      called: await read("Called"),
    }).toEqual({ written: "null", held: "null", spread: "undefined", called: "undefined" });
  });
});
