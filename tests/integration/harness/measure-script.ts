// What the tests of scripts/measure.ts on real commands share. They wait on sleeps and 1 Hz
// sampling, so they run as several files that Vitest runs in parallel (ADR-0093):
// `measure-report`, `measure-tree` and `measure-interrupt.unit.test.ts`. Each file passes
// a label of its own, so files that run at once never read or delete each other's report.
import { spawn, spawnSync } from "node:child_process";
import type { SpawnSyncOptions } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { afterAll, afterEach, beforeAll, expect } from "vitest";

import type { MeasureReport } from "../scripts/measure.ts";
import { REPORTS_DIR } from "./paths.ts";

/** The tool these tests run. */
export const SCRIPT: string = fileURLToPath(new URL("../scripts/measure.ts", import.meta.url));

export const KIB_PER_MIB = 1024;
/** Passes {@link CEILING}: 300 MiB, which the report rounds to 0.293 GiB. */
export const HOG_KIB: number = 300 * KIB_PER_MIB;
export const CEILING: string[] = ["--max-rss-gib", "0.2"];
export const SLEEPER_AND_WAIT: string[] = ["sh", "-c", "sleep 60 >/dev/null 2>&1 & echo $!; wait"];
export const DETACHED_SLEEPER = `const { spawn } = require("node:child_process");
    const sleeper = spawn("sleep", ["60"], { detached: true, stdio: "ignore" });
    sleeper.unref();
    console.log(sleeper.pid);`;

/**
 * Holds the tool right after it spawns the command, whose first line may by then be out. The
 * natural race is too narrow to hit on demand.
 */
export const SLOW_SPAWN = `data:text/javascript,${encodeURIComponent(`
    import childProcess from "node:child_process";
    import { syncBuiltinESMExports } from "node:module";
    const { spawn } = childProcess;
    childProcess.spawn = (...args) => {
      const child = spawn(...args);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
      return child;
    };
    syncBuiltinESMExports();
  `)}`;

/** A command that runs a script in this Node. */
export const node = (script: string): string[] => [process.execPath, "-e", script];

/** `kill(pid, 0)` also succeeds on a zombie. */
export function isAlive(pid: number): boolean {
  const { stdout } = spawnSync("ps", ["-o", "stat=", "-p", String(pid)], { encoding: "utf8" });
  return stdout.trim() !== "" && !stdout.trim().startsWith("Z");
}

/** The limit ends a command the tool failed to stop, which would otherwise hang the suite. */
const LIMIT_MS = 30_000;

/**
 * Runs the tool, and fails when it did not exit by itself. At the limit `spawnSync` kills the
 * tool and closes its pipes, so what it printed is lost: the failure must name the limit, not a
 * word missing from an empty `stderr`.
 */
export function runTool(
  args: readonly string[],
  options: SpawnSyncOptions = {},
): { status: number | null; out: string; err: string } {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], {
    ...options,
    encoding: "utf8",
    timeout: LIMIT_MS,
  });
  if (result.error) {
    throw new Error(`The tool did not exit within ${LIMIT_MS / 1000} s: ${result.error.message}`);
  }
  if (result.signal) throw new Error(`The tool was ended by ${result.signal}`);
  return { status: result.status, out: result.stdout, err: result.stderr };
}

const shellQuote = (value: string) => `'${value.replaceAll("'", `'\\''`)}'`;

/** What a file's tests that assert an amount of memory use. */
export interface DeclaredRss {
  /** The environment that puts the test's `ps` first on `PATH`, for the tool. */
  env: () => NodeJS.ProcessEnv;
  /** Declares a process's RSS, whole or not at all: by a rename. */
  declare: (pid: number, kib: number) => void;
  /** Script that declares the running process's RSS, before what follows it. */
  holds: (kib: number) => string;
}

/**
 * A `ps` of the test's own, for the tests of an amount: under memory pressure the OS takes a
 * real allocation's pages out of RSS, by compressing or swapping them, so no amount of real
 * memory gives an exact sum. It runs the real `ps` and reports, in the `rss=` column, the KiB
 * each process declared in a file named by its PID, and 0 for any other. It keeps every other
 * byte of the line, so the script parses it as it parses `ps`. It reads the PID and the RSS by
 * their places among the `-o` columns, which holds while no column before them has spaces
 * (`lstart` is last), and it refuses a call without both, so a sampler that reads another column
 * fails. Each file gets a directory of its own, and no declaration outlives its test, where a
 * later process could reuse the PID.
 */
export function declaredRss(): DeclaredRss {
  let root = "";
  let declaredDir = "";
  let env: NodeJS.ProcessEnv = {};
  beforeAll(() => {
    const realPs = spawnSync("sh", ["-c", "command -v ps"], { encoding: "utf8" }).stdout.trim();
    expect(realPs, "the real ps").toMatch(/^\//);
    root = mkdtempSync(join(tmpdir(), "uf-measure-"));
    const binDir = join(root, "bin");
    declaredDir = join(root, "rss");
    mkdirSync(binDir);
    mkdirSync(declaredDir);
    const fakePs = join(binDir, "ps");
    writeFileSync(
      fakePs,
      `#!/bin/sh
