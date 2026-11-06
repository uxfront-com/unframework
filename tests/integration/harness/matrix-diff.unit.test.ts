// scripts/matrix-diff.ts on fixture matrices: what counts as a difference between two runners'
// matrices, and which cells the `--stable` form trusts.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { MATRIX_VERSION } from "@unframework/testing/node";
import type { MatrixCells, MatrixTests, ParityMatrix } from "@unframework/testing/node";
import { afterEach, describe, expect, it } from "vitest";

import { diffMatrices, diffStable, parseDiffArgs, readMatrix } from "../scripts/matrix-diff.ts";

const SCRIPT = fileURLToPath(new URL("../scripts/matrix-diff.ts", import.meta.url));

/** A matrix of the given cells, with one target and one layer unless a test needs more. */
function matrix(cells: MatrixCells = {}, extra: Partial<ParityMatrix> = {}): ParityMatrix {
  return {
    version: MATRIX_VERSION,
    run: "fixture",
    projects: [],
    cases: cells,
    scenarios: {},
    tests: {},
    ...extra,
  };
}

/** One (case, vue, L7) cell of each status. */
const cell = (value: string, id = "basics/hello"): MatrixCells => ({
  [id]: { vue: { L7: value } },
});

describe("diffMatrices", () => {
  it("finds nothing in two equal matrices, and counts what it compared", () => {
    const diff = diffMatrices(matrix(cell("pass")), matrix(cell("pass")));
    expect(diff.compared).toBe(1);
    expect(diff.cells).toEqual([]);
    expect(diff.records).toEqual([]);
    expect(diff.messages).toEqual([]);
  });

  it("names a differing status", () => {
    const diff = diffMatrices(matrix(cell("pass")), matrix(cell("fail: no")));
    expect(diff.cells).toEqual(["basics/hello › vue › L7: a pass, b fail"]);
  });

  it("names a cell absent from one matrix, in either order", () => {
    const one = matrix(cell("pass"));
    const other = matrix({ "basics/hello": { vue: {} } });
    expect(diffMatrices(one, other).cells).toEqual(["basics/hello › vue › L7: a pass, b absent"]);
    expect(diffMatrices(other, one).cells).toEqual(["basics/hello › vue › L7: a absent, b pass"]);
  });

  it("treats a skip's reason and a quarantine's issue as part of the status", () => {
    expect(diffMatrices(matrix(cell("skip(one)")), matrix(cell("skip(two)"))).cells).toEqual([
      "basics/hello › vue › L7: a skip(one), b skip(two)",
    ]);
    expect(
      diffMatrices(matrix(cell("quarantined(#1)")), matrix(cell("quarantined(#2)"))).cells,
    ).toEqual(["basics/hello › vue › L7: a quarantined(#1), b quarantined(#2)"]);
  });

  it("lists differing failure messages apart from the statuses, by the line they part on", () => {
    const diff = diffMatrices(
      matrix(cell("fail: one\nsame\nold")),
      matrix(cell("fail: one\nsame\nnew")),
    );
    expect(diff.cells).toEqual([]);
    expect(diff.messages).toEqual(["basics/hello › vue › L7: line 3:\n    a old\n    b new"]);
  });

  it("shows a message that only one side continues", () => {
    expect(
      diffMatrices(matrix(cell("fail: one")), matrix(cell("fail: one\nmore"))).messages,
    ).toEqual(["basics/hello › vue › L7: line 2:\n    a (no such line)\n    b more"]);
  });

  it("throws on text that is not a cell, so a corrupt matrix is loud", () => {
    expect(() => diffMatrices(matrix(cell("passed")), matrix(cell("passed")))).toThrow(
      /Not a parity matrix cell/,
    );
  });

  it("names differing scenarios", () => {
    const scenarios = (...names: string[]) => ({ "basics/hello": { vue: names } });
    const diff = diffMatrices(
      matrix(cell("pass"), { scenarios: scenarios("one", "two") }),
      matrix(cell("pass"), { scenarios: scenarios("two", "three") }),
    );
    expect(diff.cells).toEqual([]);
    expect(diff.records).toEqual([
      'basics/hello › vue › scenarios: a ["one","two"], b ["two","three"]',
    ]);
  });

  it("names a differing test, a test absent from one matrix, and a changed skip", () => {
    const tests = (records: MatrixTests[string][string]): MatrixTests => ({
      "basics/hello": { vue: records },
    });
    const diff = diffMatrices(
      matrix(cell("pass"), {
        tests: tests({
          same: { scenarios: ["one"] },
          moved: { scenarios: ["one"] },
          gone: { scenarios: [] },
          skipped: { scenarios: [], skipped: "a capability" },
        }),
      }),
      matrix(cell("pass"), {
        tests: tests({
          same: { scenarios: ["one"] },
          moved: { scenarios: ["two"] },
          skipped: { scenarios: [], skipped: "no output" },
        }),
      }),
    );
    expect(diff.records).toEqual([
      'basics/hello › vue › test "gone": a {"scenarios":[]}, b absent',
      'basics/hello › vue › test "moved": a {"scenarios":["one"]}, b {"scenarios":["two"]}',
      'basics/hello › vue › test "skipped": a {"scenarios":[],"skipped":"a capability"}, b {"scenarios":[],"skipped":"no output"}',
    ]);
  });

  it("ignores run metadata", () => {
    const diff = diffMatrices(matrix(cell("pass"), { run: "merged", projects: ["browser:vue"] }), {
      ...matrix(cell("pass"), { run: "all", projects: [] }),
      finishedAt: "now",
    } as ParityMatrix);
    expect(diff.cells).toEqual([]);
    expect(diff.records).toEqual([]);
  });

  it("compares only the named cases", () => {
    const one = matrix({ ...cell("pass", "a/one"), ...cell("pass", "a/two") });
    const other = matrix({ ...cell("pass", "a/one"), ...cell("fail: no", "a/two") });
    expect(diffMatrices(one, other, ["a/one"])).toMatchObject({ compared: 1, cells: [] });
    expect(diffMatrices(one, other, ["a/two"]).cells).toHaveLength(1);
  });

  it("refuses a named case neither matrix holds, which would otherwise pass", () => {
    expect(() => diffMatrices(matrix(cell("pass")), matrix(cell("pass")), ["a/typo"])).toThrow(
      /a\/typo/,
    );
  });
});

