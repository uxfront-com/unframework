import { describe, expect, it } from "vitest";

import {
  checkLayers,
  LayerFailure,
  layerFailures,
  mergeOutcomes,
  quarantineFor,
  recordLayer,
  settleOutcome,
} from "../src/layers.ts";
import type { LayerTask, QuarantineEntry } from "../src/layers.ts";

const subject = { case: "basics/hello", target: "react" };
const entry: QuarantineEntry = {
  case: "basics/hello",
  target: "react",
  layer: "L7",
  reason: "React adds a wrapper",
  issue: "https://example.test/issues/1",
};
const task = (): LayerTask => ({ meta: {} });

describe("mergeOutcomes", () => {
  it("lets a failure win over everything", () => {
    const fail = { status: "fail", message: "boom" } as const;
    expect(mergeOutcomes({ status: "pass" }, fail)).toBe(fail);
    expect(mergeOutcomes(fail, { status: "pass" })).toBe(fail);
    expect(mergeOutcomes({ status: "quarantined", issue: "x" }, fail)).toBe(fail);
    expect(mergeOutcomes({ status: "skip", reason: "x" }, fail)).toBe(fail);
  });

  it("ranks quarantined over pass, and pass over skip", () => {
    const quarantined = { status: "quarantined", issue: "x" } as const;
    expect(mergeOutcomes({ status: "pass" }, quarantined)).toBe(quarantined);
    expect(mergeOutcomes({ status: "skip", reason: "r" }, { status: "pass" })).toEqual({
      status: "pass",
    });
  });

  it("keeps every distinct failure message, once, in order", () => {
    expect(
      mergeOutcomes({ status: "fail", message: "a" }, { status: "fail", message: "b" }),
    ).toEqual({ status: "fail", message: "a\nb" });
    expect(
      mergeOutcomes({ status: "fail", message: "a" }, { status: "fail", message: "a" }),
    ).toEqual({ status: "fail", message: "a" });
    expect(
      mergeOutcomes(
        { status: "fail", message: "server console" },
        { status: "pass" },
        { status: "fail", message: "page console" },
        { status: "fail", message: "server console" },
      ),
    ).toEqual({ status: "fail", message: "server console\npage console" });
  });

  it("refuses to merge nothing", () => {
    expect(() => mergeOutcomes()).toThrow(/at least one outcome/);
  });
});

describe("settleOutcome (a whole cell under its entry)", () => {
  it("leaves outcomes alone without a quarantine entry", () => {
    expect(settleOutcome({ status: "pass" })).toEqual({ status: "pass" });
  });

  it("keeps a cell that still fails quarantined, with its issue", () => {
    expect(settleOutcome({ status: "fail", message: "differs" }, entry)).toEqual({
      status: "quarantined",
      issue: entry.issue,
    });
    expect(settleOutcome({ status: "quarantined", issue: entry.issue }, entry)).toEqual({
      status: "quarantined",
      issue: entry.issue,
    });
  });

  it("fails a cell that passes: the entry is stale", () => {
    const outcome = settleOutcome({ status: "pass" }, entry);
    expect(outcome.status).toBe("fail");
    expect(outcome.status === "fail" && outcome.message).toMatch(
      /^stale quarantine entry: remove it\. basics\/hello › react › L7 passes/,
    );
  });

  it("fails a cell that is skipped: the entry cannot be checked", () => {
    const outcome = settleOutcome({ status: "skip", reason: "no output" }, entry);
    expect(outcome.status === "fail" && outcome.message).toMatch(/is skipped \(no output\)/);
    expect(outcome.status === "fail" && outcome.message).not.toMatch(/pixel mode/);
  });

  it("points a stale L10 entry at the pixel mode it may only need", () => {
    const outcome = settleOutcome(
      { status: "skip", reason: "live pixels: the reference's capture is this run's expectation" },
      { ...entry, layer: "L10" },
    );
    expect(outcome.status === "fail" && outcome.message).toMatch(
      /If only one pixel mode fails it, name that mode in the entry \(pixels: "baseline" or "live"\)\.$/,
    );
  });
});

describe("quarantineFor", () => {
  it("matches case, target and layer exactly", () => {
    expect(quarantineFor([entry], subject, "L7")).toBe(entry);
    expect(quarantineFor([entry], subject, "L10")).toBeUndefined();
    expect(quarantineFor([entry], { ...subject, target: "vue" }, "L7")).toBeUndefined();
    expect(quarantineFor(undefined, subject, "L7")).toBeUndefined();
  });
});

