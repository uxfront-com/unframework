import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HarnessContext } from "../src/harness.ts";
import type { QuarantineEntry, UfLayerMeta } from "../src/layers.ts";
import { buildPartialMatrix, MATRIX_VERSION, stringifyMatrix } from "../src/node/matrix.ts";
import type { PartialMatrix } from "../src/node/matrix.ts";
import { ParityReporter, readPartialMatrices, runName, testKey } from "../src/node/reporter.ts";
import { summarise } from "../src/node/summary.ts";

let root: string;
let reportsDir: string;
let logs: string[];
let errors: string[];
const exitCode = process.exitCode;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "uf-reporter-"));
  reportsDir = join(root, ".reports");
  logs = [];
  errors = [];
});

afterEach(() => {
  process.exitCode = exitCode;
});

type State = "passed" | "failed" | "skipped";

const test = (project: string, uf?: UfLayerMeta, state: State = "passed", name = "a test") => ({
  project: { name: project },
  fullName: name,
  meta: () => (uf ? { uf } : {}),
  result: () => ({ state }),
});
const testModule = (project: string, tests: ReturnType<typeof test>[], uf?: UfLayerMeta) => ({
  project: { name: project },
  meta: () => (uf ? { uf } : {}),
  children: { allTests: () => tests },
});

function harness(overrides: Partial<HarnessContext> = {}): HarnessContext {
  return {
    runId: "run-1",
    casesDir: join(root, "cases"),
    reference: "vue",
    update: false,
    pixels: "baseline",
    canary: null,
    baselineEnvironment: null,
    browser: "chromium",
    ledgerDir: join(root, ".reports", "ledger", "run-1"),
    liveDir: join(root, ".live", "run-1"),
    diffsDir: join(root, ".reports", "diffs", "run-1"),
    quarantine: [],
    cases: { "basics/hello": {} },
    ...overrides,
  };
}

const vitest = (
  projects: string[],
  options: {
    filenamePattern?: string[];
    testNamePattern?: RegExp;
    shard?: { index: number; count: number };
    changed?: boolean | string;
    related?: string[];
    tagsFilter?: string[];
    harness?: HarnessContext;
    /** Project → the cases the run adds it for alone (`ufOnly`). */
    only?: Record<string, string[]>;
    /** Project → the specs it includes, when not every case's. */
    include?: Record<string, string[]>;
  } = {},
) => ({
  projects: projects.map((name) => ({
    name,
    config: { root, include: options.include?.[name] ?? ["cases/**/*.test.ts"] },
    getProvidedContext: () => ({
      ...(options.harness ? { ufHarness: options.harness } : {}),
      ...(options.only?.[name] ? { ufOnly: options.only[name] } : {}),
    }),
  })),
  config: {
    ...(options.testNamePattern ? { testNamePattern: options.testNamePattern } : {}),
    ...(options.shard ? { shard: options.shard } : {}),
    ...(options.changed ? { changed: options.changed } : {}),
    ...(options.related ? { related: options.related } : {}),
    ...(options.tagsFilter ? { tagsFilter: options.tagsFilter } : {}),
  },
  logger: {
    log: (message: unknown) => logs.push(String(message)),
    error: (message: unknown) => errors.push(String(message)),
  },
  ...(options.filenamePattern ? { filenamePattern: options.filenamePattern } : {}),
});

const hello = (target: string, layers: UfLayerMeta["layers"]): UfLayerMeta => ({
  case: "basics/hello",
  target,
  layers,
});

/** A target's (case, target) pairs of the two cases a run of some targets is tested with. */
const both = (target: string): [string, string][] => [
  ["basics/hello", target],
  ["semantics/listbox", target],
];

const read = (name: string): PartialMatrix =>
  JSON.parse(readFileSync(join(reportsDir, name), "utf8")) as PartialMatrix;

