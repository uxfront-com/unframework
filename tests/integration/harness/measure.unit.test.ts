// scripts/measure.ts: which processes a sampled tree holds, on fake `ps` output, then the script
// itself on real commands, some of which leave a sleeper behind.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { afterAll, afterEach, describe, expect, it } from "vitest";

import { identityOf, membersOf, parseArgs, parseProcesses } from "../scripts/measure.ts";
import type { MeasureReport, ProcessInfo } from "../scripts/measure.ts";
import { REPORTS_DIR } from "./paths.ts";

const SCRIPT = fileURLToPath(new URL("../scripts/measure.ts", import.meta.url));
const STARTED = "Fri Nov  6 21:42:00 2026";

const proc = (pid: number, ppid: number, pgid: number, rssKib = 1024): ProcessInfo => ({
  pid,
  ppid,
  pgid,
  rssKib,
  started: STARTED,
});
const pids = (members: readonly ProcessInfo[]) => members.map((member) => member.pid);

describe("parseProcesses", () => {
  it("reads each process, with its start time, and leaves out zombies", () => {
    const output = [
      `  100     1   100   2048 Ss   ${STARTED}`,
      `  101   100   100      0 Z+   ${STARTED}`,
      `  102   100   100    512 R+   ${STARTED}`,
      "",
    ].join("\n");
    expect(parseProcesses(output)).toEqual([
      { pid: 100, ppid: 1, pgid: 100, rssKib: 2048, started: STARTED },
      { pid: 102, ppid: 100, pgid: 100, rssKib: 512, started: STARTED },
    ]);
  });

  it("throws on a line it cannot read, so a broken sampler is loud", () => {
    expect(() => parseProcesses("not a process\n")).toThrow(/ps/);
  });
});

describe("membersOf, on a sampled fake tree", () => {
  const ROOT = 500;
  const elsewhere = [proc(1, 0, 1), proc(90, 1, 90), proc(91, 90, 90)];

  it("walks the root's descendants, across process groups", () => {
    // A browser the runner launched leads its own group: the walk still reaches it.
    const tree = [
      proc(ROOT, 90, ROOT),
      proc(501, ROOT, ROOT),
      proc(600, 501, 600),
      proc(601, 600, 600),
    ];
    expect(pids(membersOf([...elsewhere, ...tree], ROOT, new Set()))).toEqual([500, 501, 600, 601]);
  });

  it("holds an orphan of its process group, reparented to PID 1, which a PPID walk misses", () => {
    const processes = [...elsewhere, proc(ROOT, 90, ROOT), proc(502, 1, ROOT)];
    expect(pids(membersOf(processes, ROOT, new Set()))).toEqual([500, 502]);
  });

  it("holds a process it saw, reparented to PID 1 in a group of its own, and that process's children", () => {
    const orphan = proc(700, 1, 700);
    const seen = new Set([identityOf(orphan)]);
    const processes = [...elsewhere, proc(ROOT, 90, ROOT), orphan, proc(701, 700, 700)];
    expect(pids(membersOf(processes, ROOT, seen))).toEqual([500, 700, 701]);
  });

  it("does not mistake a new process on a PID it saw for that process", () => {
    const seen = new Set([identityOf(proc(700, 1, 700))]);
    const reused = { ...proc(700, 1, 700), started: "Fri Nov  6 22:00:00 2026" };
    expect(pids(membersOf([...elsewhere, reused], ROOT, seen))).toEqual([]);
  });

  it("holds what is left of the group and the seen PIDs once the root has gone", () => {
    const seen = new Set([identityOf(proc(700, 1, 700))]);
    const processes = [...elsewhere, proc(502, 1, ROOT), proc(700, 1, 700)];
    expect(pids(membersOf(processes, ROOT, seen))).toEqual([502, 700]);
  });

  it("holds nothing when no process of the tree is left", () => {
    expect(membersOf(elsewhere, ROOT, new Set())).toEqual([]);
  });
});

