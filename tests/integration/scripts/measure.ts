// `node tests/integration/scripts/measure.ts <label> [--max-rss-gib 32] -- <command>`: runs one
// command and writes its wall time, peak memory, exit status and leftover processes to
// `.reports/measure/<label>.json`. The memory is the process tree's summed RSS, sampled at 1 Hz
// with `ps`, and the tool stops the tree at the ceiling. Summed RSS counts shared pages once per
// process: it is a method to repeat, before and after a change, not the memory the machine lost.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { constants } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { REPORTS_DIR } from "../harness/paths.ts";

const USAGE = "Usage: measure.ts <label> [--max-rss-gib 32] -- <command>";
const DEFAULT_MAX_RSS_GIB = 32;
const SAMPLE_MS = 1000;
/** How long a stopped tree has to exit after SIGTERM, before SIGKILL. */
const STOP_GRACE_MS = 3000;
/** How long what a command started has to follow it out, before it counts as leftover. */
const LEFTOVER_GRACE_MS = 2000;
const POLL_MS = 100;
const KIB_PER_GIB = 1024 * 1024;

/** One live process, as `ps` lists it. */
export interface ProcessInfo {
  pid: number;
  ppid: number;
  pgid: number;
  rssKib: number;
  /** When it started: with the PID, what tells it from a later process on a reused PID. */
  started: string;
}

/** What `.reports/measure/<label>.json` holds. */
export interface MeasureReport {
  label: string;
  command: string[];
  /** `did-not-complete`: it could not start, or the tool stopped it. */
  outcome: "completed" | "did-not-complete";
  /** The command's exit status, or 128 plus the signal that ended it. */
  exitStatus: number;
  wallSeconds: number;
  peakRssGib: number;
  maxRssGib: number;
  samples: number;
  /**
   * The processes of its process group and the PIDs it saw, still alive at exit, after a short
   * grace, or `null` if `ps` could not say.
   */
  leftover: number | null;
}

/** Reads `ps -o pid= -o ppid= -o pgid= -o rss= -o stat= -o lstart=`. A zombie holds nothing. */
export function parseProcesses(output: string): ProcessInfo[] {
  const processes: ProcessInfo[] = [];
  for (const line of output.split("\n")) {
    if (!line.trim()) continue;
    const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.+?)\s*$/.exec(line);
    if (!match) throw new Error(`Cannot read this line of ps: ${JSON.stringify(line)}`);
    if (match[5]!.startsWith("Z")) continue;
    processes.push({
      pid: Number(match[1]),
      ppid: Number(match[2]),
      pgid: Number(match[3]),
      rssKib: Number(match[4]),
      started: match[6]!,
    });
  }
  return processes;
}

/** What tells a process from a later one on the same PID. */
export function identityOf(process: Pick<ProcessInfo, "pid" | "started">): string {
  return `${process.pid} ${process.started}`;
}

/**
 * The processes of a command's tree: the root, its process group and the processes seen earlier,
 * with all their descendants. A PPID walk alone misses an orphan, which reparents to PID 1, and
 * the group alone misses a browser, which Playwright starts in a group of its own.
 */
export function membersOf(
  processes: readonly ProcessInfo[],
  root: number,
  seen: ReadonlySet<string>,
): ProcessInfo[] {
  const members = new Set(
    processes
      .filter((entry) => entry.pid === root || entry.pgid === root || seen.has(identityOf(entry)))
      .map((entry) => entry.pid),
  );
  for (let grew = true; grew;) {
    grew = false;
    for (const entry of processes) {
      if (!members.has(entry.pid) && members.has(entry.ppid)) {
        members.add(entry.pid);
        grew = true;
      }
    }
  }
  return processes.filter((entry) => members.has(entry.pid));
}

/** Parses the arguments, and throws the usage on any it cannot read. */
export function parseArgs(argv: readonly string[]): {
  label: string;
  maxRssGib: number;
  command: string[];
} {
  const separator = argv.indexOf("--");
  const command = argv.slice(separator + 1);
  const [label, flag, value, ...rest] = argv.slice(0, separator);
  const maxRssGib = flag === undefined ? DEFAULT_MAX_RSS_GIB : Number(value);
  const valid =
    separator !== -1 &&
    command.length > 0 &&
    // The label names a file: nothing that leaves the directory.
    label !== undefined &&
    /^\w[\w.:-]*$/.test(label) &&
    rest.length === 0 &&
    (flag === undefined || flag === "--max-rss-gib") &&
    Number.isFinite(maxRssGib) &&
    maxRssGib > 0;
  if (!valid) throw new Error(USAGE);
  return { label, maxRssGib, command };
}

function listProcesses(): ProcessInfo[] {
  const fields = ["pid", "ppid", "pgid", "rss", "stat", "lstart"];
  // One -o per field: POSIX reads everything after `=` in one as that field's header.
  const args = ["-A", ...fields.flatMap((field) => ["-o", `${field}=`])];
  const result = spawnSync("ps", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`ps exited ${result.status}: ${result.stderr}`);
  return parseProcesses(result.stdout);
}

