import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { QuarantineEntry } from "../src/layers.ts";
import {
  BASELINE_ENVIRONMENT,
  createHarnessRun,
  groupOrder,
  resolveHarnessMode,
} from "../src/node/mode.ts";
import type { HarnessMode } from "../src/node/mode.ts";

const resolve = (
  env: Record<string, string>,
  platform: NodeJS.Platform = "darwin",
  argv: string[] = [],
  arch: NodeJS.Architecture = "x64",
) => resolveHarnessMode({ env, platform, argv, arch });

const container = { UF_BASELINE_ENVIRONMENT: BASELINE_ENVIRONMENT };

describe("resolveHarnessMode", () => {
  it("checks with live pixels by default, on macOS and on a Linux host alike", () => {
    expect(resolve({})).toEqual({
      update: false,
      pixels: "live",
      canary: null,
      ci: false,
      baselineEnvironment: null,
    });
    expect(resolve({}, "linux").pixels).toBe("live");
  });

  it("compares with the committed baselines in the baseline environment", () => {
    expect(resolve(container, "linux")).toMatchObject({
      pixels: "baseline",
      baselineEnvironment: BASELINE_ENVIRONMENT,
    });
  });

  it("reads UF_UPDATE, UF_PIXELS and UF_CANARY", () => {
    expect(resolve({ UF_UPDATE: "1" }).update).toBe(true);
    expect(resolve({ UF_UPDATE: "true" }).update).toBe(true);
    expect(resolve({ UF_UPDATE: "0" }).update).toBe(false);
    expect(resolve({ UF_PIXELS: "baseline" }).pixels).toBe("baseline");
    expect(resolve({ ...container, UF_PIXELS: "live" }, "linux").pixels).toBe("live");
    expect(resolve({ UF_CANARY: "L7-wrong-text" }).canary).toBe("L7-wrong-text");
  });

  it("checks against committed baselines in CI", () => {
    expect(resolve({ CI: "true" }, "linux")).toEqual({
      update: false,
      pixels: "baseline",
      canary: null,
      ci: true,
      baselineEnvironment: null,
    });
  });

  it("refuses to write in CI, to compare live pixels there, or to run it off Linux", () => {
    expect(() => resolve({ CI: "1", UF_UPDATE: "1" }, "linux")).toThrow(/CI never writes/);
    expect(() => resolve({ CI: "1", UF_PIXELS: "live" }, "linux")).toThrow(/never live/);
    expect(() => resolve({ CI: "1" }, "darwin")).toThrow(/runs on Linux, not darwin/);
  });

  it("writes the committed visual baselines only in the baseline environment", () => {
    expect(resolve({ ...container, UF_UPDATE: "1", UF_PIXELS: "baseline" }, "linux")).toMatchObject(
      { update: true, pixels: "baseline" },
    );
    for (const [env, platform, arch] of [
      [{ UF_UPDATE: "1", UF_PIXELS: "baseline" }, "darwin", "arm64"],
      [{ UF_UPDATE: "1", UF_PIXELS: "baseline" }, "linux", "x64"],
      [
        {
          UF_UPDATE: "1",
          UF_BASELINE_ENVIRONMENT: "mcr.microsoft.com/playwright:v1.63.0-noble linux/arm64",
        },
        "linux",
        "arm64",
      ],
    ] as const) {
      expect(() => resolve(env, platform, [], arch)).toThrow(
        /would write the committed Linux baselines, which only mcr\.microsoft\.com\/playwright:v1\.63\.0-noble linux\/amd64 writes/,
      );
    }
    // A plain update elsewhere writes everything but the visual baselines.
    expect(resolve({ UF_UPDATE: "1" }, "linux")).toMatchObject({ update: true, pixels: "live" });
  });

  it("refuses a baseline environment the platform contradicts", () => {
    expect(() => resolve(container, "darwin", [], "arm64")).toThrow(
      /says mcr\.microsoft\.com\/playwright:v1\.63\.0-noble linux\/amd64, but this run is on darwin\/arm64/,
    );
  });

  it("is always live for a run without baselines, in CI too", () => {
    const live = (env: Record<string, string>) =>
      resolveHarnessMode({ env, platform: "linux", argv: [], liveOnly: true });
    expect(live({ CI: "1" })).toMatchObject({ ci: true, pixels: "live" });
    expect(live({ UF_UPDATE: "1" })).toMatchObject({ update: true, pixels: "live" });
    expect(() => live({ CI: "1", UF_UPDATE: "1" })).toThrow(/CI never writes/);
    expect(() => live({ UF_PIXELS: "baseline" })).toThrow(/no committed baselines/);
  });

  it("refuses a canary that would write", () => {
    expect(() => resolve({ UF_CANARY: "L2-drop-attribute", UF_UPDATE: "1" })).toThrow(
      /canary run never writes/,
    );
  });

  it("refuses Vitest's -u, which would let every project write", () => {
    for (const flag of ["-u", "--update", "--update=all"]) {
      expect(() => resolve({}, "darwin", ["vitest", "run", flag])).toThrow(/pnpm test:update/);
    }
  });

  it("refuses values it does not understand", () => {
    expect(() => resolve({ UF_UPDATE: "yes" })).toThrow(/UF_UPDATE must be 1 or 0/);
    expect(() => resolve({ UF_PIXELS: "sometimes" })).toThrow(/UF_PIXELS/);
  });
});

