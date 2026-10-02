// The specs a run could not load: a module that throws on import (as the golden guard makes a
// browser spec's component) has no test, so no cell of the parity matrix says why. A canary run
// writes them next to its matrix, where the verdict reads the evidence of a check that fails a
// spec's import (`Canary.loadEvidence`).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, sep } from "node:path";

/** The file a canary run writes its load failures to, in `.canary/<id>/`. */
export const LOAD_FAILURES = "load-failures.json";

/** A test module that failed before any of its tests ran. */
export interface LoadFailure {
  /** The Vitest project, such as `browser:react`. */
  project: string;
  /** The module, relative to the root, such as `cases/basics/hello/hello.test.ts`. */
  file: string;
  /** Each error's message, with its causes' (Vitest wraps a failed import in its own error). */
  errors: string[];
}

/** An error as Vitest serialises it for reporters. */
interface ReportedError {
  message?: string | undefined;
  cause?: unknown;
}

/** The part of a Vitest test module the reporter reads. */
interface ReportedModule {
  project: { name: string };
  moduleId: string;
  /** Errors outside any test, such as a failed import. */
  errors(): readonly ReportedError[];
}

/** Writes every module that failed to load to `file`, as JSON (an empty list when none did). */
export class LoadFailureReporter {
  readonly #file: string;
  readonly #root: string;

  /** `root`: what the modules' paths are relative to. */
  constructor(options: { file: string; root: string }) {
    this.#file = options.file;
    this.#root = options.root;
  }

  onTestRunEnd(modules: readonly ReportedModule[]): void {
    const failures: LoadFailure[] = modules
      .map((module) => ({
        project: module.project.name,
        file: relative(this.#root, module.moduleId).split(sep).join("/"),
        errors: module.errors().map(describe),
      }))
      .filter((failure) => failure.errors.length > 0)
      .toSorted((a, b) => a.project.localeCompare(b.project) || a.file.localeCompare(b.file));
    mkdirSync(dirname(this.#file), { recursive: true });
    writeFileSync(this.#file, `${JSON.stringify(failures, null, 2)}\n`);
  }
}

/** An error's message and its causes' messages, one per line. */
function describe(error: ReportedError): string {
  const lines = [error.message ?? "an error without a message"];
  for (let cause = error.cause; isError(cause); cause = cause.cause) {
    lines.push(`caused by: ${cause.message ?? "an error without a message"}`);
  }
  return lines.join("\n");
}

function isError(value: unknown): value is ReportedError {
  return typeof value === "object" && value !== null && "message" in value;
}

/** The load failures a run wrote, or `undefined` when it wrote none (it did not finish). */
export function readLoadFailures(file: string): LoadFailure[] | undefined {
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as LoadFailure[]) : undefined;
}
