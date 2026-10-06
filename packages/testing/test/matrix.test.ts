import { describe, expect, it } from "vitest";

import type { QuarantineEntry, UfLayerMeta } from "../src/layers.ts";
import {
  buildCells,
  buildPartialMatrix,
  buildScenarios,
  cellHeadline,
  cellOf,
  mergeMatrices,
  narrowing,
  outcomeOfCell,
  settleQuarantine,
  stringifyMatrix,
  withoutProjects,
} from "../src/node/matrix.ts";
import type { PartialMatrix, ProjectRecord } from "../src/node/matrix.ts";

const record = (target: string, layers: UfLayerMeta["layers"], caseId = "basics/hello") => ({
  case: caseId,
  target,
  layers,
});

/** A browser test's record: it checked these parity scenarios. */
const checked = (target: string, scenarios: string[], caseId = "basics/hello"): UfLayerMeta => ({
  ...record(target, { L7: { status: "pass" } }, caseId),
  scenarios,
});

const partial = (
  run: string,
  finishedAt: string,
  records: ProjectRecord[],
  projects = [...new Set(records.map((entry) => entry.project))],
  quarantine: QuarantineEntry[] = [],
  reference: string | null = "vue",
): PartialMatrix =>
  buildPartialMatrix({
    run,
    projects,
    records,
    finishedAt,
    mode: { update: false, pixels: "baseline", canary: null },
    filtered: null,
    shard: null,
    empty: [],
    quarantine,
    reference,
  });

describe("cells", () => {
  it("round-trips every outcome", () => {
    for (const outcome of [
      { status: "pass" },
      { status: "fail", message: "dom differs" },
      { status: "fail", message: "dom differs\n- a\n+ b\n\naria differs" },
      { status: "skip", reason: "compile errors: no output" },
      { status: "quarantined", issue: "https://example.test/1" },
    ] as const) {
      expect(outcomeOfCell(cellOf(outcome))).toEqual(outcome);
    }
  });

  it("keeps a failure's whole message, so every sub-check's evidence survives", () => {
    const message = `dom.initial.html differs\n${"- x\n".repeat(200)}aria.initial.yaml differs`;
    const cell = cellOf({ status: "fail", message: `\n  ${message}  \n` });
    expect(cell).toBe(`fail: ${message}`);
    expect(cellHeadline(cell)).toBe("fail: dom.initial.html differs (+201 more line(s))");
    expect(cellHeadline("pass")).toBe("pass");
  });

  it("refuses text that is not a cell", () => {
    expect(() => outcomeOfCell("passed")).toThrow(/Not a parity matrix cell/);
  });
});

describe("buildCells", () => {
  it("merges records per cell, failures first with every message, and sorts everything", () => {
    const cells = buildCells([
      record("vue", { L7: { status: "pass" }, L13: { status: "pass" } }),
      record("vue", { L7: { status: "fail", message: "aria differs" } }),
      record("vue", { L7: { status: "fail", message: "dom differs" } }),
      record("react", { L1: { status: "pass" } }),
      record("react", { L3: { status: "skip", reason: "no output" } }, "a/first"),
    ]);
    expect(cells).toEqual({
      "a/first": { react: { L3: "skip(no output)" } },
      "basics/hello": {
        react: { L1: "pass" },
        vue: { L7: "fail: aria differs\ndom differs", L13: "pass" },
      },
    });
    expect(Object.keys(cells)).toEqual(["a/first", "basics/hello"]);
  });
});

describe("buildScenarios", () => {
  it("collects each case and target's scenarios once, sorted, from the records that have any", () => {
    expect(
      buildScenarios([
        checked("vue", ["with-label", "defaults"]),
        checked("vue", ["defaults", "after-rerender"]),
        checked("react", ["defaults"], "a/first"),
        record("vue", { L13: { status: "pass" } }),
        { ...record("svelte", { L8: { status: "pass" } }), scenarios: [] },
      ]),
    ).toEqual({
      "a/first": { react: ["defaults"] },
      "basics/hello": { vue: ["after-rerender", "defaults", "with-label"] },
    });
  });
});

