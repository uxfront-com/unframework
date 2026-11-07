// The parity reporter on Playwright's API, on fixtures with no browser: what a run's attachments say
// reaches the same matrix and the same refusals as under Vitest.
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { FullConfig, Suite, TestCase, TestResult } from "@playwright/test/reporter";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { RECORD_ATTACHMENT } from "../src/driver/records.ts";
import type { DriverRecord } from "../src/driver/records.ts";
import PlaywrightParityReporter from "../src/driver/reporter.ts";
import type { PlaywrightParityOptions } from "../src/driver/reporter.ts";
import type { HarnessContext } from "../src/harness.ts";
import type { PageTestRecord } from "../src/hosts/page/protocol.ts";

let reportsDir: string;
const casesDir = "/repo/cases";
const filepath = `${casesDir}/state/counter/counter.test.ts`;

const harness = {
  casesDir,
  reference: "vue",
  update: false,
  pixels: "live",
  canary: null,
  quarantine: [],
  cases: { "state/counter": {} },
} as unknown as HarnessContext;

const logged: string[] = [];

beforeEach(() => {
  reportsDir = mkdtempSync(join(tmpdir(), "uf-pw-reporter-"));
  logged.length = 0;
  vi.spyOn(console, "log").mockImplementation((line) => void logged.push(String(line)));
  vi.spyOn(console, "error").mockImplementation((line) => void logged.push(String(line)));
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(reportsDir, { recursive: true, force: true });
});

const testRecord = (name: string, overrides: Partial<PageTestRecord> = {}): PageTestRecord => ({
  kind: "test",
  filepath,
  name,
  fullName: `state/counter [vue] > ${name}`,
  state: "pass",
  meta: {
    uf: {
      case: "state/counter",
      target: "vue",
      layers: { L8: { status: "pass" } },
      scenarios: ["initial"],
    },
  },
  ...overrides,
});

const fileRecord = (
  overrides: Partial<Extract<DriverRecord, { kind: "file" }>> = {},
): DriverRecord => ({
  kind: "file",
  filepath,
  state: "pass",
  meta: {},
  uncaught: [],
  ...overrides,
});

const attach = (...records: DriverRecord[]): TestResult["attachments"] =>
  records.map((record) => ({
    name: RECORD_ATTACHMENT,
    contentType: "application/json",
    body: Buffer.from(JSON.stringify(record)),
  }));

/** A run of the reporter over one spec file's test per project. */
async function run(
  runs: { project?: string; records: DriverRecord[]; errors?: string[]; parallelIndex?: number }[],
  options: Partial<PlaywrightParityOptions> = {},
  config: Partial<FullConfig> = {},
  declared?: number,
) {
  const reporter = new PlaywrightParityReporter({ reportsDir, harness, ...options });
  const names = [...new Set(runs.map(({ project = "browser:vue" }) => project))];
  const suite = {
    suites: names.map((title) => ({
      title,
      allTests: () =>
        Array.from({
          length:
            declared ?? runs.filter(({ project = "browser:vue" }) => project === title).length,
        }),
    })),
  } as unknown as Suite;
  reporter.onBegin({ shard: null, ...config } as FullConfig, suite);
  for (const { project = "browser:vue", records, errors = [], parallelIndex = 0 } of runs) {
    const test = {
      title: "cases/state/counter/counter.test.ts",
      parent: { project: () => ({ name: project }) },
    } as unknown as TestCase;
    const result = {
      parallelIndex,
      attachments: attach(...records),
      errors: errors.map((message) => ({ message })),
    } as unknown as TestResult;
    reporter.onTestBegin(test, result);
    reporter.onTestEnd(test, result);
  }
  return reporter.onEnd({ status: "failed" } as never);
}

function matrix(file = "parity-matrix.browser-vue.json") {
  return JSON.parse(readFileSync(join(reportsDir, file), "utf8")) as {
    run: string;
    projects: string[];
    cases: Record<string, Record<string, Record<string, string>>>;
    filtered: string | null;
    shard: unknown;
    tests: Record<string, Record<string, Record<string, unknown>>>;
  };
}

it("prints nothing itself, so --list's Total and Playwright's own progress show", async () => {
  expect(new PlaywrightParityReporter({ reportsDir, harness }).printsToStdio()).toBe(false);
});

