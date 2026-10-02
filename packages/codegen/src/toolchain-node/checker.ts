// What every toolchain's checks share: the files a gate accepts, the one shape in which every
// type checker's diagnostics come back (L4), and running a checker as a process from the
// toolchain directory, over a temporary tsconfig. A process, because TypeScript 6 and
// TypeScript 7 cannot share one (spike: ts6-ts7 ADR), and tsgo has no stable JS API yet.
import { spawn } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import type { ToolchainFile, ToolchainMessage } from "../toolchain.ts";

/** What a checker process printed, and how it ended. */
export interface CheckerRun {
  /** The directory the checker ran in, symlinks resolved; it prints paths relative to it. */
  cwd: string;
  /** The temporary tsconfig the checker read. */
  tsconfig: string;
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

/** Rejects a framework compile (L3) over no files: a check over nothing proves nothing. */
export function assertFilesToCompile(files: readonly ToolchainFile[]): void {
  if (files.length === 0) {
    throw new Error("frameworkCompile received no files: a check over nothing proves nothing.");
  }
}

/**
 * Rejects a type check (L4) that could not check every file: no files (a check over nothing
 * proves nothing), a relative path, or a file that does not exist, which some checkers skip
 * and others report against their configuration rather than against the file.
 */
export function assertFilesToCheck(files: readonly string[]): void {
  if (files.length === 0) {
    throw new Error("typecheck received no files: a check over nothing proves nothing.");
  }
  const relativeFiles = files.filter((file) => !isAbsolute(file));
  if (relativeFiles.length > 0) {
    throw new TypeError(`typecheck needs absolute paths, got: ${relativeFiles.join(", ")}`);
  }
  const missing = files.filter((file) => !existsSync(file));
  if (missing.length > 0) {
    throw new Error(`typecheck received files that do not exist:\n${missing.join("\n")}`);
  }
}

/**
 * Runs a checker over exactly `files`: writes a temporary tsconfig into
 * `<toolchainDir>/.uf-tmp/` that extends the toolchain's own tsconfig and lists the files, runs
 * the `bin` script with Node and `args(tsconfig)` from the toolchain directory, and removes the
 * tsconfig afterwards. Rejects what {@link assertFilesToCheck} rejects, a toolchain without a
 * tsconfig, and a process that cannot start. A run that fails is returned, not rejected: reading
 * its output is the caller's job.
 */
export async function runChecker(
  toolchainDir: string,
  bin: string,
  files: readonly string[],
  args: (tsconfig: string) => string[],
): Promise<CheckerRun> {
  assertFilesToCheck(files);
  const base = join(toolchainDir, "tsconfig.json");
  if (!existsSync(base)) {
    throw new Error(`${base} does not exist: the toolchain's tsconfig is what typecheck extends.`);
  }
  const cwd = realpathSync(toolchainDir);
  await mkdir(join(cwd, ".uf-tmp"), { recursive: true });
  // A directory of its own: the harness and package tests may check the same toolchain at once.
  const directory = await mkdtemp(join(cwd, ".uf-tmp", "typecheck-"));
  const tsconfig = join(directory, "tsconfig.json");
  try {
    // `include: []` drops the base's globs, so only the listed files are checked.
    const config = { extends: realpathSync(base), include: [], files };
    await writeFile(tsconfig, `${JSON.stringify(config, null, 2)}\n`);
    return { cwd, tsconfig, ...(await execute(process.execPath, [bin, ...args(tsconfig)], cwd)) };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function execute(
  command: string,
  args: string[],
  cwd: string,
): Promise<Pick<CheckerRun, "code" | "signal" | "stdout" | "stderr">> {
  return new Promise((resolvePromise, reject) => {
    // NODE_OPTIONS belongs to the test runner, not to the checker. Without NODE_PATH, the
    // checker resolves its own dependencies from where it is installed, however the tests were
    // started.
    const { NODE_OPTIONS: _options, NODE_PATH: _path, ...env } = process.env;
    const child = spawn(command, args, {
      cwd,
      env: { ...env, NO_COLOR: "1", FORCE_COLOR: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => (stderr += chunk));
    child.on("error", (error) =>
      reject(new Error(`Could not start ${args[0]}: ${error.message}`, { cause: error })),
    );
    child.on("close", (code, signal) => resolvePromise({ code, signal, stdout, stderr }));
  });
}

/** Diagnostics by file, as `Toolchain.typecheck` returns them; see {@link diagnosticsByFile}. */
export interface DiagnosticsByFile {
  /**
   * Records a diagnostic in the file at the absolute `path` the checker reported, or, without
   * a path, in no file.
   */
  add(path: string | undefined, message: ToolchainMessage): void;
  /** Every diagnostic recorded so far, by absolute path. */
  readonly results: Map<string, ToolchainMessage[]>;
}

/**
 * Collects a checker run's diagnostics the way every toolchain's `typecheck` reports them, so
 * nothing the checker said is lost:
 * - each of `files` has an entry under the caller's own spelling of its path, empty when it is
 *   clean, also when the checker reached the file through a symlink;
 * - a diagnostic in any other file (one a checked file imports, or the toolchain's tsconfig) has
 *   an entry under that file's absolute path;
 * - a diagnostic that belongs to no file (a global or configuration error) has an entry under
 *   `tsconfig`, the configuration the checker ran with.
 *
 * A caller that reads only its own files must also fail on every other entry with messages: a
 * checker with a broken configuration checks without what it could not read (an option, the
 * standard library) or skips the semantic check, so the files themselves can look clean.
 */
export function diagnosticsByFile(files: readonly string[], tsconfig: string): DiagnosticsByFile {
  const keyOf = pathKeys(files);
  const results = new Map<string, ToolchainMessage[]>(files.map((file) => [file, []]));
  return {
    results,
    add(path, message) {
      const key = path === undefined ? tsconfig : keyOf(resolve(path));
      const list = results.get(key);
      if (list) list.push(message);
      else results.set(key, [message]);
    },
  };
}

/**
 * Maps the paths a checker prints back to the caller's own spelling of each file, also when
 * the checker resolved a symlink on the way. A path no file matches is returned as it is.
 */
function pathKeys(files: readonly string[]): (path: string) => string {
  const keys = new Map<string, string>();
  for (const file of files) {
    keys.set(resolve(file), file);
    if (existsSync(file)) keys.set(realpathSync(file), file);
  }
  return (path) =>
    keys.get(path) ?? (existsSync(path) ? keys.get(realpathSync(path)) : undefined) ?? path;
}

/** The error a run is rejected with, carrying everything the checker printed. */
export function checkerFailed(name: string, run: CheckerRun, problem: string): Error {
  const output = [run.stdout.trim(), run.stderr.trim()].filter(Boolean).join("\n");
  const ended = run.signal ? `was killed by ${run.signal}` : `exited with code ${run.code}`;
  return new Error(`${name} ${ended}: ${problem}${output ? `\n${output}` : " (no output)"}`);
}