describe("buildPartialMatrix", () => {
  it("keeps each project's cells, and merges them across projects with every message", () => {
    const matrix = partial(
      "all",
      "2026-10-01T10:00:00.000Z",
      [
        {
          project: "ssr:vue",
          record: record("vue", {
            L6: { status: "pass" },
            L13: { status: "fail", message: "server console" },
          }),
        },
        {
          project: "browser:vue",
          record: record("vue", { L13: { status: "fail", message: "page console" } }),
        },
      ],
      ["browser:vue", "harness", "ssr:vue"],
    );
    expect(matrix.byProject).toEqual({
      "browser:vue": { "basics/hello": { vue: { L13: "fail: page console" } } },
      harness: {},
      "ssr:vue": { "basics/hello": { vue: { L6: "pass", L13: "fail: server console" } } },
    });
    expect(matrix.cases["basics/hello"]?.vue).toEqual({
      L6: "pass",
      L13: "fail: page console\nserver console",
    });
    expect(matrix.projects).toEqual(["browser:vue", "harness", "ssr:vue"]);
  });

  it("keeps each project's scenarios and the run's reference", () => {
    const matrix = partial("all", "2026-10-01T10:00:00.000Z", [
      { project: "browser:vue", record: checked("vue", ["initial"]) },
      { project: "browser:react", record: checked("react", ["initial", "rerendered"]) },
      { project: "ssr:vue", record: record("vue", { L6: { status: "pass" } }) },
    ]);
    expect(matrix.scenariosByProject).toEqual({
      "browser:react": { "basics/hello": { react: ["initial", "rerendered"] } },
      "browser:vue": { "basics/hello": { vue: ["initial"] } },
      "ssr:vue": {},
    });
    expect(matrix.scenarios).toEqual({
      "basics/hello": { react: ["initial", "rerendered"], vue: ["initial"] },
    });
    expect(matrix.reference).toBe("vue");
    expect(
      buildPartialMatrix({ ...matrix, records: [], empty: [], reference: undefined }).reference,
    ).toBeNull();
  });
});

describe("mergeMatrices", () => {
  const failing = partial("all", "2026-10-01T10:00:00.000Z", [
    { project: "compile", record: record("vue", { L2: { status: "fail", message: "golden" } }) },
    { project: "browser:vue", record: record("vue", { L7: { status: "pass" } }) },
  ]);

  it("lets a newer run of a project replace its cells, and keeps the other projects'", () => {
    const fixed = partial("compile", "2026-10-01T11:00:00.000Z", [
      { project: "compile", record: record("vue", { L2: { status: "pass" } }) },
    ]);
    const { matrix } = mergeMatrices([fixed, failing]);
    expect(matrix.cases["basics/hello"]?.vue).toEqual({ L2: "pass", L7: "pass" });
    expect(matrix.runs.map((run) => run.run)).toEqual(["all", "compile"]);
    expect(matrix.runs[0]).toEqual({
      run: "all",
      finishedAt: "2026-10-01T10:00:00.000Z",
      mode: { update: false, pixels: "baseline", canary: null },
      filtered: null,
      shard: null,
      projects: ["browser:vue", "compile"],
      empty: [],
    });
    expect(stringifyMatrix(matrix)).toBe(stringifyMatrix(mergeMatrices([failing, fixed]).matrix));
  });

  it("does not let an older run's failure outlive the newer pass of the same cell", () => {
    const older = partial("browser-vue", "2026-10-01T09:00:00.000Z", [
      {
        project: "browser:vue",
        record: record("vue", { L7: { status: "fail", message: "dom differs" } }),
      },
    ]);
    expect(mergeMatrices([failing, older]).matrix.cases["basics/hello"]?.vue?.L7).toBe("pass");
  });

  it("takes the newest run's quarantine, and refuses matrices of another version", () => {
    const entry: QuarantineEntry = {
      case: "basics/hello",
      target: "vue",
      layer: "L7",
      reason: "r",
      issue: "#1",
    };
    const quarantined = partial("ssr", "2026-10-01T10:00:00.000Z", [], ["ssr:vue"], [entry]);
    const removed = partial("compile", "2026-10-01T11:00:00.000Z", [], ["compile"], []);
    expect(mergeMatrices([quarantined]).quarantine).toEqual([entry]);
    expect(mergeMatrices([removed, quarantined]).quarantine).toEqual([]);
    expect(() => mergeMatrices([{ ...failing, version: 1 } as never])).toThrow(/version 1/);
  });

  it("adds up the scenarios of every run, as it keeps the cells a newer run did not record", () => {
    const first = partial("browser-vue", "2026-10-01T10:00:00.000Z", [
      { project: "browser:vue", record: checked("vue", ["initial"]) },
    ]);
    const second = partial("browser-vue", "2026-10-01T11:00:00.000Z", [
      { project: "browser:vue", record: checked("vue", ["rerendered"]) },
      { project: "browser:react", record: checked("react", ["initial"]) },
    ]);
    const { matrix } = mergeMatrices([second, first]);
    expect(matrix.scenarios).toEqual({
      "basics/hello": { react: ["initial"], vue: ["initial", "rerendered"] },
    });
  });

  it("takes the reference of the newest run that has one", () => {
    const outside = partial("compile", "2026-10-01T12:00:00.000Z", [], ["compile"], [], null);
    const harness = partial("all", "2026-10-01T11:00:00.000Z", [], ["compile"], [], "vue");
    expect(mergeMatrices([outside, harness]).reference).toBe("vue");
    expect(mergeMatrices([outside]).reference).toBeNull();
  });
});