describe("groupOrder", () => {
  const check: Pick<HarnessMode, "update" | "pixels"> = { update: false, pixels: "baseline" };
  const live: Pick<HarnessMode, "update" | "pixels"> = { update: false, pixels: "live" };
  const update: Pick<HarnessMode, "update" | "pixels"> = { update: true, pixels: "live" };

  it("runs everything in parallel in check mode with baselines", () => {
    for (const kind of ["compile", "toolchain", "ssr", "browser"] as const) {
      expect(groupOrder(kind, "react", check, "vue")).toBe(0);
      expect(groupOrder(kind, "vue", check, "vue")).toBe(0);
    }
  });

  it("runs the reference browser project first with live pixels", () => {
    expect(groupOrder("browser", "vue", live, "vue")).toBe(0);
    expect(groupOrder("browser", "react", live, "vue")).toBe(1);
    expect(groupOrder("ssr", "react", live, "vue")).toBe(0);
  });

  it("orders compile, then the reference, then the followers in update mode", () => {
    expect(groupOrder("compile", undefined, update, "vue")).toBe(0);
    expect(groupOrder("harness", undefined, update, "vue")).toBe(0);
    expect(groupOrder("toolchain", "react", update, "vue")).toBe(1);
    expect(groupOrder("ssr", "vue", update, "vue")).toBe(1);
    expect(groupOrder("browser", "vue", update, "vue")).toBe(1);
    expect(groupOrder("ssr", "react", update, "vue")).toBe(2);
    expect(groupOrder("browser", "astro", update, "vue")).toBe(2);
  });
});

/** An L10 quarantine entry of the reference, for one pixel mode or both. */
const l10 = (pixels?: "baseline" | "live"): QuarantineEntry => ({
  case: "basics/hello",
  target: "vue",
  layer: "L10",
  reason: "the reference's capture differs from the Linux baseline",
  issue: "#10",
  ...(pixels ? { pixels } : {}),
});

describe("createHarnessRun", () => {
  it("creates one run per process, clears ended runs' scratch output, and refreshes the cases", () => {
    const root = mkdtempSync(join(tmpdir(), "uf-run-"));
    const scratch = (...path: string[]) => {
      const file = join(root, ...path, "basics", "hello", "initial.png");
      mkdirSync(join(file, ".."), { recursive: true });
      writeFileSync(file, "png");
      return file;
    };
    const ended = spawnSync(process.execPath, ["-e", ""]).pid;
    const endedRun = scratch(".live", `kx1-${ended}`);
    const oldLayout = scratch(".reports", "diffs");
    const concurrent = scratch(".reports", "ledger", `kx2-${process.ppid}`);
    const options = {
      root,
      casesDir: join(root, "cases"),
      reference: "vue",
      mode: {
        update: true,
        pixels: "live",
        canary: null,
        ci: false,
        baselineEnvironment: BASELINE_ENVIRONMENT,
      } as const,
      quarantine: [],
      cases: { "basics/hello": {} },
    };
    const first = createHarnessRun(options);
    expect(existsSync(endedRun)).toBe(false);
    expect(existsSync(oldLayout)).toBe(false);
    expect(existsSync(concurrent)).toBe(true);
    expect(first).toMatchObject({
      reference: "vue",
      update: true,
      pixels: "live",
      canary: null,
      baselineEnvironment: BASELINE_ENVIRONMENT,
      casesDir: join(root, "cases"),
    });
    expect(first.runId).toMatch(new RegExp(`^[0-9a-z]+-${process.pid}$`));
    expect(first.ledgerDir).toBe(join(root, ".reports", "ledger", first.runId));
    expect(first.liveDir).toBe(join(root, ".live", first.runId));
    expect(first.diffsDir).toBe(join(root, ".reports", "diffs", first.runId));

    const second = createHarnessRun({
      ...options,
      cases: { "basics/hello": {}, "basics/new": {} },
    });
    expect(second.runId).toBe(first.runId);
    expect(Object.keys(second.cases)).toEqual(["basics/hello", "basics/new"]);
  });

  it("applies an L10 entry only in the pixel mode it names", () => {
    const root = mkdtempSync(join(tmpdir(), "uf-run-"));
    const run = (pixels: "baseline" | "live", quarantine: QuarantineEntry[]) =>
      createHarnessRun({
        root,
        casesDir: join(root, `cases-${pixels}-${quarantine.length}`),
        reference: "vue",
        mode: { update: false, pixels, canary: null, ci: false },
        quarantine,
        cases: { "basics/hello": {} },
      }).quarantine;
    const both = [l10("baseline"), l10()];
    // Live, the reference's L10 is a skip: an entry for the baselines would go stale there.
    expect(run("live", both)).toEqual([l10()]);
    expect(run("baseline", both)).toEqual(both);
    expect(() => run("live", [{ ...l10("live"), layer: "L7" }])).toThrow(
      /names pixels: "live": only L10 depends on the pixel mode/,
    );
  });
});
