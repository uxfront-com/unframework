// The parity reporter on Playwright's API: reads what each spec file's page left (`./records.ts`)
// and settles the run as `ParityReporter` does (`../node/reporter.ts`), into the same matrix. Beside
// that, an error nothing caught in a page is printed with its source and fails the run, whatever
// its cells say, and `workers used:` says how many pages ran at once.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";

import type { HarnessContext } from "../harness.ts";
import type { PageCollectedTest, PageTestRecord } from "../hosts/page/protocol.ts";
import { settleRun } from "../node/reporter.ts";
import type { ParityReporterOptions, ReportedFile } from "../node/reporter.ts";
import { RECORD_ATTACHMENT, unfinishedRecord, unfinishedTests } from "./records.ts";
import type { DriverFileRecord, DriverRecord, UncaughtError } from "./records.ts";

/** Options for {@link PlaywrightParityReporter}. */
export interface PlaywrightParityOptions extends ParityReporterOptions {
  /** The run's context, for the quarantine and the references. */
  harness: HarnessContext;
  /** Why the run covers some cases alone, when it does. */
  filter?: string;
  /** Every spec file a project declares when nothing narrows it: fewer is a filter too. */
  specCount?: number;
  /** A canary run's specs that could not load go here, as `harness/load-failures.ts` reads them. */
  loadFailures?: string;
  /** Each test's record goes here, for the tests that read a test's state. */
  recordsFile?: string;
}

/** One spec file's test, as the reporter reads it. */
export interface ReportedSpec {
  project: string;
  /** The spec file, absolute, or the test's title where the page said nothing. */
  filepath: string;
  tests: PageTestRecord[];
  file: DriverFileRecord;
}

/** What a file's test left, read back from its attachments, with what a dead worker never wrote. */
export function readSpec(
  project: string,
  title: string,
  result: Pick<TestResult, "attachments" | "errors">,
  context: { harness: HarnessContext; target: string },
): ReportedSpec {
  const records = result.attachments
    .filter(({ name, body }) => name === RECORD_ATTACHMENT && body)
    .map(({ body }) => JSON.parse(body!.toString("utf8")) as DriverRecord);
  const tests = records.filter((record) => record.kind === "test");
  const file = records.find((record) => record.kind === "file");
  if (file) return { project, filepath: file.filepath, tests, file };
  // The worker went before its driver finished: nothing else names what it left.
  const reason =
    result.errors.map(({ message }) => message).join("\n") || "its worker stopped without a word.";
  const collected: PageCollectedTest[] = records.flatMap((record) =>
    record.kind === "collected" ? record.tests : [],
  );
  const filepath =
    records.find((record) => record.kind === "collected")?.filepath ??
    join(dirname(context.harness.casesDir), title);
  return {
    project,
    filepath,
    tests: [
      ...tests,
      ...unfinishedTests(collected, tests).map((test) =>
        unfinishedRecord(test, {
          filepath,
          target: context.target,
          harness: context.harness,
          reason,
        }),
      ),
    ],
    file: {
      kind: "file",
      filepath,
      state: "fail",
      meta: {},
      uncaught: [],
      errors: [{ name: "Error", message: reason }],
    },
  };
}

/** The `browser:<target>` a project name holds, or the name itself for a stub project. */
function targetOf(project: string, harness: HarnessContext): string {
  return project.startsWith("browser:") ? project.slice("browser:".length) : harness.reference;
}

/** A spec file's own record of each test, as the shared rules read it. */
function reportedFile(spec: ReportedSpec): ReportedFile {
  return {
    project: spec.project,
    ...(spec.file.meta.uf ? { record: spec.file.meta.uf } : {}),
    tests: spec.tests.map((test) => ({
      project: spec.project,
      fullName: test.fullName,
      skipped: test.state === "skip",
      ...(test.meta.uf ? { record: test.meta.uf } : {}),
    })),
  };
}

/** The lines an uncaught error prints, naming where it was seen. */
export function uncaughtLine(project: string, file: string, error: UncaughtError): string {
  const during = error.test === undefined ? "" : ` during "${error.test}"`;
  return `${project}: ${file}: uncaught, seen by the ${error.source}${during}: ${error.name ?? "Error"}: ${error.message}`;
}

/** The parity reporter. Name its file in Playwright's `reporter` option. */
export default class PlaywrightParityReporter implements Reporter {
  readonly #options: PlaywrightParityOptions;
  readonly #specs: ReportedSpec[] = [];
  readonly #workers = new Map<string, Set<number>>();
  readonly #declared = new Map<string, number>();
  #shard: { index: number; count: number } | null = null;
  #ended = 0;