describe("narrowing", () => {
  it("says why a run covered only part of its projects' tests, its shard included", () => {
    expect(narrowing({ filtered: null, shard: null })).toBeNull();
    expect(narrowing({ filtered: null, shard: { index: 2, count: 3 } })).toBe("shard 2/3");
    expect(narrowing({ filtered: "files matching hello", shard: { index: 1, count: 2 } })).toBe(
      "files matching hello; shard 1/2",
    );
  });
});

describe("withoutProjects", () => {
  it("drops a project's records and recomputes the merged cells", () => {
    const matrix = {
      ...partial("all", "2026-10-01T10:00:00.000Z", [
        { project: "compile", record: record("vue", { L2: { status: "pass" } }) },
        { project: "browser:vue", record: checked("vue", ["initial"]) },
      ]),
      empty: ["browser:vue"],
    };
    const kept = withoutProjects(matrix, new Set(["browser:vue"]));
    expect(kept?.projects).toEqual(["compile"]);
    expect(kept?.empty).toEqual([]);
    expect(kept?.cases).toEqual({ "basics/hello": { vue: { L2: "pass" } } });
    expect(kept?.scenariosByProject).toEqual({ compile: {} });
    expect(kept?.scenarios).toEqual({});
    expect(withoutProjects(matrix, new Set(["ssr:vue"]))).toBe(matrix);
    expect(withoutProjects(matrix, new Set(["compile", "browser:vue"]))).toBeUndefined();
  });
});

describe("settleQuarantine", () => {
  const entry: QuarantineEntry = {
    case: "basics/hello",
    target: "react",
    layer: "L13",
    reason: "a browser-only warning",
    issue: "#12",
  };

  it("keeps a cell quarantined when one of its records still fails and another passes", () => {
    const cells = buildCells([
      record("react", { L13: { status: "pass" } }),
      record("react", { L13: { status: "quarantined", issue: "#12" } }),
    ]);
    expect(settleQuarantine(cells, [entry], { stale: true })).toEqual([]);
    expect(cells["basics/hello"]?.react?.L13).toBe("quarantined(#12)");
  });

  it("fails a cell whose every record passes: the entry is stale", () => {
    const cells = buildCells([
      record("react", { L13: { status: "pass" } }),
      record("react", { L13: { status: "pass" } }),
    ]);
    const problems = settleQuarantine(cells, [entry], { stale: true });
    expect(problems).toEqual([expect.stringMatching(/^stale quarantine entry: remove it\./)]);
    expect(cells["basics/hello"]?.react?.L13).toMatch(/^fail: stale quarantine entry/);
  });

  it("decides staleness only when asked: before every record is in, a pass says nothing", () => {
    const cells = buildCells([record("react", { L13: { status: "pass" } })]);
    expect(settleQuarantine(cells, [entry], { stale: false })).toEqual([]);
    expect(cells["basics/hello"]?.react?.L13).toBe("pass");
  });

  it("judges an older run's records by a newer quarantine", () => {
    // Failed under no entry, and an entry has been added since: quarantined.
    const failed = buildCells([record("react", { L13: { status: "fail", message: "late" } })]);
    expect(settleQuarantine(failed, [entry], { stale: false })).toEqual([]);
    expect(failed["basics/hello"]?.react?.L13).toBe("quarantined(#12)");
    // Quarantined under an entry that has been removed since: a failure, whose message the
    // record no longer has.
    const quarantined = buildCells([
      record("react", { L13: { status: "quarantined", issue: "#12" } }),
    ]);
    expect(settleQuarantine(quarantined, [], { stale: false })).toEqual([
      "quarantined for #12 by an older run, but no entry quarantines basics/hello › react › L13 any more: rerun its project to see the failure.",
    ]);
    expect(quarantined["basics/hello"]?.react?.L13).toMatch(/^fail: quarantined for #12/);
  });

  it("leaves a cell no test recorded alone", () => {
    const cells = buildCells([record("vue", { L13: { status: "pass" } })]);
    expect(settleQuarantine(cells, [entry], { stale: true })).toEqual([]);
    expect(cells["basics/hello"]?.react).toBeUndefined();
  });
});
