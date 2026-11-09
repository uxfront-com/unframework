// L14's thrown errors (ADR-0078): the source site, the stack's frames and the mapped top frame.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { checkMappedStack, stackFrames, throwSite, ufMapStack } from "./thrown.ts";

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function caseDir(files: Record<string, string>): string {
  dir = mkdtempSync(join(tmpdir(), "uf-thrown-"));
  mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}

describe("throwSite", () => {
  it("finds the one line that throws, in any of the case's sources", () => {
    const path = caseDir({ "A.uf.tsx": "export {};\n", "B.uf.tsx": "a\n  throw x;\n" });
    expect(throwSite(path)).toEqual({ file: "B.uf.tsx", line: 2 });
  });

  it.each([
    ["none", "export {};\n"],
    ["two", "throw a;\nthrow b;\n"],
  ])("refuses a case with %s", (_name, text) => {
    expect(() => throwSite(caseDir({ "A.uf.tsx": text }))).toThrow(/throw statements/);
  });

  it("does not read the word inside another", () => {
    const path = caseDir({ "A.uf.tsx": "const throwing = 1;\nthrow x;\n" });
    expect(throwSite(path).line).toBe(2);
  });
});

describe("stackFrames", () => {
  it("reads frames with and without a function name, and skips the rest", () => {
    expect(
      stackFrames(
        "Error: boom\n    at f (http://x/a.js:1:2)\n    at http://x/b.js:3:4\nnot a frame",
      ),
    ).toEqual([
      { url: "http://x/a.js", line: 1, column: 2 },
      { url: "http://x/b.js", line: 3, column: 4 },
    ]);
  });

  it("gives nothing for an empty stack", () => {
    expect(stackFrames("")).toEqual([]);
  });
});

describe("checkMappedStack", () => {
  it("passes when the top frame in the case is on the throw", () => {
    const path = caseDir({ "A.uf.tsx": "a\nthrow x;\n" });
    const stack =
      "Error\n    at node:internal:1:1\n    at /r/cases/s/a/A.uf.tsx:2:3\n    at /r/cases/s/a/A.uf.tsx:9:9";
    expect(() => checkMappedStack(path, "s/a", stack)).not.toThrow();
  });

  it("fails on the output's line, and with no frame in the case", () => {
    const path = caseDir({ "A.uf.tsx": "a\nthrow x;\n" });
    expect(() =>
      checkMappedStack(path, "s/a", "Error\n    at /r/cases/s/a/A.uf.tsx.vue:2:3"),
    ).toThrow(/A.uf.tsx.vue:2/);
    expect(() => checkMappedStack(path, "s/a", "Error")).toThrow(/missing/);
  });
});

describe("ufMapStack", () => {
  const map = { version: 3, file: "a", names: [], sources: ["Chart.uf.tsx"], mappings: "AAAA" };
  const context = (module: unknown) =>
    ({
      project: {
        browser: {
          vite: {
            environments: { client: { moduleGraph: { getModuleByUrl: async () => module } } },
          },
        },
      },
    }) as never;

  it("needs a Vite server", async () => {
    await expect(ufMapStack({ project: {} }, { case: "x/y", stack: "" })).resolves.toMatchObject({
      message: expect.stringContaining("no Vite server"),
    });
  });

  it("names a module that has no map", async () => {
    const result = await ufMapStack(context(undefined), {
      case: "sourcemaps/mounted-throws",
      stack: "Error\n    at http://l/cases/sourcemaps/mounted-throws/Chart.uf.tsx:1:1",
    });
    expect(result.message).toContain("has no source map");
  });

  it("names the line a frame maps to instead", async () => {
    const result = await ufMapStack(context({ transformResult: { map } }), {
      case: "sourcemaps/mounted-throws",
      stack: "Error\n    at http://l/cases/sourcemaps/mounted-throws/Chart.uf.tsx:1:1",
    });
    expect(result.message).toContain("maps to Chart.uf.tsx:1");
  });
});
