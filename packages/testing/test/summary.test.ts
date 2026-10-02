import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { QuarantineEntry, UfLayerMeta } from "../src/layers.ts";
import { buildPartialMatrix, stringifyMatrix } from "../src/node/matrix.ts";
import type { PartialMatrix, RunMode, Shard } from "../src/node/matrix.ts";
import { summarise, writeSummary } from "../src/node/summary.ts";
import type { SummaryExpectations } from "../src/node/summary.ts";

const expected: SummaryExpectations = {
  projects: ["compile", "browser:vue"],
  cases: ["basics/hello"],
  targets: ["vue"],
  liveLayers: ["L1", "L7"],
  notLiveReason: "not live in M0",
};

const check: RunMode = { update: false, pixels: "baseline", canary: null };

function run(
  name: string,
  project: string,
  records: UfLayerMeta[],
  options: { at?: string; mode?: RunMode; quarantine?: QuarantineEntry[] } = {},
): PartialMatrix {
  return buildPartialMatrix({
    run: name,
    projects: [project],
    records: records.map((record) => ({ project, record })),
    finishedAt: options.at ?? "2026-10-01T10:00:00.000Z",
    mode: options.mode ?? check,
    filtered: null,
    shard: null,
    empty: [],
    quarantine: options.quarantine ?? [],
  });
}

/** A run of every project of `expected` (or of `projects`), filtered, sharded or neither. */
function everyProject(
  records: { project: string; record: UfLayerMeta }[],
  options: {
    at?: string;
    filtered?: string;
    shard?: Shard;
    projects?: string[];
    empty?: string[];
    quarantine?: QuarantineEntry[];
  } = {},
): PartialMatrix {
  const { shard = null, filtered = null } = options;
  return buildPartialMatrix({
    run: [
      "all",
      ...(shard ? [`shard-${shard.index}-of-${shard.count}`] : []),
      ...(filtered ? ["filtered-abc"] : []),
    ].join("+"),
    projects: options.projects ?? [...expected.projects],
    records,
    finishedAt: options.at ?? "2026-10-01T10:00:00.000Z",
    mode: check,
    filtered,
    shard,
    empty: options.empty ?? [],
    quarantine: options.quarantine ?? [],
  });
}

const hello = (layers: UfLayerMeta["layers"], target = "vue"): UfLayerMeta => ({
  case: "basics/hello",
  target,
  layers,
});
const nested = (layers: UfLayerMeta["layers"]): UfLayerMeta => ({
  case: "basics/nested",
  target: "vue",
  layers,
});
/** Passing records of each of `projects` on each case: L1 for compile, L7 for the others. */
const passing = (cases: readonly UfLayerMeta[], projects = expected.projects) =>
  cases.flatMap((record) =>
    projects.map((project) => ({
      project,
      record: {
        ...record,
        layers: { [project === "compile" ? "L1" : "L7"]: { status: "pass" } } as const,
      },
    })),
  );
/** A run's shard, as `everyProject` takes it. */
const shard = (index: number, count: number) => ({ shard: { index, count } });

const compile = run("compile", "compile", [hello({ L1: { status: "pass" } })]);
const browser = run("browser-vue", "browser:vue", [hello({ L7: { status: "pass" } })]);

