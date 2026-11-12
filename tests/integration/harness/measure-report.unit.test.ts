// scripts/measure.ts on real commands: what it forwards and what its report holds: the exit status,
// the summed and the peak RSS, and a command that cannot start. One of the files that split these
// tests, which wait on sleeps and sampling, so Vitest runs them in parallel (ADR-0093).
import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { HOG, node, SCRIPT, scriptHarness } from "./measure-script.ts";

describe("the script", () => {
  const { label, reportFile, measure } = scriptHarness("unit-test-report");

  it("forwards stdout and the exit status, and writes the report", () => {
    const { status, out, report } = measure(["sh", "-c", "sleep 2.2; echo measured; exit 3"]);
    expect(out).toContain("measured");
    expect(status).toBe(3);
    expect(report).toMatchObject({
      label: label,
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

  it("fails loudly on a command that cannot start", () => {
    const { status, err, report } = measure(["uf-no-such-command"]);
    expect(status).toBe(127);
    expect(err).toContain("uf-no-such-command");
    expect(report).toMatchObject({ outcome: "did-not-complete", exitStatus: 127, leftover: 0 });
  });

  it("exits 2 on a usage error and writes nothing", () => {
    rmSync(reportFile, { force: true });
    const result = spawnSync(process.execPath, [SCRIPT, label], { encoding: "utf8" });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Usage");
    expect(existsSync(reportFile)).toBe(false);
  });
});