n=0 pid_at=0 rss_at=0 previous=
for arg in "$@"; do
  if [ "$previous" = "-o" ]; then
    n=$((n + 1))
    case "$arg" in pid=) pid_at=$n ;; rss=) rss_at=$n ;; esac
  fi
  previous=$arg
done
if [ "$pid_at" -eq 0 ] || [ "$rss_at" -eq 0 ]; then
  echo "the test's ps reports declared RSS, and needs -o pid= and -o rss=: got $*" >&2
  exit 64
fi
listed=$(${shellQuote(realPs)} "$@") || exit $?
printf '%s\\n' "$listed" | awk -v dir=${shellQuote(declaredDir)} -v pid_at="$pid_at" -v rss_at="$rss_at" '
NF == 0 { print; next }
{
  kib = 0
  file = dir "/" $pid_at
  if ((getline declared < file) > 0) kib = declared + 0
  close(file)
  rest = $0
  head = ""
  for (i = 1; i < rss_at; i++) {
    match(rest, /^[ \\t]*[^ \\t]+/)
    head = head substr(rest, 1, RLENGTH)
    rest = substr(rest, RLENGTH + 1)
  }
  match(rest, /^[ \\t]*/)
  head = head substr(rest, 1, RLENGTH)
  rest = substr(rest, RLENGTH + 1)
  match(rest, /^[^ \\t]+/)
  print head kib substr(rest, RLENGTH + 1)
}'
`,
    );
    chmodSync(fakePs, 0o755);
    env = { ...process.env, PATH: `${binDir}${delimiter}${process.env.PATH ?? ""}` };
  });
  afterEach(() => {
    if (!declaredDir) return;
    rmSync(declaredDir, { recursive: true, force: true });
    mkdirSync(declaredDir);
  });
  afterAll(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });
  return {
    env: () => env,
    declare: (pid, kib) => {
      const file = join(declaredDir, String(pid));
      writeFileSync(`${file}.tmp`, String(kib));
      renameSync(`${file}.tmp`, file);
    },
    holds: (kib) => `{
      const fs = require("node:fs");
      const file = ${JSON.stringify(declaredDir)} + "/" + process.pid;
      fs.writeFileSync(file + ".tmp", "${kib}");
      fs.renameSync(file + ".tmp", file);
    }`,
  };
}

/** What a file's tests of the script use, under its own label. */
export interface ScriptHarness {
  label: string;
  reportFile: string;
  /** Runs a command through the tool, and reads the report it leaves. */
  measure: (
    command: readonly string[],
    options?: { flags?: readonly string[]; env?: NodeJS.ProcessEnv },
  ) => { status: number | null; out: string; err: string; report: MeasureReport | undefined };
  /**
   * Runs a command through the tool, and sends the signals once the command has printed a PID,
   * kept to kill after the test. It waits for the tool's exit, not its pipe, which a tree the
   * tool failed to stop would hold open.
   */
  interrupt: (
    command: readonly string[],
    signals: readonly NodeJS.Signals[],
    nodeArgs?: readonly string[],
  ) => Promise<{ status: number | null; pid: number }>;
  /** The first PID the command printed, kept to kill after the test. */
  sleeperOf: (out: string) => number;
}

/**
 * The helpers of one file's tests, under `label`, which no baseline and no other file uses. It
 * registers the hooks that kill each test's sleepers and delete the report.
 */
export function scriptHarness(label: string): ScriptHarness {
  // Real reports, in the directory the tool writes.
  const reportFile = join(REPORTS_DIR, "measure", `${label}.json`);
  const sleepers: number[] = [];

  afterEach(() => {
    for (const pid of sleepers.splice(0)) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // It has gone, as the test asked of it.
      }
    }
  });
  afterAll(() => {
    rmSync(reportFile, { force: true });
  });

  const sleeperOf = (out: string) => {
    const pid = Number(/^(\d+)$/m.exec(out)?.[1]);
    expect(pid).toBeGreaterThan(1);
    sleepers.push(pid);
    return pid;
  };

  return {
    label,
    reportFile,
    measure: (command, options = {}) => {
      rmSync(reportFile, { force: true });
      const result = runTool([label, ...(options.flags ?? []), "--", ...command], {
        env: options.env,
      });
      const report = existsSync(reportFile)
        ? (JSON.parse(readFileSync(reportFile, "utf8")) as MeasureReport)
        : undefined;
      return { ...result, report };
    },
    interrupt: async (command, signals, nodeArgs = []) => {
      rmSync(reportFile, { force: true });
      const tool = spawn(process.execPath, [...nodeArgs, SCRIPT, label, "--", ...command], {
        stdio: ["ignore", "pipe", "ignore"],
      });
      const exited = new Promise<number | null>((resolve) => {
        tool.once("exit", (code) => resolve(code));
      });
      const out = await new Promise<string>((resolve) => {
        tool.stdout.once("data", (chunk: Buffer) => resolve(chunk.toString()));
      });
      const pid = sleeperOf(out);
      for (const signal of signals) {
        tool.kill(signal);
        // Two signals of a kind sent at once may arrive as one.
        await delay(100);
      }
      return { status: await exited, pid };
    },
    sleeperOf,
  };
}
