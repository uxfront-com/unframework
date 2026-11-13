// scripts/measure.ts on real commands: how it stops its tree when it is interrupted, or cannot
// sample. One of the files that split these tests, which wait on sleeps and sampling, so Vitest
// runs them in parallel (ADR-0093).
import { readFileSync, rmSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  isAlive,
  node,
  runTool,
  scriptHarness,
  SLEEPER_AND_WAIT,
  SLOW_SPAWN,
} from "./measure-script.ts";

describe("the script", () => {
  const { label, reportFile, interrupt } = scriptHarness("unit-test-interrupt");

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
    const result = runTool([label, "--", process.execPath, "-e", "setInterval(() => {}, 1000)"], {
      env: { PATH: "/nonexistent" },
    });
    expect(result.status).toBe(143);
    expect(result.err).toContain("cannot sample");
    expect(JSON.parse(readFileSync(reportFile, "utf8"))).toMatchObject({
      outcome: "did-not-complete",
      leftover: null,
    });
  });
});