describe("ParityReporter", () => {
  it("writes the run's matrix per project, with how it ran, named `all` when every project ran", () => {
    const reporter = new ParityReporter({ reportsDir, allProjects: ["compile", "browser:vue"] });
    reporter.onInit(vitest(["compile", "browser:vue"], { harness: harness() }));
    reporter.onTestRunEnd(
      [
        testModule("compile", [
          test("compile", hello("vue", { L1: { status: "pass" } })),
          test("compile"),
        ]),
        testModule("browser:vue", [
          test(
            "browser:vue",
            {
              ...hello("vue", { L7: { status: "fail", message: "dom differs\nmore" } }),
              scenarios: ["initial"],
            },
            "failed",
          ),
        ]),
      ],
      [],
      "failed",
    );
    const matrix = read("parity-matrix.all.json");
    expect(matrix).toMatchObject({
      version: MATRIX_VERSION,
      run: "all",
      mode: { update: false, pixels: "baseline", canary: null },
      filtered: null,
      shard: null,
      projects: ["browser:vue", "compile"],
      empty: [],
      quarantine: [],
      reference: "vue",
      cases: { "basics/hello": { vue: { L1: "pass", L7: "fail: dom differs\nmore" } } },
      scenarios: { "basics/hello": { vue: ["initial"] } },
      byProject: {
        compile: { "basics/hello": { vue: { L1: "pass" } } },
        "browser:vue": { "basics/hello": { vue: { L7: "fail: dom differs\nmore" } } },
      },
      scenariosByProject: {
        compile: {},
        "browser:vue": { "basics/hello": { vue: ["initial"] } },
      },
    });
    expect(Date.parse(matrix.finishedAt)).toBeGreaterThan(0);
    expect(reporter.matrix).toEqual(matrix);
    expect(process.exitCode).toBe(exitCode);
  });

  it("fails the run loudly when a selected project collected zero tests", () => {
    const reporter = new ParityReporter({ reportsDir });
    reporter.onInit(vitest(["compile", "ssr:vue"]));
    reporter.onTestRunEnd([testModule("compile", [test("compile")])], [], "passed");
    expect(process.exitCode).toBe(1);
    expect(errors.join("\n")).toMatch(/1 selected project\(s\) collected zero tests: ssr:vue/);
  });

  it.each([
    ["a file filter", { filenamePattern: ["hello"] }, /files matching hello/],
    ["a test-name filter", { testNamePattern: /renders/ }, /tests named \/renders\//],
    ["--changed", { changed: true }, /files affected by uncommitted changes/],
    [
      "--changed since a commit",
      { changed: "main", related: ["src/a.ts"] },
      /^files affected by changes since main$/,
    ],
    ["vitest related", { related: ["src/a.ts"] }, /tests related to src\/a\.ts/],
    ["a tags filter", { tagsFilter: ["slow"] }, /tests tagged slow/],
  ])(
    "treats a run with %s as filtered: no empty-project failure, and it supersedes nothing",
    (_, filter, why) => {
      mkdirSync(reportsDir, { recursive: true });
      const earlier = buildPartialMatrix({
        run: "all",
        projects: ["compile", "ssr:vue"],
        records: [],
        finishedAt: "2026-10-01T10:00:00.000Z",
        mode: null,
        filtered: null,
        shard: null,
        empty: [],
        quarantine: [],
      });
      writeFileSync(join(reportsDir, "parity-matrix.all.json"), stringifyMatrix(earlier));
      const reporter = new ParityReporter({ reportsDir, allProjects: ["compile", "ssr:vue"] });
      reporter.onInit(vitest(["compile", "ssr:vue"], filter));
      reporter.onTestRunEnd(
        [testModule("compile", [test("compile"), test("compile", undefined, "skipped")])],
        [],
        "passed",
      );
      expect(process.exitCode).toBe(exitCode);
      expect(logs.join("\n")).toMatch(/Not checking for empty projects: the run covers only/);
      expect(reporter.matrix?.filtered).toMatch(why);
      expect(reporter.matrix?.shard).toBeNull();
      expect(reporter.matrix?.empty).toEqual(["ssr:vue"]);
      expect(reporter.matrix?.run).toMatch(/^all\+filtered-[0-9a-z]+$/);
      expect(read("parity-matrix.all.json")).toEqual(earlier);
    },
  );

  describe("a shard", () => {
    const all = ["compile", "ssr:vue"];
    const shardRun = (index: number, modules: ReturnType<typeof testModule>[]) => {
      const reporter = new ParityReporter({ reportsDir, allProjects: all });
      reporter.onInit(vitest(all, { shard: { index, count: 2 } }));
      reporter.onTestRunEnd(modules, [], "passed");
      return reporter.matrix!;
    };

    it("records its shard apart from any filter, and names its matrix after it", () => {
      mkdirSync(reportsDir, { recursive: true });
      const earlier = buildPartialMatrix({
        run: "all",
        projects: all,
        records: [],
        finishedAt: "2026-10-01T10:00:00.000Z",
        mode: null,
        filtered: null,
        shard: null,
        empty: [],
        quarantine: [],
      });
      writeFileSync(join(reportsDir, "parity-matrix.all.json"), stringifyMatrix(earlier));
      const first = shardRun(1, [testModule("compile", [test("compile")])]);
      const second = shardRun(2, [testModule("ssr:vue", [test("ssr:vue")])]);
      expect(first).toMatchObject({
        run: "all+shard-1-of-2",
        filtered: null,
        shard: { index: 1, count: 2 },
        empty: ["ssr:vue"],
      });
      expect(second).toMatchObject({ run: "all+shard-2-of-2", empty: ["compile"] });
      // Side by side, as CI's parity job downloads them; neither supersedes the full run.
      expect(readdirSync(reportsDir).sort()).toEqual([
        "parity-matrix.all+shard-1-of-2.json",
        "parity-matrix.all+shard-2-of-2.json",
        "parity-matrix.all.json",
      ]);
      expect(read("parity-matrix.all.json")).toEqual(earlier);
      // A shard may hold no file of a project: that is no failure of the shard.
      expect(process.exitCode).toBe(exitCode);
      expect(logs.join("\n")).toContain("the run covers only shard 1/2. Empty: ssr:vue.");
    });

    it("still fails a test skipped without recording why: a shard runs whole files", () => {
      shardRun(1, [
        testModule("compile", [test("compile", undefined, "skipped", "compile > a case")]),
      ]);
      expect(process.exitCode).toBe(1);
      expect(errors.join("\n")).toContain('"compile > a case" was skipped without recording why');
    });

    it("is also filtered when a filter narrowed it too", () => {
      const reporter = new ParityReporter({ reportsDir, allProjects: all });
      reporter.onInit(vitest(all, { shard: { index: 2, count: 2 }, filenamePattern: ["hello"] }));
      reporter.onTestRunEnd([testModule("compile", [test("compile")])], [], "passed");
      expect(reporter.matrix).toMatchObject({
        filtered: "files matching hello",
        shard: { index: 2, count: 2 },
      });
      expect(reporter.matrix?.run).toMatch(/^all\+shard-2-of-2\+filtered-[0-9a-z]+$/);
    });
  });

  it("records what a file recorded after its last test, with its tests' records", () => {
    // setup.ts records a console message logged after the last test on the file (its module).
    const late = hello("vue", { L13: { status: "fail", message: "after the last test: warn" } });
    const reporter = new ParityReporter({ reportsDir });
    reporter.onInit(vitest(["browser:vue"]));
    reporter.onTestRunEnd(
      [
        testModule(
          "browser:vue",
          [test("browser:vue", hello("vue", { L7: { status: "pass" }, L13: { status: "pass" } }))],
          late,
        ),
      ],
      [],
      "failed",
    );
    expect(reporter.matrix?.cases["basics/hello"]?.vue).toEqual({
      L7: "pass",
      L13: "fail: after the last test: warn",
    });
  });

  it("fails the run on a test skipped without recording why, and accepts one that did", () => {
    const reporter = new ParityReporter({ reportsDir });
    reporter.onInit(vitest(["browser:astro"]));
    reporter.onTestRunEnd(
      [
        testModule("browser:astro", [
          test("browser:astro", hello("astro", { L7: { status: "pass" } })),
          test("browser:astro", undefined, "skipped", "basics/hello [astro] > clicks"),
          test(
            "browser:astro",
            hello("astro", { L7: { status: "skip", reason: "needs interactivity" } }),
            "skipped",
            "basics/hello [astro] > types",
          ),
        ]),
      ],
      [],
      "passed",
    );
    expect(process.exitCode).toBe(1);
    expect(errors.join("\n")).toContain(
      'browser:astro: "basics/hello [astro] > clicks" was skipped without recording why',
    );
    expect(errors.join("\n")).not.toContain("> types");
  });

  it("names each test's record after the test, without the target describeTargets adds", () => {
    const reporter = new ParityReporter({ reportsDir });
    reporter.onInit(vitest(["browser:vue", "browser:astro"]));
    const skip = { status: "skip", reason: "requires interactivity: inert" } as const;
    reporter.onTestRunEnd(
      [
        testModule("browser:vue", [
          test(
            "browser:vue",
            { ...hello("vue", { L7: { status: "pass" } }), scenarios: ["after-click", "initial"] },
            "passed",
            "basics/hello [vue] > clicks",
          ),
        ]),
        testModule("browser:astro", [
          test(
            "browser:astro",
            { ...hello("astro", { L7: skip, L8: skip }), skipped: skip.reason },
            "skipped",
            "basics/hello [astro] > clicks",
          ),
        ]),
      ],
      [],
      "passed",
    );
    expect(reporter.matrix?.tests).toEqual({
      "basics/hello": {
        astro: { "basics/hello > clicks": { scenarios: [], skipped: skip.reason } },
        vue: { "basics/hello > clicks": { scenarios: ["after-click", "initial"] } },
      },
    });
    expect(reporter.matrix?.testsByProject["browser:astro"]).toEqual({
      "basics/hello": {
        astro: { "basics/hello > clicks": { scenarios: [], skipped: skip.reason } },
      },
    });
    expect(process.exitCode).toBe(exitCode);
  });

  it("fails the run when two tests of a case share a name", () => {
    const reporter = new ParityReporter({ reportsDir });
    reporter.onInit(vitest(["browser:vue"]));
    const record = { ...hello("vue", { L7: { status: "pass" } }), scenarios: ["initial"] };
    reporter.onTestRunEnd(
      [
        testModule("browser:vue", [
          test("browser:vue", record, "passed", "basics/hello [vue] > renders"),
          test("browser:vue", record, "passed", "basics/hello [vue] > renders"),
        ]),
      ],
      [],
      "passed",
    );
    expect(process.exitCode).toBe(1);
    expect(errors.join("\n")).toContain(
      'browser:vue: two tests of basics/hello are named "basics/hello > renders"',
    );
  });

  it("supersedes, project by project, the records of earlier runs of the projects it ran", () => {
    mkdirSync(reportsDir, { recursive: true });
    const earlier = (run: string, projects: string[]) =>
      writeFileSync(
        join(reportsDir, `parity-matrix.${run}.json`),
        stringifyMatrix(
          buildPartialMatrix({
            run,
            projects,
            records: projects.map((project) => ({
              project,
              record: hello("vue", { L7: { status: "fail", message: `old ${project}` } }),
            })),
            finishedAt: "2026-10-01T10:00:00.000Z",
            mode: null,
            filtered: null,
            shard: null,
            empty: [],
            quarantine: [],
          }),
        ),
      );
    earlier("compile", ["compile"]);
    earlier("all", ["compile", "browser:react"]);
    writeFileSync(
      join(reportsDir, "parity-matrix.older.json"),
      JSON.stringify({ version: 1, run: "older", projects: ["ssr:svelte"], cases: {} }),
    );
    const reporter = new ParityReporter({ reportsDir });
    reporter.onInit(vitest(["compile", "ssr:vue"]));
    reporter.onTestRunEnd(
      [testModule("compile", [test("compile")]), testModule("ssr:vue", [test("ssr:vue")])],
      [],
      "passed",
    );
    expect(readdirSync(reportsDir).sort()).toEqual([
      "parity-matrix.all.json",
      "parity-matrix.compile+ssr-vue.json",
    ]);
    const kept = read("parity-matrix.all.json");
    expect(kept.projects).toEqual(["browser:react"]);
    expect(kept.cases).toEqual({ "basics/hello": { vue: { L7: "fail: old browser:react" } } });
    expect(logs.join("\n")).toContain(
      "Removed parity-matrix.older.json: a matrix of an older format.",
    );
  });

  it("leaves an engine's merged matrix alone: it is no partial matrix", () => {
    mkdirSync(reportsDir, { recursive: true });
    const merged = JSON.stringify({ version: 5, run: "merged", projects: [], cases: {}, runs: [] });
    writeFileSync(join(reportsDir, "parity-matrix.firefox.json"), merged);
    expect(readPartialMatrices(reportsDir).size).toBe(0);
    const reporter = new ParityReporter({ reportsDir });
    reporter.onInit(vitest(["compile"]));
    reporter.onTestRunEnd([testModule("compile", [test("compile")])], [], "passed");
    expect(readFileSync(join(reportsDir, "parity-matrix.firefox.json"), "utf8")).toBe(merged);
    expect(readPartialMatrices(reportsDir).size).toBe(1);
  });

  describe("a run of some targets", () => {
    // `semantics/listbox` names React as its own reference, so a run of Vue alone adds React's
    // projects for that case alone (ADR-0057): the SSR one is told so, the browser one is not.
    // A function: `harness` reads the directory each test makes.
    const context = () =>
      harness({ cases: { "basics/hello": {}, "semantics/listbox": { reference: "react" } } });
    const kinds: Record<string, keyof UfLayerMeta["layers"]> = {
      compile: "L1",
      toolchain: "L3",
      ssr: "L6",
      browser: "L7",
    };
    const layerOf = (project: string) => kinds[project.split(":")[0]!]!;
    const all = [
      "compile",
      ...["toolchain", "ssr", "browser"].flatMap((kind) => [`${kind}:react`, `${kind}:vue`]),
    ];
    const record = (project: string, caseId: string, target: string, newer: boolean) =>
      test(project, {
        case: caseId,
        target,
        layers: {
          [layerOf(project)]: newer ? { status: "fail", message: "newer" } : { status: "pass" },
        },
      });
    const moduleOf = (project: string, cells: [string, string][], newer: boolean) =>
      testModule(
        project,
        cells.map(([caseId, target]) => record(project, caseId, target, newer)),
      );
    const live = (
      matrix: ReturnType<typeof summarise>["matrix"],
      caseId: string,
      target: string,
    ) => {
      const { L1, L3, L6, L7 } = matrix.cases[caseId]?.[target] ?? {};
      return { L1, L3, L6, L7 };
    };
    const newer = { L1: "fail: newer", L3: "fail: newer", L6: "fail: newer", L7: "fail: newer" };

    /**
     * A full run, then a run of Vue that selects `selected` (all of its projects by default), in
     * which React's projects record `react`; the summary.
     */
    const runs = (
      react: (project: string) => [string, string][],
      selected = all.filter((project) => project !== "toolchain:react"),
    ) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      try {
        vi.setSystemTime(new Date("2026-10-01T10:00:00.000Z"));
        const full = new ParityReporter({ reportsDir, allProjects: all });
        full.onInit(vitest(all, { harness: context() }));
        full.onTestRunEnd(
          [
            moduleOf("compile", [...both("react"), ...both("vue")], false),
            ...all
              .slice(1)
              .map((project) => moduleOf(project, both(project.split(":")[1]!), false)),
          ],
          [],
          "passed",
        );

        vi.setSystemTime(new Date("2026-10-01T11:00:00.000Z"));
        const narrowed = new ParityReporter({ reportsDir, allProjects: all });
        narrowed.onInit(
          vitest(selected, {
            harness: context(),
            only: { "ssr:react": ["semantics/listbox"] },
            include: { "browser:react": ["cases/semantics/listbox/listbox.test.ts"] },
          }),
        );
        narrowed.onTestRunEnd(
          [
            moduleOf("compile", both("vue"), true),
            moduleOf("toolchain:vue", both("vue"), true),
            moduleOf("ssr:vue", both("vue"), true),
            moduleOf("browser:vue", both("vue"), true),
            moduleOf("ssr:react", react("ssr:react"), true),
            moduleOf("browser:react", react("browser:react"), true),
          ].filter((module) => selected.includes(module.project.name)),
          [],
          "failed",
        );
        return summarise([...readPartialMatrices(reportsDir).values()], {
          projects: all,
          cases: ["basics/hello", "semantics/listbox"],
          targets: ["react", "vue"],
          liveLayers: ["L1", "L3", "L6", "L7"],
          notLiveReason: "not live",
        });
      } finally {
        vi.useRealTimers();
      }
    };

    it("keeps the cells of the targets and cases it did not re-judge", () => {
      const { matrix, problems } = runs(() => [["semantics/listbox", "react"]]);
      expect(live(matrix, "basics/hello", "react")).toEqual({
        L1: "pass",
        L3: "pass",
        L6: "pass",
        L7: "pass",
      });
      expect(live(matrix, "basics/hello", "vue")).toEqual(newer);
      expect(live(matrix, "semantics/listbox", "react")).toEqual({
        L1: "pass",
        L3: "pass",
        L6: "fail: newer",
        L7: "fail: newer",
      });
      expect(live(matrix, "semantics/listbox", "vue")).toEqual(newer);
      expect(problems.filter((problem) => problem.includes("missing"))).toEqual([]);
    });

    it("keeps them when a project it added for some cases recorded nothing", () => {
      // The listbox spec failed to load on React: the cases each React project was added for
      // come from the project itself, the SSR project's `ufOnly` and the browser project's
      // `include`.
      const { matrix, problems } = runs(() => []);
      expect(live(matrix, "basics/hello", "react")).toEqual({
        L1: "pass",
        L3: "pass",
        L6: "pass",
        L7: "pass",
      });
      const missing = problems.filter((problem) => problem.includes("missing"));
      expect(missing.length).toBeGreaterThan(0);
      expect(missing.every((problem) => problem.startsWith("semantics/listbox › react"))).toBe(
        true,
      );
      // compile, Vue's three projects, and React's SSR and browser ones, each of which loses
      // listbox; React's toolchain project did not run.
      expect(logs).toContain("[uf:parity] Superseded 6 project(s) of parity-matrix.all.json.");
    });

    it("keeps them when the run selects the browser projects alone", () => {
      // `--project 'browser:*'`: Vitest leaves `ssr:react` out of the run, so nothing but the
      // browser project's own `include` tells which cases it was added for.
      const { matrix } = runs(() => [], ["browser:react", "browser:vue"]);
      expect(live(matrix, "basics/hello", "react")).toEqual({
        L1: "pass",
        L3: "pass",
        L6: "pass",
        L7: "pass",
      });
      expect(live(matrix, "semantics/listbox", "react").L6).toBe("pass");
      expect(logs).toContain("[uf:parity] Superseded 2 project(s) of parity-matrix.all.json.");
    });

    it("counts only the projects that lost records", () => {
      // An older run's `compile` holds only React's cells, which a run of Vue does not re-judge;
      // its `browser:vue` holds only Vue's, which it does.
      const older = new ParityReporter({ reportsDir });
      older.onInit(vitest(["browser:vue", "compile", "ssr:react"], { harness: context() }));
      older.onTestRunEnd(
        [
          moduleOf("compile", both("react"), false),
          moduleOf("browser:vue", both("vue"), false),
          moduleOf("ssr:react", both("react"), false),
        ],
        [],
        "passed",
      );
      const newer = new ParityReporter({ reportsDir });
      newer.onInit(vitest(["browser:vue", "compile"], { harness: context() }));
      newer.onTestRunEnd(
        [moduleOf("compile", both("vue"), true), moduleOf("browser:vue", both("vue"), true)],
        [],
        "failed",
      );
      expect(logs).toContain(
        "[uf:parity] Superseded 1 project(s) of parity-matrix.browser-vue+compile+ssr-react.json.",
      );
      expect(read("parity-matrix.browser-vue+compile+ssr-react.json").projects).toEqual([
        "compile",
        "ssr:react",
      ]);
    });
  });

  describe("the quarantine", () => {
    const entry: QuarantineEntry = {
      case: "basics/hello",
      target: "vue",
      layer: "L13",
      reason: "a browser-only warning",
      issue: "#13",
    };
    const all = ["ssr:vue", "browser:vue"];

    it("keeps an entry a cell still needs when one project's record fails and another's passes", () => {
      const reporter = new ParityReporter({ reportsDir, allProjects: all });
      reporter.onInit(vitest(all, { harness: harness({ quarantine: [entry] }) }));
      reporter.onTestRunEnd(
        [
          testModule("ssr:vue", [test("ssr:vue", hello("vue", { L13: { status: "pass" } }))]),
          testModule("browser:vue", [
            test("browser:vue", hello("vue", { L13: { status: "quarantined", issue: "#13" } })),
          ]),
        ],
        [],
        "passed",
      );
      expect(process.exitCode).toBe(exitCode);
      expect(reporter.matrix?.cases["basics/hello"]?.vue?.L13).toBe("quarantined(#13)");
      expect(reporter.matrix?.quarantine).toEqual([entry]);
    });

    it("fails a complete run whose quarantined cell passes everywhere: the entry is stale", () => {
      const reporter = new ParityReporter({ reportsDir, allProjects: all });
      reporter.onInit(vitest(all, { harness: harness({ quarantine: [entry] }) }));
      reporter.onTestRunEnd(
        [
          testModule("ssr:vue", [test("ssr:vue", hello("vue", { L13: { status: "pass" } }))]),
          testModule("browser:vue", [
            test("browser:vue", hello("vue", { L13: { status: "pass" } })),
          ]),
        ],
        [],
        "passed",
      );
      expect(process.exitCode).toBe(1);
      expect(errors.join("\n")).toMatch(
        /stale quarantine entry: remove it\. basics\/hello › vue › L13 passes/,
      );
      expect(reporter.matrix?.cases["basics/hello"]?.vue?.L13).toMatch(/^fail: stale quarantine/);
    });

    it("leaves staleness to a run that has every record of the cell", () => {
      const reporter = new ParityReporter({ reportsDir, allProjects: all });
      reporter.onInit(vitest(["ssr:vue"], { harness: harness({ quarantine: [entry] }) }));
      reporter.onTestRunEnd(
        [testModule("ssr:vue", [test("ssr:vue", hello("vue", { L13: { status: "pass" } }))])],
        [],
        "passed",
      );
      expect(process.exitCode).toBe(exitCode);
      expect(reporter.matrix?.cases["basics/hello"]?.vue?.L13).toBe("pass");
    });
  });

  it("writes a canary run's matrix to the canary directory only", () => {
    const canaryDir = join(reportsDir, "..", ".canary", "L7-wrong-text");
    const reporter = new ParityReporter({ reportsDir, canaryDir });
    reporter.onInit(vitest(["browser:vue"]));
    reporter.onTestRunEnd(
      [
        testModule("browser:vue", [
          test("browser:vue", hello("vue", { L7: { status: "fail", message: "x" } }), "failed"),
        ]),
      ],
      [],
      "failed",
    );
    const matrix = JSON.parse(readFileSync(join(canaryDir, "parity-matrix.json"), "utf8"));
    expect(matrix.cases).toEqual({ "basics/hello": { vue: { L7: "fail: x" } } });
    expect(matrix.byProject["browser:vue"]).toEqual(matrix.cases);
    expect(existsSync(reportsDir)).toBe(false);
  });

  it("writes nothing for an interrupted run", () => {
    const reporter = new ParityReporter({ reportsDir });
    reporter.onInit(vitest(["compile"]));
    reporter.onTestRunEnd([], [], "interrupted");
    expect(existsSync(reportsDir)).toBe(false);
    expect(errors).toEqual(["[uf:parity] The run was interrupted: no parity matrix written."]);
  });

  it("refuses to report before it is initialised", () => {
    expect(() => new ParityReporter({ reportsDir }).onTestRunEnd([], [], "passed")).toThrow(
      /before onInit/,
    );
  });
});

describe("runName", () => {
  it("names a run after its projects", () => {
    expect(runName(["ssr:vue", "compile"])).toBe("compile+ssr-vue");
    expect(runName(["compile"], ["compile"])).toBe("all");
    expect(runName([])).toBe("none");
  });

  it("shortens long names with a stable hash", () => {
    const projects = Array.from({ length: 20 }, (_, i) => `browser:target-${i}`);
    const name = runName(projects);
    expect(name.length).toBeLessThanOrEqual(80);
    expect(runName([...projects].reverse())).toBe(name);
  });
});

describe("testKey", () => {
  it("takes the target out of the suite's name, wherever the suite nests", () => {
    expect(testKey("state/counter [vue] > increments", "vue")).toBe("state/counter > increments");
    expect(testKey("state/counter [vue] > a group > increments", "vue")).toBe(
      "state/counter > a group > increments",
    );
    expect(testKey("compile > basics/hello > basics/hello › vue", "vue")).toBe(
      "compile > basics/hello > basics/hello › vue",
    );
    // Only the suite's suffix: a test named after a target keeps its name.
    expect(testKey("state/counter [react] > renders [react] too", "react")).toBe(
      "state/counter > renders [react] too",
    );
  });
});