  constructor(options: PlaywrightParityOptions) {
    this.#options = options;
  }

  /** Not false would keep Playwright from printing `--list`'s `Total:`, and its own progress. */
  printsToStdio(): boolean {
    return false;
  }

  onBegin(config: FullConfig, suite: Suite): void {
    this.#shard = config.shard ? { index: config.shard.current, count: config.shard.total } : null;
    for (const project of suite.suites) {
      this.#declared.set(project.title, project.allTests().length);
    }
  }

  onTestBegin(test: TestCase, result: TestResult): void {
    const project = test.parent.project()?.name ?? "";
    const seen = this.#workers.get(project) ?? new Set<number>();
    seen.add(result.parallelIndex);
    this.#workers.set(project, seen);
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.#ended += 1;
    const project = test.parent.project()?.name ?? "";
    const { harness } = this.#options;
    this.#specs.push(
      readSpec(project, test.title, result, { harness, target: targetOf(project, harness) }),
    );
  }

  /** Why a run covers part of its projects' specs besides its shard, or `null`. */
  #filtered(): string | null {
    const { filter, specCount } = this.#options;
    if (filter) return filter;
    if (specCount === undefined || this.#shard) return null;
    const short = [...this.#declared].filter(([, count]) => count < specCount);
    return short.length
      ? `${short.map(([name, count]) => `${count} of ${specCount} spec files of ${name}`).join(", ")}`
      : null;
  }

  async onEnd(result: FullResult): Promise<{ status: FullResult["status"] } | undefined> {
    if (result.status === "interrupted") {
      console.error("[uf:parity] The run was interrupted: no parity matrix written.");
      return undefined;
    }
    // `--list` calls this too, and it passes with nothing run. A run that found no test fails with
    // nothing run: Playwright says why, and a matrix of nothing would say it passed.
    if (!this.#ended && (result.status === "passed" || !this.#declared.size)) return undefined;
    const { harness } = this.#options;
    const { problems } = settleRun(
      {
        projects: [...this.#declared.keys()].toSorted(),
        harness,
        filtered: this.#filtered(),
        shard: this.#shard,
        files: this.#specs.map(reportedFile),
        // A filter here picks spec files, never a test inside one: every skip still needs its reason.
        checksSkips: true,
        casesOf: () => undefined,
        log: (message) => console.log(message),
        error: (message) => console.error(message),
      },
      this.#options,
    );
    for (const [project, workers] of this.#workers) {
      console.log(`[uf:parity] workers used: ${workers.size} (${project})`);
    }
    const root = dirname(harness.casesDir);
    const display = (file: string) => relative(root, file).split(sep).join("/");
    const uncaught = this.#specs.flatMap((spec) =>
      spec.file.uncaught.map((error) => uncaughtLine(spec.project, display(spec.filepath), error)),
    );
    for (const line of uncaught) console.log(`[uf:parity] ${line}`);
    this.#writeLoadFailures(display);
    this.#writeRecords(display);
    return problems.length || uncaught.length ? { status: "failed" } : undefined;
  }

  /** The specs with an error of the file's own, as `LoadFailureReporter` writes them under Vitest. */
  #writeLoadFailures(display: (file: string) => string): void {
    const { loadFailures } = this.#options;
    if (!loadFailures) return;
    const failures = this.#specs
      .map((spec) => ({
        project: spec.project,
        file: display(spec.filepath),
        errors: (spec.file.errors ?? []).map(({ message }) => message),
      }))
      .filter(({ errors }) => errors.length > 0)
      .toSorted((a, b) => a.project.localeCompare(b.project) || a.file.localeCompare(b.file));
    mkdirSync(dirname(loadFailures), { recursive: true });
    writeFileSync(loadFailures, `${JSON.stringify(failures, null, 2)}\n`);
  }

  #writeRecords(display: (file: string) => string): void {
    const { recordsFile } = this.#options;
    if (!recordsFile) return;
    const specs = this.#specs
      .map((spec) => ({ ...spec, filepath: display(spec.filepath) }))
      .toSorted((a, b) => a.filepath.localeCompare(b.filepath));
    mkdirSync(dirname(recordsFile), { recursive: true });
    writeFileSync(recordsFile, `${JSON.stringify(specs, null, 2)}\n`);
  }
}