const round = (value: number) => Math.round(value * 1000) / 1000;

async function measure(options: ReturnType<typeof parseArgs>): Promise<number> {
  const { label, maxRssGib, command } = options;
  const started = performance.now();
  // A process group of its own, so the tree can be stopped without touching this process. Stdin
  // is closed, since a background group that reads the terminal is stopped.
  const child = spawn(command[0]!, command.slice(1), {
    detached: true,
    stdio: ["ignore", "inherit", "inherit"],
  });
  const exited = new Promise<number>((resolve) => {
    child.once("error", (error) => {
      console.error(`[uf] Could not start ${command[0]}: ${error.message}`);
      resolve(127);
    });
    child.once("exit", (code, signal) => {
      resolve(code ?? 128 + (signal ? constants.signals[signal] : 0));
    });
  });

  const root = child.pid;
  const seen = new Set<string>();
  /** The tree now. What it finds stays known, so an orphan is still found once it reparents. */
  const observe = (pid: number): ProcessInfo[] => {
    const members = membersOf(listProcesses(), pid, seen);
    for (const member of members) seen.add(identityOf(member));
    return members;
  };

  let peakKib = 0;
  let samples = 0;
  let stopping: Promise<void> | undefined;
  let timer: NodeJS.Timeout | undefined;
  const stop = (pid: number, reason: string) => {
    if (stopping) return;
    console.error(`[uf] ${label}: ${reason}: stopping its process tree.`);
    clearInterval(timer);
    stopping = stopTree(pid, observe);
  };
  const sample = (pid: number) => {
    let members: ProcessInfo[];
    try {
      members = observe(pid);
    } catch (error) {
      // No sample means no ceiling, so the run must not go on.
      stop(pid, `cannot sample its memory (${(error as Error).message})`);
      return;
    }
    const kib = members.reduce((sum, member) => sum + member.rssKib, 0);
    peakKib = Math.max(peakKib, kib);
    samples += 1;
    if (kib >= maxRssGib * KIB_PER_GIB) {
      const gib = (kib / KIB_PER_GIB).toFixed(1);
      stop(pid, `${gib} GiB reached the ${maxRssGib} GiB ceiling`);
    }
  };

  if (root !== undefined) {
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
      process.once(signal, () => stop(root, `interrupted by ${signal}`));
    }
    sample(root);
    if (!stopping) timer = setInterval(() => sample(root), SAMPLE_MS);
  }

  const exitStatus = await exited;
  const wallSeconds = (performance.now() - started) / 1000;
  clearInterval(timer);
  await stopping;

  let leftover: number | null = 0;
  if (root !== undefined) {
    const count = (pid: number) => {
      try {
        return observe(pid).length;
      } catch {
        return null;
      }
    };
    const deadline = performance.now() + LEFTOVER_GRACE_MS;
    leftover = count(root);
    while (leftover !== 0 && performance.now() < deadline) {
      await delay(POLL_MS);
      leftover = count(root);
    }
  }

  const completed = root !== undefined && !stopping;
  const report: MeasureReport = {
    label,
    command,
    outcome: completed ? "completed" : "did-not-complete",
    exitStatus,
    wallSeconds: round(wallSeconds),
    peakRssGib: round(peakKib / KIB_PER_GIB),
    maxRssGib,
    samples,
    leftover,
  };
  const directory = join(REPORTS_DIR, "measure");
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, `${label}.json`), `${JSON.stringify(report, null, 2)}\n`);
  // A command that exits 0 on SIGTERM still did not finish its work.
  return completed ? exitStatus : exitStatus || 1;
}

/**
 * SIGTERM, then SIGKILL for what is still alive after the grace. Only the group and the processes
 * of the tree are signalled, each by its identity at that moment. If `ps` cannot run, only the
 * group can be stopped.
 */
async function stopTree(root: number, observe: (pid: number) => ProcessInfo[]): Promise<void> {
  const signalTree = (signal: NodeJS.Signals): number => {
    let members: ProcessInfo[] | undefined;
    try {
      members = observe(root);
    } catch {
      members = undefined;
    }
    const inGroup = members === undefined || members.some((member) => member.pgid === root);
    const outside = (members ?? []).filter((member) => member.pgid !== root);
    for (const pid of [...(inGroup ? [-root] : []), ...outside.map((member) => member.pid)]) {
      try {
        process.kill(pid, signal);
      } catch {
        // It exited between the listing and the signal.
      }
    }
    return members?.length ?? 1;
  };
  signalTree("SIGTERM");
  const deadline = performance.now() + STOP_GRACE_MS;
  while (performance.now() < deadline) {
    await delay(POLL_MS);
    try {
      if (observe(root).length === 0) return;
    } catch {
      // Keep waiting: SIGKILL follows.
    }
  }
  signalTree("SIGKILL");
  await delay(POLL_MS);
}

async function main(argv: readonly string[]): Promise<number> {
  let options: ReturnType<typeof parseArgs>;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`[uf] ${(error as Error).message}`);
    return 2;
  }
  return measure(options);
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
