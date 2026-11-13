// What the tests of scripts/measure.ts on real commands share. They wait on sleeps and 1 Hz
// sampling, so they run as several files that Vitest runs in parallel (ADR-0093):
// `measure-report`, `measure-tree` and `measure-interrupt.unit.test.ts`. Each file passes
// a label of its own, so files that run at once never read or delete each other's report.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { afterAll, afterEach, expect } from "vitest";

import type { MeasureReport } from "../scripts/measure.ts";
import { REPORTS_DIR } from "./paths.ts";

/** The tool these tests run. */
export const SCRIPT: string = fileURLToPath(new URL("../scripts/measure.ts", import.meta.url));

/** Passes the ceiling these tests set, once the script has set up what it needs. */
export const HOG = "globalThis.hog = Buffer.alloc(300 * 1024 * 1024, 1);";
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

/** What a file's tests of the script use, under its own label. */
export interface ScriptHarness {
  label: string;
  reportFile: string;
  /** Runs a command through the tool, and reads the report it leaves. */
  measure: (
    command: readonly string[],
    ...flags: string[]
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
    measure: (command, ...flags) => {
      rmSync(reportFile, { force: true });
      // The limit ends a command the tool failed to stop, which would otherwise hang the suite.
      const result = spawnSync(process.execPath, [SCRIPT, label, ...flags, "--", ...command], {
        encoding: "utf8",
        timeout: 30_000,
      });
      const report = existsSync(reportFile)
        ? (JSON.parse(readFileSync(reportFile, "utf8")) as MeasureReport)
        : undefined;
      return { status: result.status, out: result.stdout, err: result.stderr, report };
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
