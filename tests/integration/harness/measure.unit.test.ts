// scripts/measure.ts: which processes a sampled tree holds, on fake `ps` output, and how it reads
// its arguments. The script itself, on real commands, is tested in `measure-report`,
// `measure-tree` and `measure-interrupt.unit.test.ts` (ADR-0093).
import { describe, expect, it } from "vitest";

import { identityOf, membersOf, parseArgs, parseProcesses } from "../scripts/measure.ts";
import type { ProcessInfo } from "../scripts/measure.ts";

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