describe("diffStable", () => {
  const runs = (
    ...values: [string | undefined, string | undefined, string | undefined, string | undefined]
  ) =>
    values.map((value) => matrix(value === undefined ? {} : cell(value))) as [
      ParityMatrix,
      ParityMatrix,
      ParityMatrix,
      ParityMatrix,
    ];

  it("counts a cell of one status in all four runs as stable", () => {
    const diff = diffStable(runs("pass", "pass", "pass", "pass"));
    expect(diff).toEqual({ stable: 1, absent: 0, differing: [], unstable: [] });
  });

  it("calls a stable cell whose status differs between runners different", () => {
    const diff = diffStable(runs("pass", "pass", "fail: no", "fail: other"));
    expect(diff.stable).toBe(1);
    expect(diff.differing).toEqual(["basics/hello › vue › L7: a pass, b fail"]);
    expect(diff.unstable).toEqual([]);
  });

  it("lists a cell whose status changes within a runner as unstable, on either runner", () => {
    const line = "basics/hello › vue › L7: a1 pass, a2 fail, b1 pass, b2 pass";
    expect(diffStable(runs("pass", "fail: no", "pass", "pass"))).toEqual({
      stable: 0,
      absent: 0,
      differing: [],
      unstable: [line],
    });
    expect(diffStable(runs("pass", "pass", "pass", "fail: no")).unstable).toEqual([
      "basics/hello › vue › L7: a1 pass, a2 pass, b1 pass, b2 fail",
    ]);
  });

  it("calls a cell absent from one run of a runner unstable, and counts it absent", () => {
    for (const fixture of [
      runs(undefined, "pass", "pass", "pass"),
      runs("pass", undefined, "pass", "pass"),
      runs("pass", "pass", undefined, "pass"),
      runs("pass", "pass", "pass", undefined),
    ]) {
      const diff = diffStable(fixture);
      expect(diff).toMatchObject({ stable: 0, absent: 1, differing: [] });
      expect(diff.unstable).toHaveLength(1);
    }
  });

  it("says a cell stable on one runner and absent from both runs of the other differs, whichever comes first", () => {
    const first = diffStable(runs("pass", "pass", undefined, undefined));
    expect(first).toEqual({
      stable: 0,
      absent: 1,
      differing: ["basics/hello › vue › L7: a pass, b absent"],
      unstable: [],
    });
    const second = diffStable(runs(undefined, undefined, "pass", "pass"));
    expect(second).toEqual({
      stable: 0,
      absent: 1,
      differing: ["basics/hello › vue › L7: a absent, b pass"],
      unstable: [],
    });
  });

  it("lists a cell unstable on one runner and absent from the other as unstable", () => {
    expect(diffStable(runs("pass", "fail: no", undefined, undefined))).toMatchObject({
      stable: 0,
      absent: 1,
      differing: [],
    });
    expect(diffStable(runs(undefined, undefined, "pass", undefined)).unstable).toHaveLength(1);
  });

  it("finds no stable cell in empty matrices", () => {
    expect(diffStable(runs(undefined, undefined, undefined, undefined))).toEqual({
      stable: 0,
      absent: 0,
      differing: [],
      unstable: [],
    });
  });

  it("reads only the named cases", () => {
    const fixture = (value: string) =>
      matrix({ ...cell("pass", "a/one"), ...cell(value, "a/two") });
    const four = [fixture("pass"), fixture("pass"), fixture("fail: no"), fixture("fail: no")] as [
      ParityMatrix,
      ParityMatrix,
      ParityMatrix,
      ParityMatrix,
    ];
    expect(diffStable(four, ["a/one"])).toMatchObject({ stable: 1, differing: [] });
    expect(diffStable(four).differing).toHaveLength(1);
    expect(() => diffStable(four, ["a/typo"])).toThrow(/a\/typo/);
  });
});

