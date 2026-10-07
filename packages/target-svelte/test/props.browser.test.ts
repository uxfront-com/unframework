// The mount adapter's props (src/toolchain/props.svelte.ts): a value is the caller's own object,
// as a parent that keeps its data in `$state.raw` passes it, never a deep proxy of it, so state a
// component gives a prop's item is that item (ADR-0046); a rerender changes a key's value, and a
// key it lacks reads `undefined`.
import { assert, describe, expect, it } from "vitest";

import { reactiveProps } from "../src/toolchain/props.svelte.ts";

describe("the mount adapter's props", () => {
  it("hands the caller's own objects, which structuredClone copies", () => {
    const item = { id: "a", tags: ["x"] };
    const { props } = reactiveProps({ items: [item] });
    const items = props["items"];
    assert(Array.isArray(items));
    const [first] = items;
    expect(first).toBe(item);
    expect(structuredClone(first)).toEqual(item);
  });

  it("replaces the values that changed, and deletes the keys a rerender lacks", () => {
    const adapter = reactiveProps({ title: "A", note: "n" });
    const { props } = adapter;
    adapter.replace({ title: "B", page: 2 });
    expect(props["title"]).toBe("B");
    expect(props["page"]).toBe(2);
    expect(props["note"]).toBeUndefined();
    expect("note" in props).toBe(false);
    expect(Object.keys(props)).toEqual(["title", "page"]);
  });
});
