// The stack mapping of a project's tests (`ufMapStack`, ADR-0086): which served module a frame
// stands for, and where a case throws.
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { servedFile, stackFrames, throwSite } from "../src/node/thrown.ts";

describe("servedFile", () => {
  it("reads a file under the root by its path, and any other by /@fs/", () => {
    expect(servedFile("http://localhost:5173/src/Counter.uf.tsx?t=1", "/project")).toBe(
      "/project/src/Counter.uf.tsx",
    );
    expect(servedFile("http://localhost:5173/@fs/elsewhere/A%20B.uf.tsx", "/project")).toBe(
      "/elsewhere/A B.uf.tsx",
    );
    expect(servedFile("not a url", "/project")).toBeUndefined();
  });
});

describe("throwSite", () => {
  it("finds the one throw among the case's sources, wherever they lie", () => {
    const root = mkdtempSync(join(tmpdir(), "uf-thrown-"));
    const main = join(root, "Total.uf.tsx");
    const child = join(root, "Row.uf.tsx");
    writeFileSync(main, "export default function Total() {\n  throw new Error('no');\n}\n");
    writeFileSync(child, "export default function Row() {\n  return <i />;\n}\n");
    expect(throwSite([main, child, main])).toEqual({ file: main, line: 2 });
    writeFileSync(child, "export default function Row() {\n  throw new Error('no');\n}\n");
    expect(() => throwSite([main, child])).toThrow("hold 2 throw statements");
    expect(() => throwSite([])).toThrow("hold 0 throw statements");
  });
});

describe("stackFrames", () => {
  it("reads each frame, with or without a function name", () => {
    expect(
      stackFrames(
        "Error: no\n    at Total (http://h/src/Total.uf.tsx:2:9)\n    at http://h/a.js:1:2",
      ),
    ).toEqual([
      { url: "http://h/src/Total.uf.tsx", line: 2, column: 9 },
      { url: "http://h/a.js", line: 1, column: 2 },
    ]);
  });
});