describe("parseDiffArgs", () => {
  it("reads both forms and repeated cases", () => {
    expect(parseDiffArgs(["a", "b"])).toEqual({ files: ["a", "b"], stable: false, cases: [] });
    expect(parseDiffArgs(["a", "--case", "x/y", "b", "--case", "x/z"])).toEqual({
      files: ["a", "b"],
      stable: false,
      cases: ["x/y", "x/z"],
    });
    expect(parseDiffArgs(["--stable", "1", "2", "3", "4", "--case", "x/y"])).toEqual({
      files: ["1", "2", "3", "4"],
      stable: true,
      cases: ["x/y"],
    });
  });

  it.each([
    [[]],
    [["a"]],
    [["a", "b", "c"]],
    [["--stable", "a", "b"]],
    [["--stable", "1", "2", "3", "4", "5"]],
    [["a", "b", "--case"]],
    [["a", "b", "--case", "--stable"]],
    [["a", "b", "--unknown"]],
  ])("refuses %j", (args) => {
    expect(() => parseDiffArgs(args)).toThrow(/Usage/);
  });
});

describe("the script", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function file(name: string, contents: unknown): string {
    const dir = mkdtempSync(join(tmpdir(), "matrix-diff-"));
    dirs.push(dir);
    const path = join(dir, name);
    writeFileSync(path, typeof contents === "string" ? contents : JSON.stringify(contents));
    return path;
  }
  const run = (...args: string[]) => {
    const result = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
    return { status: result.status, out: result.stdout, err: result.stderr };
  };

  it("normalises run ids, so two runs' scratch paths are not a difference", () => {
    const message = (id: string) => ({
      "basics/hello": {
        vue: {
          L10: `skip(no capture at .live/${id}/basics/hello/one.png)`,
          L7: `skip(.reports/ledger/${id}/one)`,
          L8: `skip(.reports/diffs/${id}/one)`,
        },
      },
    });
    const result = run(
      file("a.json", matrix(message("mh7k2a9-1234"))),
      file("b.json", matrix(message("mh7k9zz-98765"))),
    );
    expect(result.out).toContain("cells differ: 0");
    expect(result.status).toBe(0);
  });

  it("exits 0 when the same, 1 naming a differing status", () => {
    const pass = file("pass.json", matrix(cell("pass")));
    const same = run(pass, file("same.json", matrix(cell("pass"))));
    expect(same.status).toBe(0);
    expect(same.out).toContain("cells compared: 1");
    expect(same.out).toContain("cells differ: 0");

    const differs = run(pass, file("fail.json", matrix(cell("fail: no"))));
    expect(differs.status).toBe(1);
    expect(differs.out).toContain("cells differ: 1");
    expect(differs.out).toContain("basics/hello › vue › L7: a pass, b fail");
  });

  it("exits 1 on differing tests or scenarios", () => {
    const one = file(
      "one.json",
      matrix(cell("pass"), { scenarios: { "basics/hello": { vue: ["one"] } } }),
    );
    const result = run(one, file("two.json", matrix(cell("pass"))));
    expect(result.status).toBe(1);
    expect(result.out).toContain("tests and scenarios differ: 1");
  });

  it("exits 0 on differing failure messages alone, and lists them apart", () => {
    const result = run(
      file("one.json", matrix(cell("fail: one"))),
      file("two.json", matrix(cell("fail: two"))),
    );
    expect(result.status).toBe(0);
    expect(result.out).toContain("cells differ: 0");
    expect(result.out).toContain("failure messages differ: 1");
  });

  it("exits 1 when there is no cell to compare, so two crashed runs do not pass", () => {
    const result = run(file("one.json", matrix()), file("two.json", matrix()));
    expect(result.status).toBe(1);
    expect(result.out).toContain("cells compared: 0");
  });

  it("in --stable, prints the counts apart from the unstable list", () => {
    const fixture = (one: string, two: string | undefined) =>
      matrix({
        ...cell(one, "a/stable"),
        ...(two === undefined ? {} : cell(two, "a/crashed")),
      });
    const result = run(
      "--stable",
      file("1.json", fixture("pass", "pass")),
      file("2.json", fixture("pass", undefined)),
      file("3.json", fixture("pass", "pass")),
      file("4.json", fixture("pass", "pass")),
    );
    expect(result.status).toBe(0);
    expect(result.out).toMatch(/^stable cells: 1$/m);
    expect(result.out).toMatch(/^absent cells: 1$/m);
    expect(result.out).toMatch(/^unstable cells: 1$/m);
    expect(result.out).toContain("a/crashed › vue › L7: a1 pass, a2 absent, b1 pass, b2 pass");
  });

  it("in --stable, exits 1 on a stable cell that differs", () => {
    const pass = file("pass.json", matrix(cell("pass")));
    const fail = file("fail.json", matrix(cell("fail: no")));
    const result = run("--stable", pass, pass, fail, fail);
    expect(result.status).toBe(1);
    expect(result.out).toContain("stable cells differ: 1");
  });

  it("in --stable, exits 1 on a cell absent from both runs of either runner", () => {
    const pass = file("pass.json", matrix(cell("pass")));
    const other = file("other.json", matrix(cell("pass", "a/other")));
    const mixed = file("mixed.json", matrix({ ...cell("pass"), ...cell("pass", "a/other") }));
    expect(run("--stable", mixed, mixed, other, other).status).toBe(1);
    expect(run("--stable", other, other, mixed, mixed).status).toBe(1);
    expect(run("--stable", mixed, mixed, pass, pass).out).toContain(
      "a/other › vue › L7: a pass, b absent",
    );
  });

  it("in --stable, exits 1 on empty matrices", () => {
    const empty = file("empty.json", matrix());
    const result = run("--stable", empty, empty, empty, empty);
    expect(result.status).toBe(1);
    expect(result.out).toMatch(/^stable cells: 0$/m);
    expect(result.out).toMatch(/^absent cells: 0$/m);
  });

  it("in --stable, exits 1 when every cell is unstable", () => {
    const pass = file("pass.json", matrix(cell("pass")));
    const fail = file("fail.json", matrix(cell("fail: no")));
    const result = run("--stable", pass, fail, pass, pass);
    expect(result.status).toBe(1);
    expect(result.out).toMatch(/^stable cells: 0$/m);
  });

  it("exits 2 on a usage error, a missing file, a corrupt file and another version", () => {
    const good = file("good.json", matrix(cell("pass")));
    expect(run(good).status).toBe(2);
    expect(run(good, join(tmpdir(), "no-such-matrix.json")).status).toBe(2);
    expect(run(good, file("bad.json", "{ not json")).status).toBe(2);
    const shape = run(good, file("shape.json", { version: MATRIX_VERSION }));
    expect(shape.status).toBe(2);
    expect(shape.err).toContain("not a parity matrix");
    const old = run(good, file("old.json", { ...matrix(cell("pass")), version: 4 }));
    expect(old.status).toBe(2);
    expect(old.err).toContain("version");
    expect(run(good, file("cell.json", matrix(cell("passed")))).status).toBe(2);
    expect(run(good, good, "--case", "a/typo").status).toBe(2);
  });

  it("reads a matrix's cells, whatever else the file holds", () => {
    const read = readMatrix(
      file("partial.json", { ...matrix(cell("pass")), byProject: {}, finishedAt: "now" }),
    );
    expect(read.cases).toEqual(cell("pass"));
    expect(read.scenarios).toEqual({});
    expect(read.tests).toEqual({});
  });
});
