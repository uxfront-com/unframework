// L4 for Svelte: one svelte-check run (TypeScript 6, from the toolchain directory) over every
// file. L4 is the type check: the Svelte compiler's own diagnostics (a11y, legacy syntax) are
// L3's, so they are not checked here a second time and stay attributed to L3 in the matrix.
import { resolve } from "node:path";

import type { ToolchainContext, ToolchainMessage } from "@unframework/codegen";
import {
  assertFilesToCheck,
  checkerFailed,
  diagnosticsByFile,
  resolveToolBin,
  runChecker,
} from "@unframework/codegen/toolchain-node";

/** One `--output machine-verbose` diagnostic. Lines and characters are 0-based. */
interface MachineDiagnostic {
  type: "ERROR" | "WARNING";
  filename: string;
  start: { line: number; character: number };
  message: string;
  code?: number | string;
  source?: string;
}

const COMPLETED = /^COMPLETED (\d+) FILES (\d+) ERRORS (\d+) WARNINGS (\d+) FILES_WITH_PROBLEMS$/;

/**
 * Type-checks Svelte files with svelte-check and the toolchain's tsconfig, and returns every
 * diagnostic it reported, by file: a requested file's own, an imported file's, the toolchain
 * tsconfig's, and, under the temporary tsconfig the run used, the ones that belong to no file.
 * Only the `js` source runs (TypeScript, a file svelte2tsx cannot parse included), with warnings
 * failing as errors do. Rejects when svelte-check cannot run, reports a failure, does not
 * complete, or prints something this parser does not understand: a checker whose output is not
 * fully read cannot pass a file.
 */
export async function typecheck(
  files: readonly string[],
  context: ToolchainContext,
): Promise<Map<string, ToolchainMessage[]>> {
  assertFilesToCheck(files);
  const skipped = files.filter(isSkippedBySvelteCheck);
  if (skipped.length > 0) {
    throw new Error(
      "svelte-check reports every file under node_modules as clean without checking it, so it " +
        `cannot type-check:\n${skipped.join("\n")}`,
    );
  }
  const bin = resolveToolBin(context.toolchainDir, "svelte-check", "svelte-check");
  const run = await runChecker(context.toolchainDir, bin, files, (tsconfig) => [
    "--tsconfig",
    tsconfig,
    "--output",
    "machine-verbose",
    "--diagnostic-sources",
    "js",
    "--fail-on-warnings",
  ]);

  const diagnostics = diagnosticsByFile(files, run.tsconfig);
  const failures: string[] = [];
  const unknown: string[] = [];
  let workspace: string | undefined;
  let totals: { errors: number; warnings: number } | undefined;
  const counted = { errors: 0, warnings: 0 };
  for (const line of run.stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const read = readLine(line);
    if (!read) unknown.push(line);
    else if (read.kind === "start") workspace = read.workspace;
    else if (read.kind === "failure") failures.push(read.message);
    else if (read.kind === "completed") totals = read;
    else {
      const { diagnostic } = read;
      // svelte-check itself reports an error without a file against the tsconfig it ran with.
      diagnostics.add(resolve(workspace ?? run.cwd, diagnostic.filename), fromMachine(diagnostic));
      counted[diagnostic.type === "ERROR" ? "errors" : "warnings"]++;
    }
  }

  if (run.signal || run.code === null) {
    throw checkerFailed("svelte-check", run, "it did not finish.");
  }
  if (failures.length > 0) {
    throw checkerFailed("svelte-check", run, `it failed: ${failures.join("; ")}`);
  }
  if (unknown.length > 0) {
    throw checkerFailed("svelte-check", run, "it printed output this toolchain cannot read.");
  }
  if (!totals) throw checkerFailed("svelte-check", run, "it never reported completion.");
  // svelte-check has cut machine-verbose output short before (it exits without draining stdout).
  if (totals.errors !== counted.errors || totals.warnings !== counted.warnings) {
    throw checkerFailed(
      "svelte-check",
      run,
      `it counted ${totals.errors} error(s) and ${totals.warnings} warning(s), but printed ` +
        `${counted.errors} and ${counted.warnings}.`,
    );
  }
  if ((run.code === 0) !== (counted.errors + counted.warnings === 0)) {
    throw checkerFailed("svelte-check", run, "its exit code does not match its diagnostics.");
  }
  return diagnostics.results;
}

/**
 * Whether svelte-check skips a file's diagnostics: it returns none for a path with a
 * `node_modules` segment, unless that is a `src/node_modules` (its `canSkipDiagnostics`).
 */
function isSkippedBySvelteCheck(path: string): boolean {
  const posix = path.replaceAll("\\", "/");
  return posix.includes("/node_modules/") && !posix.includes("/src/node_modules/");
}

type MachineLine =
  | { kind: "start"; workspace: string }
  | { kind: "failure"; message: string }
  | { kind: "diagnostic"; diagnostic: MachineDiagnostic }
  | { kind: "completed"; errors: number; warnings: number };

/** Reads one `<timestamp> <payload>` line of machine output; `undefined` when it is not one. */
function readLine(line: string): MachineLine | undefined {
  const payload = /^\d+ (.*)$/.exec(line)?.[1];
  if (payload === undefined) return undefined;
  if (payload.startsWith("START ")) {
    const workspace = json(payload.slice("START ".length));
    return typeof workspace === "string" ? { kind: "start", workspace } : undefined;
  }
  if (payload.startsWith("FAILURE ")) {
    const message = json(payload.slice("FAILURE ".length));
    return typeof message === "string" ? { kind: "failure", message } : undefined;
  }
  if (payload.startsWith("{")) {
    const diagnostic = json(payload) as MachineDiagnostic | undefined;
    return diagnostic?.filename && diagnostic.start
      ? { kind: "diagnostic", diagnostic }
      : undefined;
  }
  const completed = COMPLETED.exec(payload);
  return completed
    ? { kind: "completed", errors: Number(completed[2]), warnings: Number(completed[3]) }
    : undefined;
}

/** Parses JSON, or returns `undefined`: the caller reports what it could not read. */
function json(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function fromMachine(diagnostic: MachineDiagnostic): ToolchainMessage {
  const { code } = diagnostic;
  return {
    message: diagnostic.message,
    line: diagnostic.start.line + 1,
    column: diagnostic.start.character + 1,
    // TypeScript's codes are numbers; a Svelte parse error's, which svelte2tsx reports, is a name.
    ...(code === undefined ? {} : { code: typeof code === "number" ? `TS${code}` : code }),
  };
}