it("writes the matrix under the project's name, from each test's record", async () => {
  const verdict = await run([{ records: [testRecord("increments"), fileRecord()] }]);
  expect(verdict).toBeUndefined();
  const written = matrix();
  expect(written.projects).toEqual(["browser:vue"]);
  expect(written.cases["state/counter"]?.vue).toEqual({ L8: "pass" });
  expect(written.tests["state/counter"]?.vue).toEqual({
    "state/counter > increments": { scenarios: ["initial"] },
  });
});

it("writes nothing in list mode, which still calls onEnd", async () => {
  const reporter = new PlaywrightParityReporter({ reportsDir, harness });
  reporter.onBegin(
    { shard: null } as FullConfig,
    { suites: [{ title: "browser:vue", allTests: () => [{}] }] } as unknown as Suite,
  );
  expect(await reporter.onEnd({ status: "passed" } as never)).toBeUndefined();
  expect(readdirSync(reportsDir)).toEqual([]);
  expect(logged).toEqual([]);
});

it("writes no matrix of a run that found no test", async () => {
  const reporter = new PlaywrightParityReporter({ reportsDir, harness });
  reporter.onBegin({ shard: null } as FullConfig, { suites: [] } as unknown as Suite);
  await reporter.onEnd({ status: "failed" } as never);
  expect(readdirSync(reportsDir)).toEqual([]);
});

it("writes no matrix of an interrupted run, and says so", async () => {
  const reporter = new PlaywrightParityReporter({ reportsDir, harness });
  reporter.onBegin({ shard: null } as FullConfig, { suites: [] } as unknown as Suite);
  await reporter.onEnd({ status: "interrupted" } as never);
  expect(readdirSync(reportsDir)).toEqual([]);
  expect(logged.join("\n")).toContain("interrupted");
});

it("fails the run on two tests of a case with one name", async () => {
  const verdict = await run([
    { records: [testRecord("same"), fileRecord()] },
    { records: [testRecord("same"), fileRecord()] },
  ]);
  expect(verdict).toEqual({ status: "failed" });
  expect(logged.join("\n")).toContain(
    'browser:vue: two tests of state/counter are named "state/counter > same"',
  );
});

it("fails the run on a silent skip", async () => {
  const verdict = await run([
    { records: [testRecord("never runs", { state: "skip", meta: {} }), fileRecord()] },
  ]);
  expect(verdict).toEqual({ status: "failed" });
  expect(logged.join("\n")).toContain("was skipped without recording why");
});

it("keeps that check on a run of some cases: a filter here never skips a test", async () => {
  const verdict = await run(
    [{ records: [testRecord("never runs", { state: "skip", meta: {} }), fileRecord()] }],
    { filter: "cases state/counter" },
  );
  expect(verdict).toEqual({ status: "failed" });
});

it("accepts a skip that records its reason on every layer", async () => {
  const skip = { status: "skip" as const, reason: "requires interactivity: static" };
  const verdict = await run([
    {
      records: [
        testRecord("skipped", {
          state: "skip",
          meta: { uf: { case: "state/counter", target: "vue", layers: { L8: skip } } },
        }),
        fileRecord(),
      ],
    },
  ]);
  expect(verdict).toBeUndefined();
});

it("takes a file-level record into the case's cell", async () => {
  await run([
    {
      records: [
        testRecord("renders"),
        fileRecord({
          state: "fail",
          meta: {
            uf: {
              case: "state/counter",
              target: "vue",
              layers: { L13: { status: "fail", message: "late warning" } },
            },
          },
        }),
      ],
    },
  ]);
  expect(matrix().cases["state/counter"]?.vue?.L13).toBe("fail: late warning");
});

it("fails an uncaught error, with its source, whatever the cells say", async () => {
  const verdict = await run([
    {
      records: [
        testRecord("renders"),
        fileRecord({
          uncaught: [
            {
              source: "page listener",
              name: "Error",
              message: "uf-probe-timer",
              test: "state/counter [vue] > renders",
            },
            { source: "pageerror", name: "Error", message: "uf-probe-boot" },
          ],
        }),
      ],
    },
  ]);
  expect(verdict).toEqual({ status: "failed" });
  expect(matrix().cases["state/counter"]?.vue).toEqual({ L8: "pass" });
  expect(logged).toContain(
    '[uf:parity] browser:vue: cases/state/counter/counter.test.ts: uncaught, seen by the page listener during "state/counter [vue] > renders": Error: uf-probe-timer',
  );
  expect(logged).toContain(
    "[uf:parity] browser:vue: cases/state/counter/counter.test.ts: uncaught, seen by the pageerror: Error: uf-probe-boot",
  );
});

