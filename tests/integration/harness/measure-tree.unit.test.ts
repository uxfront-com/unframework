// scripts/measure.ts on real commands: what it counts as leftover, and how it stops its tree at the
// ceiling. One of the files that split these tests, which wait on sleeps and sampling, so Vitest
// runs them in parallel (ADR-0093).
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { CEILING, DETACHED_SLEEPER, HOG, isAlive, node, scriptHarness } from "./measure-script.ts";

describe("the script", () => {
  const { measure, sleeperOf } = scriptHarness("unit-test-tree");

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
});
