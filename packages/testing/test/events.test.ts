// What a view keeps of each emit (ADR-0050): a copy as plain data, refused with the event's name
// and the place of a value no trace can hold; generated ids renamed as the step's DOM renames
// them; and events grouped by name for a trace step.
import { describe, expect, it } from "vitest";

import { copyPayload, groupEvents, PayloadError, renumberIds } from "../src/browser/events.ts";

describe("copyPayload", () => {
  it("copies plain data, so a later change to the original never reaches the log", () => {
    const item = { id: 1, tags: ["a"], nested: { on: true, none: null } };
    const copy = copyPayload("change", [item, "x", 2.5, -0]);
    expect(copy).toEqual([{ id: 1, tags: ["a"], nested: { on: true, none: null } }, "x", 2.5, 0]);
    item.tags.push("b");
    expect(copy[0]).toEqual({ id: 1, tags: ["a"], nested: { on: true, none: null } });
    expect(Object.is(copy[3], -0)).toBe(false);
    // A proxy is read through, as a framework's reactive state is.
    const proxied = new Proxy({ count: 3 }, {});
    expect(copyPayload("change", [proxied])).toEqual([{ count: 3 }]);
    expect(copyPayload("ping", [])).toEqual([]);
  });

  it("drops trailing undefined arguments, which a listener cannot tell from absent ones", () => {
    // A watcher's immediate first run: `emit("change", value, previous)` with no previous value.
    expect(copyPayload("change", ["Introduction", undefined])).toEqual(["Introduction"]);
    expect(copyPayload("change", [1, null, undefined, undefined])).toEqual([1, null]);
    expect(copyPayload("change", [undefined])).toEqual([]);
  });

  it("refuses what no trace can hold, naming the event and where the value is", () => {
    const refused = (args: unknown[]) => {
      try {
        copyPayload("change", args);
      } catch (error) {
        expect(error).toBeInstanceOf(PayloadError);
        return (error as Error).message;
      }
      return "copied";
    };
    expect(refused([() => 1])).toMatch(/^The payload of "change" holds a function at argument 1:/);
    // Only a trailing undefined is dropped: before a given argument, or inside one, it is refused.
    expect(refused([1, undefined, 3])).toMatch(
      /holds undefined \(leave the argument out, or pass null\) at argument 2/,
    );
    expect(refused([undefined, 1, undefined])).toMatch(/holds undefined .* at argument 1:/);
    expect(refused([{ name: undefined }])).toMatch(/holds undefined .* at argument 1\.name:/);
    expect(refused([{ list: [1, Number.NaN] }])).toMatch(/holds NaN at argument 1\.list\[1\]/);
    expect(refused([Infinity])).toMatch(/holds Infinity at argument 1/);
    expect(refused([new Map()])).toMatch(/holds a Map at argument 1/);
    expect(refused([{ set: new Set() }])).toMatch(/holds a Set at argument 1\.set/);
    expect(refused([new Event("click")])).toMatch(/holds a DOM event at argument 1/);
    expect(refused([new Date(0)])).toMatch(/holds an instance of Date at argument 1/);
    expect(refused([Symbol("x")])).toMatch(/holds a symbol at argument 1/);
    expect(refused([10n])).toMatch(/holds a bigint at argument 1/);
  });
});

describe("renumberIds", () => {
  it("renames generated ids as the DOM's map does, and numbers the others after them", () => {
    const names = new Map([["uf-id-r1", "uf-id-1"]]);
    expect(
      renumberIds(
        { id: "uf-id-r1", described: "uf-id-r1 uf-id-zz note", list: ["uf-id-zz"], plain: "x" },
        names,
      ),
    ).toEqual({ id: "uf-id-1", described: "uf-id-1 uf-id-2 note", list: ["uf-id-2"], plain: "x" });
    expect(renumberIds([1, null, true], new Map())).toEqual([1, null, true]);
    // As in the DOM: an id ends where an id character stops, wherever it stands in a string.
    expect(renumberIds(["#uf-id-r1", "(uf-id-r1-0).", "xuf-id-r1"], names)).toEqual([
      "#uf-id-1",
      "(uf-id-3).",
      "xuf-id-r1",
    ]);
  });
});

describe("groupEvents", () => {
  it("groups by name, names sorted, each name's emits in the order they came", () => {
    expect(
      groupEvents([
        { name: "select", args: [2] },
        { name: "change", args: [1] },
        { name: "select", args: [3] },
        { name: "close", args: [] },
      ]),
    ).toEqual({ change: [[1]], close: [[]], select: [[2], [3]] });
    expect(
      Object.keys(
        groupEvents([
          { name: "b", args: [] },
          { name: "a", args: [] },
        ]),
      ),
    ).toEqual(["a", "b"]);
  });
});
