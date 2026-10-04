// L5 (plan §7.2, ADR-0042): each target's own linters over its output files. Two runners the
// toolchains share: oxlint, which every target runs with one baseline configuration (and the
// JSX targets with their framework's rules), and ESLint, which lints the template languages
// oxlint cannot read (Vue, Svelte and Astro markup, Angular's inline templates). Both run as
// processes from the toolchain directory, where the linters and their plugins are installed,
// and hold ADR-0028's bar for checkers: a linter that cannot start, cannot load its
// configuration or a plugin, skips a file it was given, or prints output this module cannot
// read rejects. Everything a linter reports comes back by file, as `Toolchain.typecheck`
// returns diagnostics, in a stable order.
import { existsSync, realpathSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import type { ToolchainContext, ToolchainMessage } from "../toolchain.ts";
import { assertFilesToCheck, checkerFailed, diagnosticsByFile, execute } from "./checker.ts";
import type { ProcessRun } from "./checker.ts";
import { findInstalled, resolveInstalled, resolveToolBin } from "./resolve.ts";

/** Where a lint runner finds its configuration. */
export interface LintOptions {
  /**
   * The linter's configuration file. By default, the toolchain directory's own:
   * `output.oxlintrc.json` for oxlint, `eslint.config.js` for ESLint.
   */
  config?: string;
}

/** A rule's code as oxlint prints it: `eslint(no-debugger)`, `react(jsx-key)`. */
const OXLINT_CODE = /^([\w@/-]+)\((.+)\)$/;

/** What a JS plugin's failure on one file says. Its rules did not run on that file. */
const JS_PLUGIN_FAILURE = /^Error running JS plugin\b/;

/** One problem in oxlint's JSON report (`--format=json`). */
interface OxlintDiagnostic {
  message: string;
  /** Absent for a syntax error and for an unused disable directive. */
  code?: string;
  help?: string;
  filename: string;
  labels?: { span: { line: number; column: number } }[];
}

/** oxlint's JSON report. */
interface OxlintReport {
  diagnostics: OxlintDiagnostic[];
  number_of_files: number;
}

/**
 * Lints `files` (absolute paths) with oxlint in one run and returns every problem by file (see
 * {@link diagnosticsByFile}): each file has an entry, empty when it is clean, and a problem on
 * any other path has an entry of its own. A rule's problem carries the rule's name as ESLint
 * spells it (`no-debugger`, `react/jsx-key`); a syntax error or an unused disable directive has
 * no code.
 *
 * oxlint runs from the toolchain directory with only the configuration (`--config`, nested
 * configurations off), so the repository's own lint settings never apply; warnings count like
 * errors; and a disable directive that disables nothing is a problem. The run rejects when
 * oxlint cannot start or load its configuration or a JS plugin, a JS plugin fails on a file,
 * oxlint lints fewer files than it was given, prints anything but its JSON report, or exits
 * with a code that disagrees with the report.
 */
export async function lintWithOxlint(
  files: readonly string[],
  context: ToolchainContext,
  options: LintOptions = {},
): Promise<Map<string, ToolchainMessage[]>> {
  assertFilesToCheck(files, "lint");
  const config = configFile(context, options, "output.oxlintrc.json", "oxlint");
  const bin = resolveToolBin(context.toolchainDir, "oxlint", "oxlint");
  // One real path per file, so a file given twice (once through a symlink) is counted once:
  // the count of files oxlint linted is checked against it.
  const paths = [...new Set(files.map((file) => realpathSync(file)))];
  const run = await execute(
    process.execPath,
    [
      bin,
      `--config=${config}`,
      "--disable-nested-config",
      "--format=json",
      "--deny-warnings",
      "--report-unused-disable-directives-severity=error",
      ...paths,
    ],
    realpathSync(context.toolchainDir),
  );
  const report = readOxlintReport(run);
  if (report.number_of_files !== paths.length) {
    throw checkerFailed(
      "oxlint",
      run,
      `it linted ${report.number_of_files} of the ${paths.length} files it was given, so it skipped some.`,
    );
  }
  if (report.diagnostics.some((problem) => JS_PLUGIN_FAILURE.test(problem.message))) {
    throw checkerFailed("oxlint", run, "a JS plugin failed, so its rules did not run.");
  }
  // With --deny-warnings, oxlint exits with 1 exactly when it reports a problem.
  if (run.code !== (report.diagnostics.length > 0 ? 1 : 0)) {
    throw checkerFailed(
      "oxlint",
      run,
      `its exit code disagrees with the ${report.diagnostics.length} problem(s) it reported.`,
    );
  }
  const diagnostics = diagnosticsByFile(files, config);
  for (const problem of report.diagnostics)
    diagnostics.add(problem.filename, oxlintMessage(problem));
  return sortMessages(diagnostics.results);
}

/** Reads oxlint's report, rejecting a run that did not end with one. */
function readOxlintReport(run: ProcessRun): OxlintReport {
  if (run.signal) throw checkerFailed("oxlint", run, "it did not finish.");
  // A run prints its report to stdout and nothing else. A configuration oxlint cannot read, or
  // a path it cannot find, is plain text instead.
  if (run.stderr.trim() !== "") throw checkerFailed("oxlint", run, "it wrote to stderr.");
  let report: unknown;
  try {
    report = JSON.parse(run.stdout);
  } catch {
    throw checkerFailed("oxlint", run, "it printed output this toolchain cannot read.");
  }
  if (!isOxlintReport(report)) {
    throw checkerFailed("oxlint", run, "its report does not have the shape this toolchain reads.");
  }
  return report;
}

function isOxlintReport(value: unknown): value is OxlintReport {
  if (typeof value !== "object" || value === null) return false;
  const { diagnostics, number_of_files: count } = value as Partial<OxlintReport>;
  return (
    typeof count === "number" &&
    Array.isArray(diagnostics) &&
    diagnostics.every(
      (problem: Partial<OxlintDiagnostic>) =>
        typeof problem.message === "string" && typeof problem.filename === "string",
    )
  );
}

function oxlintMessage(problem: OxlintDiagnostic): ToolchainMessage {
  const span = problem.labels?.[0]?.span;
  const code = problem.code === undefined ? undefined : ruleName(problem.code);
  return {
    message: withHelp(problem.message, problem.help),
    ...(span ? { line: span.line, column: span.column } : {}),
    ...(code === undefined ? {} : { code }),
  };
}

/** `eslint(no-debugger)` as `no-debugger`, `react(jsx-key)` as `react/jsx-key`: config names. */
function ruleName(code: string): string {
  const match = OXLINT_CODE.exec(code);
  if (!match) return code;
  const [, plugin = "", rule = ""] = match;
  return plugin === "eslint" ? rule : `${plugin}/${rule}`;
}

/** A problem's message and oxlint's advice on it, as one text. */
function withHelp(message: string, help: string | undefined): string {
  if (!help) return message;
  return `${/[.?!]$/.test(message) ? message : `${message}.`} ${help}`;
}

/**
 * ESLint's run, as a module Node evaluates in the toolchain directory. It drives ESLint's own
 * API rather than its command line, which takes its base path from the working directory: here
 * the working directory stays the toolchain directory, where plugins look for what a project
 * installs (eslint-plugin-astro resolves its TypeScript parser from there), while the base path
 * (`cwd`, outside which ESLint lints nothing) is the files' common ancestor. The API never reads
 * a bulk-suppressions file either, which the command line would take from its working directory.
 */
const ESLINT_RUN = `
const { eslint, config, cwd, files } = JSON.parse(process.argv[1]);
const api = await import(eslint);
const { ESLint } = api.ESLint ? api : api.default;
const linter = new ESLint({
  cwd,
  overrideConfigFile: config,
  overrideConfig: { linterOptions: { noInlineConfig: true } },
  warnIgnored: true,
  cache: false,
});
const results = await linter.lintFiles(files);
process.stdout.write(
  JSON.stringify(
    results.map(({ filePath, messages, suppressedMessages }) => ({
      filePath,
      messages,
      suppressedMessages,
    })),
  ),
);
`;

/** One message in ESLint's results. */
interface EslintMessage {
  /** Absent (null) for a parsing error and for ESLint's own notices. */
  ruleId: string | null;
  severity: 1 | 2;
  message: string;
  line?: number;
  column?: number;
  fatal?: boolean;
}

/** ESLint's results for one file. */
interface EslintResult {
  filePath: string;
  messages: EslintMessage[];
  suppressedMessages: EslintMessage[];
}

/** ESLint's notice for a file it was given and did not lint. */
const IGNORED = /^File ignored\b/;

/**
 * Lints `files` (absolute paths) with ESLint in one run and returns every message by file (see
 * {@link diagnosticsByFile}), as {@link lintWithOxlint} does. A rule's message carries its rule
 * id (`vue/require-v-for-key`); a parsing error has no code; a warning's message starts with
 * `warning: `.
 *
 * ESLint (9 or later, flat configuration) runs from the toolchain directory with only the
 * configuration, never an inline one (`noInlineConfig`: a comment in an output cannot change or
 * silence a rule). A message a processor or a directive still suppressed comes back, marked
 * `suppressed: `. The run rejects when ESLint cannot start or load its configuration or a
 * plugin, skips a file it was given ("File ignored…": outside its base path, ignored, or matched
 * by no configuration), or prints anything but its results.
 */
export async function lintWithEslint(
  files: readonly string[],
  context: ToolchainContext,
  options: LintOptions = {},
): Promise<Map<string, ToolchainMessage[]>> {
  assertFilesToCheck(files, "lint");
  const config = configFile(context, options, "eslint.config.js", "ESLint");
  const eslint = resolveEslint(context.toolchainDir);
  // Real paths: ESLint lints nothing outside its base path, and a path through a symlink (macOS
  // reaches its temporary directory through one) is outside the real one.
  const paths = [...new Set(files.map((file) => realpathSync(file)))];
  const request = {
    eslint: pathToFileURL(eslint).href,
    config: realpathSync(config),
    cwd: commonDirectory(paths),
    files: paths,
  };
  const run = await execute(
    process.execPath,
    ["--input-type=module", "--eval", ESLINT_RUN, JSON.stringify(request)],
    realpathSync(context.toolchainDir),
  );
  const results = readEslintResults(run);
  const diagnostics = diagnosticsByFile(files, config);
  for (const { filePath, messages, suppressedMessages } of results) {
    for (const message of messages) {
      if (message.ruleId === null && !message.fatal && IGNORED.test(message.message)) {
        throw checkerFailed("ESLint", run, `it skipped ${filePath}: ${message.message}`);
      }
      diagnostics.add(filePath, eslintMessage(message));
    }
    for (const message of suppressedMessages) {
      diagnostics.add(filePath, eslintMessage(message, "suppressed"));
    }
  }
  const linted = new Set(results.map((result) => result.filePath));
  const skipped = paths.filter((path) => !linted.has(path));
  if (skipped.length > 0) {
    throw checkerFailed("ESLint", run, `it returned no results for ${skipped.join(", ")}.`);
  }
  return sortMessages(diagnostics.results);
}

/** The entry of ESLint 9 or later, as installed for the toolchain directory. */
function resolveEslint(toolchainDir: string): string {
  const installed = findInstalled(toolchainDir, "eslint");
  if (!installed) {
    throw new Error(
      `eslint is not installed in ${toolchainDir}: the toolchain directory must provide it ` +
        `(in this repo, tests/toolchains/<target> lists it as a devDependency).`,
    );
  }
  const { manifestPath, manifest } = installed;
  // The flat configuration and the API options this runner passes arrived with ESLint 9.
  const major = Number(manifest.version?.split(".")[0]);
  if (!(major >= 9)) {
    throw new Error(
      `Expected ESLint 9 or later for ${toolchainDir}, found ${manifest.version ?? "no version"} at ${dirname(manifestPath)}.`,
    );
  }
  const entry = resolveInstalled(toolchainDir, "eslint");
  if (!entry) throw new Error(`eslint at ${dirname(manifestPath)} has no entry point.`);
  return entry;
}

/** Reads ESLint's results, rejecting a run that did not end with them. */
function readEslintResults(run: ProcessRun): EslintResult[] {
  if (run.signal) throw checkerFailed("ESLint", run, "it did not finish.");
  // A configuration or a plugin that fails to load throws: the run ends with its stack.
  if (run.code !== 0) throw checkerFailed("ESLint", run, "it could not lint the files.");
  if (run.stderr.trim() !== "") throw checkerFailed("ESLint", run, "it wrote to stderr.");
  let results: unknown;
  try {
    results = JSON.parse(run.stdout);
  } catch {
    throw checkerFailed("ESLint", run, "it printed output this toolchain cannot read.");
  }
  if (!Array.isArray(results) || !results.every(isEslintResult)) {
    throw checkerFailed("ESLint", run, "its results do not have the shape this toolchain reads.");
  }
  return results;
}

function isEslintResult(value: unknown): value is EslintResult {
  if (typeof value !== "object" || value === null) return false;
  const { filePath, messages, suppressedMessages } = value as Partial<EslintResult>;
  return (
    typeof filePath === "string" &&
    Array.isArray(messages) &&
    Array.isArray(suppressedMessages) &&
    [...messages, ...suppressedMessages].every(
      (message: Partial<EslintMessage>) =>
        typeof message.message === "string" &&
        (typeof message.ruleId === "string" || message.ruleId === null),
    )
  );
}

function eslintMessage(message: EslintMessage, kind?: "suppressed"): ToolchainMessage {
  const prefix = kind === "suppressed" ? "suppressed: " : message.severity === 1 ? "warning: " : "";
  return {
    message: `${prefix}${message.message}`,
    ...(message.line === undefined ? {} : { line: message.line }),
    ...(message.column === undefined ? {} : { column: message.column }),
    ...(message.ruleId === null ? {} : { code: message.ruleId }),
  };
}

/**
 * Merges the results of several lint runs over the same files (oxlint and ESLint, for a template
 * language): one entry per path, with every run's messages, in a stable order.
 */
export function mergeLintResults(
  results: readonly ReadonlyMap<string, readonly ToolchainMessage[]>[],
): Map<string, ToolchainMessage[]> {
  const merged = new Map<string, ToolchainMessage[]>();
  for (const result of results) {
    for (const [path, messages] of result) {
      merged.set(path, [...(merged.get(path) ?? []), ...messages]);
    }
  }
  return sortMessages(merged);
}

/** The configuration a runner uses, which must exist: a linter without one checks nothing. */
function configFile(
  context: ToolchainContext,
  options: LintOptions,
  name: string,
  tool: string,
): string {
  const config = resolve(options.config ?? join(context.toolchainDir, name));
  if (!existsSync(config)) {
    throw new Error(`${config} does not exist: ${tool} lints with the toolchain's configuration.`);
  }
  return config;
}

/** The deepest directory that holds every path. */
function commonDirectory(paths: readonly string[]): string {
  const [first = [], ...rest] = paths.map((path) => dirname(path).split(sep));
  let length = first.length;
  for (const parts of rest) {
    let shared = 0;
    while (shared < length && parts[shared] === first[shared]) shared++;
    length = shared;
  }
  return first.slice(0, length).join(sep) || sep;
}

/**
 * Sorts each file's messages by position, then code and text: a linter's order depends on its
 * threads (oxlint) or its rules' order, and the results must not.
 */
function sortMessages(results: Map<string, ToolchainMessage[]>): Map<string, ToolchainMessage[]> {
  for (const [path, messages] of results) results.set(path, messages.toSorted(compareMessages));
  return results;
}

function compareMessages(a: ToolchainMessage, b: ToolchainMessage): number {
  return (
    (a.line ?? 0) - (b.line ?? 0) ||
    (a.column ?? 0) - (b.column ?? 0) ||
    compareText(a.code ?? "", b.code ?? "") ||
    compareText(a.message, b.message)
  );
}

/** Code-unit order: unlike `localeCompare`, the same on every machine. */
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