describe("summarise", () => {
  it("merges partial runs and fills the layers that are not live", () => {
    const all = buildPartialMatrix({
      run: "all",
      projects: ["compile", "browser:vue"],
      records: [
        { project: "compile", record: hello({ L1: { status: "pass" } }) },
        { project: "browser:vue", record: hello({ L7: { status: "pass" } }) },
      ],
      finishedAt: "2026-10-01T10:00:00.000Z",
      mode: check,
      filtered: null,
      shard: null,
      empty: [],
      quarantine: [],
    });
    const result = summarise([all], expected);
    expect(result.complete).toBe(true);
    expect(result.problems).toEqual([]);
    expect(result.matrix.cases["basics/hello"]?.vue).toEqual({
      L1: "pass",
      L2: "skip(not live in M0)",
      L3: "skip(not live in M0)",
      L4: "skip(not live in M0)",
      L5: "skip(not live in M0)",
      L6: "skip(not live in M0)",
      L7: "pass",
      L8: "skip(not live in M0)",
      L9: "skip(not live in M0)",
      L10: "skip(not live in M0)",
      L11: "skip(not live in M0)",
      L12: "skip(not live in M0)",
      L13: "skip(not live in M0)",
      L14: "skip(not live in M0)",
      L15: "skip(not live in M0)",
    });
    expect(result.markdown).toContain("Every project ran: every cell is checked.");
    expect(result.markdown).toContain("| vue | pass | pass |");
    expect(result.markdown).toContain("### No problems");
  });

  it("says when the records come from several runs, each project's from its last", () => {
    const { markdown, complete } = summarise([compile, browser], expected);
    expect(complete).toBe(true);
    expect(markdown).toContain(
      "Every project has records, from 2 runs: every cell is checked, each against the last run of its project.",
    );
    expect(markdown).not.toContain("Every project ran");
  });

  it("says which runs it merged, and how they ran", () => {
    const update = run("browser-vue", "browser:vue", [hello({ L7: { status: "pass" } })], {
      at: "2026-10-01T11:00:00.000Z",
      mode: { update: true, pixels: "live", canary: null },
    });
    const { markdown, matrix } = summarise([update, compile], expected);
    expect(matrix.runs.map((info) => info.run)).toEqual(["compile", "browser-vue"]);
    expect(markdown).toContain(
      "- `compile` (check, baseline pixels), ended 2026-10-01T10:00:00.000Z: compile",
    );
    expect(markdown).toContain(
      "- `browser-vue` (update, live pixels), ended 2026-10-01T11:00:00.000Z",
    );
    expect(markdown).toContain("pass because it wrote them, not because it compared them");
  });

  it("reports missing live cells when every project ran", () => {
    const empty = run("browser-vue", "browser:vue", []);
    const result = summarise([compile, empty], expected);
    expect(result.problems).toEqual(["basics/hello › vue › L7: missing (no test recorded it)."]);
    expect(result.markdown).toContain("| vue | pass | **missing** |");
  });

  describe("a run that a filter narrowed (files, test names, a shard, --changed)", () => {
    const both = { ...expected, cases: ["basics/hello", "basics/nested"] };
    const filtered = everyProject(
      [
        { project: "compile", record: hello({ L1: { status: "pass" } }) },
        { project: "browser:vue", record: hello({ L7: { status: "pass" } }) },
      ],
      { filtered: "files matching cases/basics/hello", at: "2026-10-01T11:00:00.000Z" },
    );

    it("is partial: the cells it filtered out are not missing, and it says why", () => {
      const result = summarise([filtered], both);
      expect(result.complete).toBe(false);
      expect(result.problems).toEqual([]);
      expect(result.markdown).toContain(
        "Partial run: every project ran only in part (files matching cases/basics/hello), so missing cells and stale quarantine entries are not checked.",
      );
      expect(result.markdown).not.toContain("every cell is checked");
    });

    it("names the projects only it covered, when others ran in full", () => {
      const browserOnly: PartialMatrix = {
        ...filtered,
        projects: ["browser:vue"],
        byProject: { "browser:vue": filtered.byProject["browser:vue"]! },
      };
      const { markdown, complete } = summarise([compile, browserOnly], both);
      expect(complete).toBe(false);
      expect(markdown).toContain(
        "Partial run: 1 project(s) ran only in part (files matching cases/basics/hello: browser:vue)",
      );
    });

    it("decides no quarantine entry stale from the records it has", () => {
      const entry: QuarantineEntry = {
        case: "basics/hello",
        target: "vue",
        layer: "L7",
        reason: "known",
        issue: "#3",
      };
      const result = summarise([{ ...filtered, quarantine: [entry] }], both);
      expect(result.problems).toEqual([]);
      expect(result.matrix.cases["basics/hello"]?.vue?.L7).toBe("pass");
    });

    it("fails where every project must run all its tests (CI)", () => {
      const result = summarise([filtered], both, { requireComplete: true });
      expect(result.problems).toEqual([
        "compile: only filtered runs ran it (files matching cases/basics/hello), so not every cell is checked.",
        "browser:vue: only filtered runs ran it (files matching cases/basics/hello), so not every cell is checked.",
        "basics/nested › vue › L1: missing (no test recorded it).",
        "basics/nested › vue › L7: missing (no test recorded it).",
      ]);
    });

    it("refines a full run: every cell is still checked", () => {
      const full = everyProject([
        { project: "compile", record: hello({ L1: { status: "pass" } }) },
        {
          project: "compile",
          record: { case: "basics/nested", target: "vue", layers: { L1: { status: "pass" } } },
        },
        { project: "browser:vue", record: hello({ L7: { status: "fail", message: "old" } }) },
        {
          project: "browser:vue",
          record: { case: "basics/nested", target: "vue", layers: { L7: { status: "pass" } } },
        },
      ]);
      const result = summarise([full, filtered], both);
      expect(result.complete).toBe(true);
      expect(result.problems).toEqual([]);
      expect(result.matrix.cases["basics/hello"]?.vue?.L7).toBe("pass");
    });
  });

  describe("shards, which add up when every shard of one selection ran", () => {
    const both = { ...expected, cases: ["basics/hello", "basics/nested"] };
    const helloOnly = passing([hello({})]);
    const nestedOnly = passing([nested({})]);

    it("are a complete run once shards 1 to n of one count all reported", () => {
      const result = summarise(
        [
          everyProject(helloOnly, shard(1, 2)),
          everyProject(nestedOnly, { ...shard(2, 2), at: "2026-10-01T10:05:00.000Z" }),
        ],
        both,
        { requireComplete: true },
      );
      expect(result.problems).toEqual([]);
      expect(result.complete).toBe(true);
      expect(result.matrix.cases["basics/nested"]?.vue?.L7).toBe("pass");
      expect(result.markdown).toContain("Every project has records, from 2 runs");
      expect(result.markdown).toContain(
        "- `all+shard-1-of-2` (check, baseline pixels; only shard 1/2)",
      );
    });

    it("are partial while a shard is missing, and say which", () => {
      const result = summarise(
        [everyProject(helloOnly, shard(1, 3)), everyProject([], shard(3, 3))],
        both,
        { requireComplete: true },
      );
      expect(result.complete).toBe(false);
      expect(result.problems).toEqual([
        "compile: only filtered runs ran it (shard 1/3, shard 3/3 without shard 2/3), so not every cell is checked.",
        "browser:vue: only filtered runs ran it (shard 1/3, shard 3/3 without shard 2/3), so not every cell is checked.",
        "basics/nested › vue › L1: missing (no test recorded it).",
        "basics/nested › vue › L7: missing (no test recorded it).",
      ]);
    });

    it("only add up within one count", () => {
      const mixed = [everyProject(helloOnly, shard(1, 2)), everyProject(nestedOnly, shard(2, 3))];
      const partial = summarise(mixed, both);
      expect(partial.complete).toBe(false);
      expect(partial.markdown).toContain(
        "every project ran only in part (shard 1/2 without shard 2/2; shard 2/3 without shard 1/3, shard 3/3)",
      );
      // Shards 1/2 and 2/2 make a whole, whatever else ran.
      const whole = summarise([...mixed, everyProject(nestedOnly, shard(2, 2))], both);
      expect(whole.complete).toBe(true);
      expect(whole.problems).toEqual([]);
    });

    it("only add up within one selection of projects, without any other filter", () => {
      // Vitest cuts the files of the selected projects together: another selection, another cut.
      const browserOnly = everyProject(passing([nested({})], ["browser:vue"]), {
        ...shard(2, 2),
        projects: ["browser:vue"],
      });
      const compileRun = run("compile", "compile", [
        hello({ L1: { status: "pass" } }),
        nested({ L1: { status: "pass" } }),
      ]);
      const reselected = summarise(
        [compileRun, everyProject(helloOnly, shard(1, 2)), browserOnly],
        both,
      );
      expect(reselected.complete).toBe(false);
      expect(reselected.markdown).toContain(
        "1 project(s) ran only in part (shard 1/2 without shard 2/2; shard 2/2 without shard 1/2: browser:vue)",
      );
      const filtered = summarise(
        [
          everyProject(helloOnly, { ...shard(1, 2), filtered: "tests named /renders/" }),
          everyProject(nestedOnly, shard(2, 2)),
        ],
        both,
      );
      expect(filtered.complete).toBe(false);
      expect(filtered.markdown).toContain(
        "every project ran only in part (tests named /renders/; shard 1/2; shard 2/2 without shard 1/2)",
      );
    });

    it("decide a quarantine entry stale from the records of every shard", () => {
      const entry: QuarantineEntry = {
        case: "basics/nested",
        target: "vue",
        layer: "L7",
        reason: "known",
        issue: "#9",
      };
      const result = summarise(
        [
          everyProject(helloOnly, { ...shard(1, 2), quarantine: [entry] }),
          everyProject(nestedOnly, { ...shard(2, 2), quarantine: [entry] }),
        ],
        both,
      );
      expect(result.problems).toEqual([
        expect.stringMatching(
          /^basics\/nested › vue › L7: fail: stale quarantine entry: remove it\./,
        ),
      ]);
    });

    it("fail a project that no shard collected a test of", () => {
      const result = summarise(
        [
          everyProject(passing([hello({})], ["compile"]), {
            ...shard(1, 2),
            empty: ["browser:vue"],
          }),
          everyProject(passing([nested({})], ["compile"]), {
            ...shard(2, 2),
            empty: ["browser:vue"],
          }),
        ],
        both,
      );
      expect(result.problems).toEqual([
        "browser:vue: collected zero tests in every shard. A project that runs nothing verifies nothing.",
        "basics/hello › vue › L7: missing (no test recorded it).",
        "basics/nested › vue › L7: missing (no test recorded it).",
      ]);
    });
  });

  it("does not check completeness for a partial run, and says so", () => {
    const result = summarise([compile], expected);
    expect(result.complete).toBe(false);
    expect(result.problems).toEqual([]);
    expect(result.markdown).toContain("Partial run: 1 project(s) did not run (browser:vue)");
  });

  it("fails an incomplete run when every project must have run (CI)", () => {
    const result = summarise([compile], expected, { requireComplete: true });
    expect(result.complete).toBe(false);
    expect(result.problems).toEqual([
      "browser:vue: did not run (no parity matrix has its records).",
      "basics/hello › vue › L7: missing (no test recorded it).",
    ]);
    expect(result.markdown).toContain("Incomplete: 1 project(s) did not run (browser:vue)");
  });

  it("lists why cells are skipped or quarantined once, under the table", () => {
    const entry: QuarantineEntry = {
      case: "basics/hello",
      target: "react",
      layer: "L1",
      reason: "known",
      issue: "#12",
    };
    const skipped = run(
      "browser-vue",
      "browser:vue",
      [
        hello({ L7: { status: "skip", reason: "no output" } }),
        hello({ L1: { status: "quarantined", issue: "#12" } }, "react"),
      ],
      { quarantine: [entry] },
    );
    const result = summarise([{ ...compile, quarantine: [entry] }, skipped], {
      ...expected,
      targets: ["react", "vue"],
    });
    expect(result.markdown).toContain("| react | quarantined | **missing** |");
    expect(result.markdown).toContain("| vue | pass | skip |");
    expect(result.markdown).toContain("- quarantined: #12: L1 on react.");
    expect(result.markdown).toContain("- skipped: no output: L7 on vue.");
  });

  it("reports failures by their first line, and unknown cases", () => {
    const failing = run("browser-vue", "browser:vue", [
      hello({ L7: { status: "fail", message: "dom differs\n- a\n+ b" } }),
      { case: "basics/gone", target: "vue", layers: { L1: { status: "pass" } } },
    ]);
    const result = summarise([compile, failing], expected);
    expect(result.problems).toEqual([
      "basics/gone: recorded, but not a case in the corpus.",
      "basics/hello › vue › L7: fail: dom differs (+2 more line(s))",
    ]);
    expect(result.markdown).toContain("| vue | pass | **FAIL** |");
    expect(result.matrix.cases["basics/hello"]?.vue?.L7).toBe("fail: dom differs\n- a\n+ b");
  });

  describe("the quarantine, per cell across runs", () => {
    const entry: QuarantineEntry = {
      case: "basics/hello",
      target: "vue",
      layer: "L7",
      reason: "known",
      issue: "#7",
    };
    const projects = { ...expected, projects: ["compile", "browser:vue", "ssr:vue"] };
    const ssr = (outcome: UfLayerMeta["layers"]) =>
      run("ssr-vue", "ssr:vue", [hello(outcome)], { quarantine: [entry] });
    // Every run of one checkout applies the same quarantine.
    const compileQ = { ...compile, quarantine: [entry] };

    it("keeps an entry one project's record still needs", () => {
      const quarantined = run(
        "browser-vue",
        "browser:vue",
        [hello({ L7: { status: "quarantined", issue: "#7" } })],
        {
          quarantine: [entry],
        },
      );
      const result = summarise([compileQ, quarantined, ssr({ L7: { status: "pass" } })], projects);
      expect(result.problems).toEqual([]);
      expect(result.matrix.cases["basics/hello"]?.vue?.L7).toBe("quarantined(#7)");
    });

    it("fails a stale entry once every project ran and none of its records fails", () => {
      const passing = run("browser-vue", "browser:vue", [hello({ L7: { status: "pass" } })], {
        quarantine: [entry],
      });
      const result = summarise([compileQ, passing, ssr({ L7: { status: "pass" } })], projects);
      expect(result.problems).toEqual([
        expect.stringMatching(
          /^basics\/hello › vue › L7: fail: stale quarantine entry: remove it\./,
        ),
      ]);
    });

    it("does not decide staleness before every project ran", () => {
      const passing = run("browser-vue", "browser:vue", [hello({ L7: { status: "pass" } })], {
        quarantine: [entry],
      });
      const result = summarise([compileQ, passing], projects);
      expect(result.problems).toEqual([]);
      expect(result.markdown).toContain(
        "The quarantine entry of the newest run judges every record, but is not checked for staleness",
      );
    });

    describe("when an entry was removed between two merged runs", () => {
      const react: QuarantineEntry = { ...entry, target: "react" };
      const reactProjects = {
        ...expected,
        projects: ["compile", "browser:react"],
        targets: ["react"],
      };
      const older = run("all", "compile", [hello({ L1: { status: "pass" } }, "react")], {
        quarantine: [react],
      });
      const newer = (outcome: UfLayerMeta["layers"]) =>
        run("browser-react", "browser:react", [hello(outcome, "react")], {
          at: "2026-10-01T11:00:00.000Z",
        });

      it("does not quarantine a cell that still fails", () => {
        const result = summarise(
          [older, newer({ L7: { status: "fail", message: "dom differs" } })],
          reactProjects,
        );
        expect(result.matrix.cases["basics/hello"]?.react?.L7).toBe("fail: dom differs");
        expect(result.problems).toEqual(["basics/hello › react › L7: fail: dom differs"]);
      });

      it("does not call the removed entry stale once the cell passes", () => {
        const result = summarise([older, newer({ L7: { status: "pass" } })], reactProjects);
        expect(result.problems).toEqual([]);
      });

      it("fails a cell an older run recorded under the removed entry", () => {
        const recorded = run(
          "browser-react",
          "browser:react",
          [hello({ L7: { status: "quarantined", issue: "#7" } }, "react")],
          { quarantine: [react] },
        );
        const removed = run("compile", "compile", [hello({ L1: { status: "pass" } }, "react")], {
          at: "2026-10-01T11:00:00.000Z",
        });
        expect(summarise([recorded, removed], reactProjects).problems).toEqual([
          "basics/hello › react › L7: fail: quarantined for #7 by an older run, but no entry quarantines basics/hello › react › L7 any more: rerun its project to see the failure.",
        ]);
      });
    });
  });
});

