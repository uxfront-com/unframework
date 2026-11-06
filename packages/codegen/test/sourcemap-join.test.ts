import { originalPositionFor, TraceMap } from "@jridgewell/trace-mapping";
import { describe, expect, it } from "vitest";

import { composeJoinedMap } from "../src/index.ts";
import type { OutputFile, SourceMapV3 } from "../src/index.ts";

/** A map of a file's first line, column 0, to line 3, column 2 of `source`. */
const mapOf = (file: string, source: string): SourceMapV3 => ({
  version: 3,
  file,
  sources: [source],
  sourcesContent: [`the text of ${source}`],
  names: ["named"],
  mappings: "AAEEA",
});

const mapped = (path: string, source: string): OutputFile => ({
  path,
  contents: "x;\n",
  map: mapOf(path, source),
});

// A's line, then the separator's, then B's: each file's first character is mapped by the join.
const joined = { sources: ["A.tsx", "B.tsx"], names: [], mappings: "AAAA;;ACAA" };

describe("composeJoinedMap", () => {
  it("goes through each file's map to its source", () => {
    const map = composeJoinedMap(joined, [
      mapped("A.tsx", "A.uf.tsx"),
      mapped("B.tsx", "B.uf.tsx"),
    ]);
    expect(map).toMatchObject({
      version: 3,
      file: "A.tsx",
      sources: ["A.uf.tsx", "B.uf.tsx"],
      sourcesContent: ["the text of A.uf.tsx", "the text of B.uf.tsx"],
      names: ["named"],
    });
    const trace = new TraceMap(map);
    expect(originalPositionFor(trace, { line: 1, column: 0 })).toEqual({
      source: "A.uf.tsx",
      line: 3,
      column: 2,
      name: "named",
    });
    expect(originalPositionFor(trace, { line: 3, column: 0 }).source).toBe("B.uf.tsx");
  });

  it("names one source once when two files come from it", () => {
    const map = composeJoinedMap(joined, [
      mapped("A.tsx", "X.uf.tsx"),
      mapped("B.tsx", "X.uf.tsx"),
    ]);
    expect(map.sources).toEqual(["X.uf.tsx"]);
  });

  it("leaves a file with no map unmapped, with no source of its own", () => {
    const map = composeJoinedMap(joined, [
      { path: "A.tsx", contents: "x;\n" },
      mapped("B.tsx", "B.uf.tsx"),
    ]);
    expect(map.file).toBe("B.tsx");
    expect(map.sources).toEqual(["B.uf.tsx"]);
    expect(originalPositionFor(new TraceMap(map), { line: 1, column: 0 }).source).toBeNull();
  });
});