it("fails a dead worker's unfinished tests by name, in the case's cell", async () => {
  const verdict = await run([
    {
      records: [
        {
          kind: "collected",
          filepath,
          tests: [
            { name: "first", fullName: "state/counter [vue] > first", timeout: 60_000 },
            { name: "second", fullName: "state/counter [vue] > second", timeout: 60_000 },
          ],
        },
        testRecord("first"),
      ],
      errors: ["Worker process exited unexpectedly"],
    },
  ]);
  // Playwright fails that test itself: the matrix is what's left to say it.
  expect(verdict).toBeUndefined();
  expect(matrix().cases["state/counter"]?.vue?.L8).toBe(
    'fail: "state/counter [vue] > second" did not finish: Worker process exited unexpectedly',
  );
});

it("logs how many workers ran a project, from parallelIndex", async () => {
  await run([
    { records: [testRecord("a"), fileRecord()], parallelIndex: 0 },
    { records: [testRecord("b"), fileRecord()], parallelIndex: 2 },
  ]);
  expect(logged).toContain("[uf:parity] workers used: 2 (browser:vue)");
});

it("names a shard's matrix, and doesn't call it filtered for having fewer specs", async () => {
  await run(
    [{ records: [testRecord("a"), fileRecord()] }],
    { specCount: 209 },
    { shard: { current: 2, total: 3 } },
  );
  const written = matrix("parity-matrix.browser-vue+shard-2-of-3.json");
  expect(written.shard).toEqual({ index: 2, count: 3 });
  expect(written.filtered).toBeNull();
});

it("names a run with fewer spec files than the corpus as filtered, however it was narrowed", async () => {
  await run([{ records: [testRecord("a"), fileRecord()] }], { specCount: 209 });
  const [file] = readdirSync(reportsDir);
  expect(file).toMatch(/^parity-matrix\.browser-vue\+filtered-/);
  expect(matrix(file).filtered).toBe("1 of 209 spec files of browser:vue");
});

it("is whole when every spec file of the corpus ran", async () => {
  await run([{ records: [testRecord("a"), fileRecord()] }], { specCount: 209 }, {}, 209);
  expect(matrix().filtered).toBeNull();
});

it("names the cases a filter keeps", async () => {
  await run([{ records: [testRecord("a"), fileRecord()] }], { filter: "cases state/counter" });
  expect(matrix(readdirSync(reportsDir)[0]).filtered).toBe("cases state/counter");
});

it("judges a stale quarantine entry on a complete run alone", async () => {
  const quarantined = {
    ...harness,
    quarantine: [
      { case: "state/counter", target: "vue", layer: "L8", reason: "fixture", issue: "#1" },
    ],
  } as HarnessContext;
  expect(
    await run([{ records: [testRecord("a"), fileRecord()] }], { harness: quarantined }),
  ).toBeUndefined();
  expect(
    await run([{ records: [testRecord("a"), fileRecord()] }], {
      harness: quarantined,
      allProjects: ["browser:vue"],
    }),
  ).toEqual({ status: "failed" });
  expect(logged.join("\n")).toContain("stale quarantine entry");
});

it("writes a canary's matrix and load failures to its directory", async () => {
  const canaryDir = join(reportsDir, "canary");
  await run(
    [
      {
        records: [
          fileRecord({
            state: "fail",
            errors: [{ name: "Error", message: "guard: the output isn't the golden" }],
          }),
        ],
      },
    ],
    { canaryDir, loadFailures: join(canaryDir, "load-failures.json") },
  );
  expect(existsSync(join(canaryDir, "parity-matrix.json"))).toBe(true);
  expect(JSON.parse(readFileSync(join(canaryDir, "load-failures.json"), "utf8"))).toEqual([
    {
      project: "browser:vue",
      file: "cases/state/counter/counter.test.ts",
      errors: ["guard: the output isn't the golden"],
    },
  ]);
});

it("writes an empty list of load failures when every spec loaded", async () => {
  const file = join(reportsDir, "canary", "load-failures.json");
  await run([{ records: [testRecord("a"), fileRecord()] }], {
    canaryDir: join(reportsDir, "canary"),
    loadFailures: file,
  });
  expect(JSON.parse(readFileSync(file, "utf8"))).toEqual([]);
});

it("fails a project whose specs recorded no test", async () => {
  const verdict = await run([{ records: [fileRecord()] }]);
  expect(verdict).toEqual({ status: "failed" });
  expect(logged.join("\n")).toContain("collected zero tests: browser:vue");
});
