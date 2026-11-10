// The two map steps a bundler's plugins don't do for us (ADR-0074).
import {
  decodedMappings,
  encodedMappings,
  originalPositionFor,
  TraceMap,
} from "@jridgewell/trace-mapping";
import type { SourceMapSegment } from "@jridgewell/trace-mapping";
import { describe, expect, it } from "vitest";

import { chainMap, withLineStarts } from "../src/index.ts";
import type { SourceMapV3 } from "../src/index.ts";

const base: Pick<SourceMapV3, "version" | "file" | "names"> = {
  version: 3,
  file: "out.js",
  names: [],
};

function mapOf(lines: SourceMapSegment[][], source = "in.uf.tsx"): SourceMapV3 {
  const shape = { ...base, sources: [source], sourcesContent: [""] };
  return { ...shape, mappings: encodedMappings(new TraceMap({ ...shape, mappings: lines })) };
}

describe("withLineStarts", () => {
  it("adds a segment at column 0 that names the line's first token", () => {
    const map = withLineStarts(mapOf([[[6, 0, 11, 6]]]));
    expect(decodedMappings(new TraceMap(map))[0]).toEqual([
      [0, 0, 11, 6],
      [6, 0, 11, 6],
    ]);
  });

  it("keeps a trace from column 0 on its line", () => {
    const position = originalPositionFor(new TraceMap(withLineStarts(mapOf([[[4, 0, 2, 8]]]))), {
      line: 1,
      column: 0,
    });
    expect(position.line).toBe(3);
  });

  it("leaves a line with no segment, or one already at column 0, as it is", () => {
    const source = mapOf([[], [[0, 0, 5, 1]]]);
    expect(withLineStarts(source).mappings).toBe(source.mappings);
  });

  it("keeps an empty map empty", () => {
    expect(withLineStarts(mapOf([])).mappings).toBe("");
  });
});

describe("chainMap", () => {
  const outer = mapOf([[[0, 0, 3, 2]]], "module.tsx");
  const inner = mapOf([[], [], [], [[2, 0, 9, 4]]]);

  it("traces through both maps", () => {
    const position = originalPositionFor(new TraceMap(chainMap(outer, inner)), {
      line: 1,
      column: 0,
    });
    expect(position).toMatchObject({ source: "in.uf.tsx", line: 10, column: 4 });
  });

  it("takes the first map as the JSON a plugin returns", () => {
    expect(chainMap(JSON.stringify(outer), inner).mappings).toBe(chainMap(outer, inner).mappings);
  });
});