describe("parseArgs", () => {
  it("reads the label, the ceiling and the command, which keeps its own flags", () => {
    expect(parseArgs(["vue", "--", "pnpm", "--max-rss-gib", "1", "--", "x"])).toEqual({
      label: "vue",
      maxRssGib: 32,
      command: ["pnpm", "--max-rss-gib", "1", "--", "x"],
    });
    expect(parseArgs(["browser:vue-1", "--max-rss-gib", "0.5", "--", "sleep", "1"])).toEqual({
      label: "browser:vue-1",
      maxRssGib: 0.5,
      command: ["sleep", "1"],
    });
  });

  it.each([
    [[]],
    [["vue"]],
    [["vue", "--"]],
    [["vue", "--", ""]],
    [["--", "sleep", "1"]],
    [["vue", "extra", "--", "sleep", "1"]],
    [["vue", "--max-rss-gib", "--", "sleep", "1"]],
    [["vue", "--max-rss-gib", "0", "--", "sleep", "1"]],
    [["vue", "--max-rss-gib", "-1", "--", "sleep", "1"]],
    [["vue", "--max-rss-gib", "lots", "--", "sleep", "1"]],
    [["vue", "--unknown", "--", "sleep", "1"]],
    [["vue", "--unknown", "1", "--", "sleep", "1"]],
    [["vue", "--max-rss-gib", "1", "extra", "--", "sleep", "1"]],
    [["../out", "--", "sleep", "1"]],
    [["..", "--", "sleep", "1"]],
    [["a/b", "--", "sleep", "1"]],
  ])("refuses %j", (args) => {
    expect(() => parseArgs(args)).toThrow(/Usage/);
  });
});