describe("recordLayer", () => {
  it("creates the record and merges repeated layers", () => {
    const t = task();
    recordLayer(t, subject, "L7", { status: "pass" });
    recordLayer(t, subject, "L7", { status: "fail", message: "second scenario" });
    recordLayer(t, subject, "L11", { status: "pass" });
    expect(t.meta.uf).toEqual({
      case: "basics/hello",
      target: "react",
      layers: { L7: { status: "fail", message: "second scenario" }, L11: { status: "pass" } },
    });
  });

  it("records a failure the quarantine covers as quarantined, and returns it", () => {
    const t = task();
    const recorded = recordLayer(t, { ...subject, quarantine: [entry] }, "L7", {
      status: "fail",
      message: "x",
    });
    expect(recorded).toEqual({ status: "quarantined", issue: entry.issue });
    expect(t.meta.uf?.layers.L7).toEqual(recorded);
  });

  it("records a pass or a skip under an entry as it is: the run decides staleness per cell", () => {
    const passing = task();
    expect(
      recordLayer(passing, { ...subject, quarantine: [entry] }, "L7", { status: "pass" }),
    ).toEqual({ status: "pass" });
    const skipped = task();
    expect(
      recordLayer(skipped, { ...subject, quarantine: [entry] }, "L7", {
        status: "skip",
        reason: "no output",
      }),
    ).toEqual({ status: "skip", reason: "no output" });
  });

  it("refuses a skip without a reason", () => {
    for (const reason of ["", "  ", undefined]) {
      expect(() =>
        recordLayer(task(), subject, "L7", { status: "skip", reason: reason as string }),
      ).toThrow(/a skip needs a reason/);
    }
  });

  it("refuses a second case or target on the same test", () => {
    const t = task();
    recordLayer(t, subject, "L7", { status: "pass" });
    expect(() => recordLayer(t, { ...subject, target: "vue" }, "L7", { status: "pass" })).toThrow(
      /records one case and target/,
    );
  });
});

describe("checkLayers", () => {
  it("records every layer and passes when all pass or skip", async () => {
    const t = task();
    await checkLayers(t, subject, {
      L2: () => {},
      L1: async () => {},
      L3: () => ({ skip: "compile errors: no output" }),
    });
    expect(t.meta.uf?.layers).toEqual({
      L1: { status: "pass" },
      L2: { status: "pass" },
      L3: { status: "skip", reason: "compile errors: no output" },
    });
  });

  it("runs every check, then fails with every message in layer order", async () => {
    const t = task();
    const ran: string[] = [];
    const error = await checkLayers(t, subject, {
      L11: () => {
        ran.push("L11");
        throw new Error("axe found image-alt");
      },
      L7: () => {
        ran.push("L7");
        throw new Error("dom differs");
      },
      L10: () => {
        ran.push("L10");
      },
    }).catch((caught: unknown) => caught);
    expect(ran).toEqual(["L7", "L10", "L11"]);
    expect(error).toBeInstanceOf(LayerFailure);
    expect((error as LayerFailure).failures).toEqual([
      "L7: dom differs",
      "L11: axe found image-alt",
    ]);
    expect((error as Error).message).toMatch(/^basics\/hello › react: 2 layer\(s\) failed/);
    expect(layerFailures(t)).toEqual(["L7: dom differs", "L11: axe found image-alt"]);
    expect(t.meta.uf?.layers.L10).toEqual({ status: "pass" });
  });

  it("does not fail a test for a quarantined failure, nor for a pass under an entry", async () => {
    const quarantined = task();
    await checkLayers(
      quarantined,
      { ...subject, quarantine: [entry] },
      {
        L7: () => {
          throw new Error("known");
        },
      },
    );
    expect(quarantined.meta.uf?.layers.L7).toEqual({ status: "quarantined", issue: entry.issue });

    // Another test of the same cell may still fail: the reporter settles the merged cell.
    const passing = task();
    await checkLayers(passing, { ...subject, quarantine: [entry] }, { L7: () => {} });
    expect(passing.meta.uf?.layers.L7).toEqual({ status: "pass" });
  });

  it("fails a check whose return value is neither nothing nor a skip with a reason", async () => {
    const t = task();
    const error = await checkLayers(t, subject, {
      L6: () => ({ skip: "  " }),
      L7: (() => ({ pass: false, message: "dom differs" })) as never,
      L10: () => ({ skip: "live pixels" }),
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(LayerFailure);
    expect(t.meta.uf?.layers).toEqual({
      L6: {
        status: "fail",
        message: expect.stringMatching(/^The check returned \{"skip":" {2}"\}/),
      },
      L7: { status: "fail", message: expect.stringMatching(/^The check returned \{"pass":false/) },
      L10: { status: "skip", reason: "live pixels" },
    });
  });

  it("keeps a line diff of multi-line assertion failures", async () => {
    const t = task();
    await expect(
      checkLayers(t, subject, {
        L6: () => expect("<p>\n  a\n</p>").toBe("<p>\n  b\n</p>"),
      }),
    ).rejects.toThrow(LayerFailure);
    const outcome = t.meta.uf?.layers.L6;
    expect(outcome?.status === "fail" && outcome.message).toContain("-   b\n+   a");
  });
});
