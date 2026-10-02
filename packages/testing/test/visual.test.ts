import { describe, expect, it } from "vitest";

import { formatConsoleArgs } from "../src/browser/console.ts";
import { diffGeometry, formatGeometryDiff } from "../src/node/visual.ts";
import type { GeometrySnapshot } from "../src/visual-types.ts";

const snapshot = (padding: string, width: number): GeometrySnapshot => ({
  version: 1,
  nodes: {
    "p[0]": { box: [8, 8, width, 24], style: { "padding-left": padding, color: "rgb(0, 0, 0)" } },
    "p[0]/#text[0]": { box: [[8, 8, width, 24]] },
  },
});

describe("diffGeometry", () => {
  it("finds nothing between equal snapshots", () => {
    expect(diffGeometry(snapshot("0px", 100), snapshot("0px", 100))).toEqual([]);
  });

  it("reports box and computed-style differences by element path", () => {
    expect(diffGeometry(snapshot("0px", 100), snapshot("1px", 101))).toEqual([
      { path: "p[0]", property: "box", expected: [8, 8, 100, 24], actual: [8, 8, 101, 24] },
      { path: "p[0]", property: "padding-left", expected: "0px", actual: "1px" },
      {
        path: "p[0]/#text[0]",
        property: "box",
        expected: [[8, 8, 100, 24]],
        actual: [[8, 8, 101, 24]],
      },
    ]);
  });

  it("reports nodes that only one side has", () => {
    const fewer: GeometrySnapshot = {
      version: 1,
      nodes: { "p[0]": snapshot("0px", 1).nodes["p[0]"]! },
    };
    expect(diffGeometry(snapshot("0px", 1), fewer)).toEqual([
      { path: "p[0]/#text[0]", property: "(node)", expected: "present", actual: "absent" },
    ]);
  });

  it("formats the first deltas, then a count", () => {
    const deltas = diffGeometry(snapshot("0px", 100), snapshot("1px", 101));
    expect(formatGeometryDiff(deltas, "cases/x/__expected__/geometry.initial.json", 2)).toEqual([
      "Geometry and computed styles differ from cases/x/__expected__/geometry.initial.json (3):",
      "  p[0]  box: [8,8,100,24] → [8,8,101,24]",
      '  p[0]  padding-left: "0px" → "1px"',
      "  … 1 more",
    ]);
    expect(formatGeometryDiff([])).toEqual([]);
  });
});

describe("formatConsoleArgs", () => {
  it("applies printf substitutions the way the console prints them", () => {
    expect(
      formatConsoleArgs(["Each child in a list should have a unique %s prop.%s", '"key"', ""]),
    ).toBe('Each child in a list should have a unique "key" prop.');
    expect(formatConsoleArgs(["%cstyled", "color: red", "rest"])).toBe("styled rest");
    expect(formatConsoleArgs(["100%% sure"])).toBe("100% sure");
    expect(formatConsoleArgs(["missing %s"])).toBe("missing %s");
  });

  it("joins non-string arguments", () => {
    expect(formatConsoleArgs([new Error("boom"), { a: 1 }, 3])).toBe('boom {"a":1} 3');
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(formatConsoleArgs([circular])).toBe("[object Object]");
  });
});