describe("the script", () => {
  // Real reports, in the directory the tool writes: under a label no baseline uses.
  const LABEL = "unit-test";
  const reportFile = join(REPORTS_DIR, "measure", `${LABEL}.json`);
  const sleepers: number[] = [];

  /** Runs a command through the tool, and reads the report it leaves. */
  function measure(command: readonly string[], ...flags: string[]) {
    rmSync(reportFile, { force: true });
    // The limit ends a command the tool failed to stop, which would otherwise hang the suite.
    const result = spawnSync(process.execPath, [SCRIPT, LABEL, ...flags, "--", ...command], {
      encoding: "utf8",
      timeout: 30_000,
    });
    const report = existsSync(reportFile)
      ? (JSON.parse(readFileSync(reportFile, "utf8")) as MeasureReport)
      : undefined;
    return { status: result.status, out: result.stdout, err: result.stderr, report };
  }
  /** `kill(pid, 0)` also succeeds on a zombie. */
  const isAlive = (pid: number) => {
    const { stdout } = spawnSync("ps", ["-o", "stat=", "-p", String(pid)], { encoding: "utf8" });
    return stdout.trim() !== "" && !stdout.trim().startsWith("Z");
  };
  /**
   * Holds the tool right after it spawns the command, whose first line may by then be out. The
   * natural race is too narrow to hit on demand.
   */
  const SLOW_SPAWN = `data:text/javascript,${encodeURIComponent(`
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
  /**
   * Runs a command through the tool, and sends the signals once the command has printed a PID,
   * kept to kill after the test. It waits for the tool's exit, not its pipe, which a tree the tool
   * failed to stop would hold open.
   */
  async function interrupt(
    command: readonly string[],
    signals: readonly NodeJS.Signals[],
    nodeArgs: readonly string[] = [],
  ) {
    rmSync(reportFile, { force: true });
    const tool = spawn(process.execPath, [...nodeArgs, SCRIPT, LABEL, "--", ...command], {
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
  }
  const node = (script: string) => [process.execPath, "-e", script];
  /** Passes the ceiling these tests set, once the script has set up what it needs. */
  const HOG = "globalThis.hog = Buffer.alloc(300 * 1024 * 1024, 1);";
  const CEILING = ["--max-rss-gib", "0.2"];
  /** The first PID the command printed, kept to kill after the test. */
  const sleeperOf = (out: string) => {
    const pid = Number(/^(\d+)$/m.exec(out)?.[1]);
    expect(pid).toBeGreaterThan(1);
    sleepers.push(pid);
    return pid;
  };
  const SLEEPER_AND_WAIT = ["sh", "-c", "sleep 60 >/dev/null 2>&1 & echo $!; wait"];
  const DETACHED_SLEEPER = `const { spawn } = require("node:child_process");
    const sleeper = spawn("sleep", ["60"], { detached: true, stdio: "ignore" });
    sleeper.unref();
    console.log(sleeper.pid);`;

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

  it("forwards stdout and the exit status, and writes the report", () => {
    const { status, out, report } = measure(["sh", "-c", "sleep 2.2; echo measured; exit 3"]);
    expect(out).toContain("measured");
    expect(status).toBe(3);
    expect(report).toMatchObject({
      label: LABEL,
      command: ["sh", "-c", "sleep 2.2; echo measured; exit 3"],
      outcome: "completed",
      exitStatus: 3,
      maxRssGib: 32,
      leftover: 0,
    });
    expect(report!.wallSeconds).toBeGreaterThanOrEqual(2.2);
    expect(report!.wallSeconds).toBeLessThan(30);
    expect(report!.samples).toBeGreaterThanOrEqual(2);
    expect(report!.peakRssGib).toBeGreaterThan(0);
  });

  it("sums the tree's RSS: neither process alone reaches what it reports", () => {
    const half = "globalThis.hog = Buffer.alloc(100 * 1024 * 1024, 1);";
    const { report } = measure(
      node(`const { spawnSync } = require("node:child_process");
        ${half}
        spawnSync(process.execPath, ["-e", ${JSON.stringify(`${half} setTimeout(() => {}, 3000);`)}]);`),
    );
    expect(report!.peakRssGib).toBeGreaterThan(0.2);
  });

  it("reports the peak, not the last sample", () => {
    const { report } = measure(
      node(`const { spawnSync } = require("node:child_process");
        spawnSync(process.execPath, ["-e", ${JSON.stringify(`${HOG} setTimeout(() => {}, 2500);`)}]);
        setTimeout(() => {}, 2500);`),
    );
    expect(report!.peakRssGib).toBeGreaterThan(0.2);
  });

  it("counts an orphan left in its process group as leftover, outside the wall time", () => {
    const before = performance.now();
    const { status, out, report } = measure(["sh", "-c", "sleep 60 >/dev/null 2>&1 & echo $!"]);
    const elapsed = (performance.now() - before) / 1000;
    const sleeper = sleeperOf(out);
    // A leftover that stays takes the whole 2 s grace, after the command's exit.
    expect(report!.wallSeconds).toBeLessThanOrEqual(elapsed - 1.9);
    expect(status).toBe(0);
    expect(report).toMatchObject({ outcome: "completed", exitStatus: 0, leftover: 1 });
    expect(isAlive(sleeper)).toBe(true);
  });

  it("counts a sleeper it saw that left the process group as leftover", () => {
    const { out, report } = measure(node(`${DETACHED_SLEEPER} setTimeout(() => {}, 2500);`));
    const sleeper = sleeperOf(out);
    expect(report).toMatchObject({ outcome: "completed", leftover: 1 });
    expect(isAlive(sleeper)).toBe(true);
  });

  it("stops its own tree at the ceiling, and only that, and reads did-not-complete", () => {
    const bystander = spawnSync("sh", ["-c", "sleep 60 >/dev/null 2>&1 & echo $!"], {
      encoding: "utf8",
    });
    const other = sleeperOf(bystander.stdout);
    const { status, out, report, err } = measure(
      node(`${DETACHED_SLEEPER} ${HOG} setInterval(() => {}, 1000);`),
      ...CEILING,
    );
    const sleeper = sleeperOf(out);
    expect(status).not.toBe(0);
    expect(err).toContain("ceiling");
    expect(report).toMatchObject({ outcome: "did-not-complete", maxRssGib: 0.2, leftover: 0 });
    expect(report!.peakRssGib).toBeGreaterThanOrEqual(0.2);
    expect(isAlive(sleeper)).toBe(false);
    expect(isAlive(other)).toBe(true);
  });

  it("kills a process that ignores SIGTERM at the ceiling", () => {
    const { status, report, err } = measure(
      node(`process.on("SIGTERM", () => {}); ${HOG} setInterval(() => {}, 1000);`),
      ...CEILING,
    );
    expect(err).toContain("ceiling");
    expect(status).toBe(137);
    expect(report).toMatchObject({ outcome: "did-not-complete", exitStatus: 137, leftover: 0 });
  });

  it("does not call a command that exits 0 on SIGTERM a success at the ceiling", () => {
    const { status, report, err } = measure(
      node(`process.on("SIGTERM", () => process.exit(0)); ${HOG} setInterval(() => {}, 1000);`),
      ...CEILING,
    );
    expect(err).toContain("ceiling");
    expect(status).toBe(1);
    expect(report).toMatchObject({ outcome: "did-not-complete", exitStatus: 0 });
  });

  it.each(["SIGTERM", "SIGINT", "SIGHUP"] as const)(
    "stops the tree when it is itself interrupted by %s",
    async (signal) => {
      const { status, pid } = await interrupt(SLEEPER_AND_WAIT, [signal]);
      expect(status).not.toBe(0);
      expect(isAlive(pid)).toBe(false);
      expect(JSON.parse(readFileSync(reportFile, "utf8"))).toMatchObject({
        outcome: "did-not-complete",
        leftover: 0,
      });
    },
  );

  it("stops the tree when it is interrupted on the command's first line", async () => {
    const { status, pid } = await interrupt(
      SLEEPER_AND_WAIT,
      ["SIGTERM"],
      ["--import", SLOW_SPAWN],
    );
    expect(status).not.toBe(0);
    expect(isAlive(pid)).toBe(false);
    expect(JSON.parse(readFileSync(reportFile, "utf8"))).toMatchObject({
      outcome: "did-not-complete",
      leftover: 0,
    });
  });

  it("still kills a tree that ignores SIGTERM when it is interrupted twice", async () => {
    const { status, pid } = await interrupt(
      node(
        `process.on("SIGTERM", () => {}); console.log(process.pid); setInterval(() => {}, 1000);`,
      ),
      ["SIGTERM", "SIGTERM"],
    );
    expect(status).toBe(137);
    expect(isAlive(pid)).toBe(false);
    expect(JSON.parse(readFileSync(reportFile, "utf8"))).toMatchObject({
      outcome: "did-not-complete",
      exitStatus: 137,
      leftover: 0,
    });
  });

  it("stops the tree and fails when it cannot sample, since no sample means no ceiling", () => {
    rmSync(reportFile, { force: true });
    const result = spawnSync(
      process.execPath,
      [SCRIPT, LABEL, "--", process.execPath, "-e", "setInterval(() => {}, 1000)"],
      { encoding: "utf8", env: { PATH: "/nonexistent" }, timeout: 30_000 },
    );
    expect(result.status).toBe(143);
    expect(result.stderr).toContain("cannot sample");
    expect(JSON.parse(readFileSync(reportFile, "utf8"))).toMatchObject({
      outcome: "did-not-complete",
      leftover: null,
    });
  });

  it("fails loudly on a command that cannot start", () => {
    const { status, err, report } = measure(["uf-no-such-command"]);
    expect(status).toBe(127);
    expect(err).toContain("uf-no-such-command");
    expect(report).toMatchObject({ outcome: "did-not-complete", exitStatus: 127, leftover: 0 });
  });

  it("exits 2 on a usage error and writes nothing", () => {
    rmSync(reportFile, { force: true });
    const result = spawnSync(process.execPath, [SCRIPT, LABEL], { encoding: "utf8" });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Usage");
    expect(existsSync(reportFile)).toBe(false);
  });
});