describe("writeSummary", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const reports = () => {
    const root = mkdtempSync(join(tmpdir(), "uf-summary-"));
    const reportsDir = join(root, ".reports");
    mkdirSync(reportsDir);
    return { root, reportsDir };
  };

  it("writes the merged matrix and its Markdown, and appends to the step summary", () => {
    const { root, reportsDir } = reports();
    writeFileSync(join(reportsDir, "parity-matrix.compile.json"), stringifyMatrix(compile));
    writeFileSync(join(reportsDir, "parity-matrix.browser-vue.json"), stringifyMatrix(browser));
    const stepSummary = join(root, "step-summary.md");
    writeFileSync(stepSummary, "# Earlier step\n");
    const result = writeSummary({ reportsDir, expected, stepSummary });
    expect(JSON.parse(readFileSync(join(reportsDir, "parity-matrix.json"), "utf8"))).toEqual(
      result.matrix,
    );
    expect(readFileSync(join(reportsDir, "parity-matrix.md"), "utf8")).toBe(result.markdown);
    expect(readFileSync(stepSummary, "utf8")).toBe(`# Earlier step\n${result.markdown}\n`);
  });

  it("summarises only the runs that ended since a time, and fails when there is none", () => {
    const { reportsDir } = reports();
    writeFileSync(join(reportsDir, "parity-matrix.compile.json"), stringifyMatrix(compile));
    const later = run("browser-vue", "browser:vue", [hello({ L7: { status: "pass" } })], {
      at: "2026-10-01T12:00:00.000Z",
    });
    writeFileSync(join(reportsDir, "parity-matrix.browser-vue.json"), stringifyMatrix(later));
    const since = new Date("2026-10-01T11:00:00.000Z");
    expect(writeSummary({ reportsDir, expected, since }).matrix.projects).toEqual(["browser:vue"]);
    expect(() =>
      writeSummary({ reportsDir, expected, since: new Date("2026-10-01T13:00:00.000Z") }),
    ).toThrow(/No run wrote a parity matrix .* since 2026-10-01T13:00:00\.000Z/);
  });

  it("requires every project when CI is set, unless told otherwise", () => {
    const { reportsDir } = reports();
    writeFileSync(join(reportsDir, "parity-matrix.compile.json"), stringifyMatrix(compile));
    const missing = "browser:vue: did not run (no parity matrix has its records).";
    vi.stubEnv("CI", "true");
    expect(writeSummary({ reportsDir, expected }).problems).toContain(missing);
    expect(writeSummary({ reportsDir, expected, requireComplete: false }).problems).toEqual([]);
    vi.stubEnv("CI", "");
    expect(writeSummary({ reportsDir, expected }).problems).toEqual([]);
    expect(writeSummary({ reportsDir, expected, requireComplete: true }).problems).toContain(
      missing,
    );
  });

  it("fails loudly when no run wrote a matrix, or one is of an older format", () => {
    const { reportsDir } = reports();
    expect(() => writeSummary({ reportsDir, expected })).toThrow(/No parity-matrix/);
    writeFileSync(
      join(reportsDir, "parity-matrix.all.json"),
      JSON.stringify({ version: 1, run: "all", projects: [], cases: {} }),
    );
    expect(() => writeSummary({ reportsDir, expected })).toThrow(/version 1, not 3/);
  });
});
