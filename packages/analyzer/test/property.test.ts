import { describe, expect, it } from "vitest";

import { isCI, LOCAL_RUNS, propertyRun, replayable, sampleOf, scaledBound } from "./property.ts";

describe("the size of a property test", () => {
  it("is the full size, with the test's own seed, in CI", () => {
    expect(propertyRun(20_160, 11, { CI: "true" })).toEqual({
      seed: 11,
      size: 20_160,
      full: 20_160,
    });
    expect(propertyRun(20_160, 11, { CI: "1" })).toEqual({ seed: 11, size: 20_160, full: 20_160 });
  });

  it("is the local default, with a fresh seed, outside CI", () => {
    for (const env of [{}, { CI: "" }, { CI: "0" }, { CI: "false" }]) {
      const run = propertyRun(20_160, 11, env);
      expect(run.size).toBe(LOCAL_RUNS);
      expect(Number.isInteger(run.seed) && run.seed >= 0 && run.seed <= 0xffff_ffff).toBe(true);
    }
    const seeds = new Set(Array.from({ length: 20 }, () => propertyRun(20_160, 11, {}).seed));
    expect(seeds.size).toBeGreaterThan(1);
  });

  it("keeps the test's own seed where the local default is the full size", () => {
    expect(propertyRun(LOCAL_RUNS, 13, {})).toEqual({
      seed: 13,
      size: LOCAL_RUNS,
      full: LOCAL_RUNS,
    });
    expect(propertyRun(10, 13, {})).toEqual({ seed: 13, size: 10, full: 10 });
  });

  it("takes UF_PROPERTY_RUNS before CI, up to the full size", () => {
    expect(propertyRun(2000, 11, { CI: "true", UF_PROPERTY_RUNS: "50" }).size).toBe(50);
    expect(propertyRun(2000, 11, { UF_PROPERTY_RUNS: "99999" })).toEqual({
      seed: 11,
      size: 2000,
      full: 2000,
    });
  });

  it("replays the seed UF_PROPERTY_SEED names", () => {
    expect(propertyRun(2000, 11, { UF_PROPERTY_SEED: "42", UF_PROPERTY_RUNS: "7" })).toEqual({
      seed: 42,
      size: 7,
      full: 2000,
    });
    expect(propertyRun(2000, 11, { CI: "true", UF_PROPERTY_SEED: "0" }).seed).toBe(0);
  });

  it.each([
    ["UF_PROPERTY_RUNS", "0"],
    ["UF_PROPERTY_RUNS", "-5"],
    ["UF_PROPERTY_RUNS", "1.5"],
    ["UF_PROPERTY_RUNS", "many"],
    ["UF_PROPERTY_SEED", "4294967296"],
    ["UF_PROPERTY_SEED", "0x10"],
  ])("rejects %s=%s", (name, value) => {
    expect(() => propertyRun(2000, 11, { [name]: value })).toThrow(
      `${name} must be a whole number`,
    );
  });

  it("reads CI as its providers set it", () => {
    expect([undefined, "", " ", "0", "false"].map((CI) => isCI({ CI }))).toEqual(
      Array(5).fill(false),
    );
    expect(["1", "true", "yes"].map((CI) => isCI({ CI }))).toEqual([true, true, true]);
  });
});

describe("a sample of an exhaustive list", () => {
  const items = Array.from({ length: 1000 }, (_, index) => index);

  it("is the whole list, in order, at full size", () => {
    expect(sampleOf(items, { seed: 5, size: 1000, full: 1000 })).toEqual(items);
  });

  it("is a seeded subset in the list's order, not a prefix", () => {
    const run = { seed: 5, size: 100, full: 1000 };
    const sample = sampleOf(items, run);
    expect(sample).toHaveLength(100);
    expect(new Set(sample).size).toBe(100);
    expect(sample).toEqual(sample.toSorted((a, b) => a - b));
    expect(sample).not.toEqual(items.slice(0, 100));
    expect(sample.at(-1)).toBeGreaterThan(500);
    expect(sampleOf(items, run)).toEqual(sample);
    expect(sampleOf(items, { ...run, seed: 6 })).not.toEqual(sample);
  });

  it("refuses a list of another size than the run's", () => {
    expect(() => sampleOf(items, { seed: 5, size: 10, full: 999 })).toThrow(
      "The run is for 999 items, not 1000.",
    );
  });
});

describe("a bound scaled to the run", () => {
  it("is the bound itself at full size", () => {
    expect(scaledBound(5_000, { seed: 0, size: 32_034, full: 32_034 })).toBe(5_000);
    expect(scaledBound(1500, { seed: 0, size: 2000, full: 2000 })).toBe(1500);
  });

  it("is the scaled bound less four standard deviations for a sample", () => {
    // 1500 × 500 / 2000 = 375, less 2√500 ≈ 44.7, is 330.3: the count must reach 331.
    expect(scaledBound(1500, { seed: 0, size: 500, full: 2000 })).toBe(330);
    // 5000 × 20 / 10000 = 10, less 2√20 ≈ 8.9, is 1.06: the count must reach 2.
    expect(scaledBound(5000, { seed: 0, size: 20, full: 10_000 })).toBe(1);
    // 1500 × 16 / 2000 = 12, less 2√16 = 8, is 4 exactly: a count of 4 passes.
    expect(scaledBound(1500, { seed: 0, size: 16, full: 2000 })).toBe(3);
  });

  it("asks for nothing from a run too small for a floor", () => {
    for (const size of [1, 2, 10, 16]) {
      const bound = scaledBound(5000, { seed: 0, size, full: 10_000 });
      expect(bound, `size ${size}`).toBe(-1);
      expect(0, `size ${size}`).toBeGreaterThan(bound);
    }
    expect(scaledBound(5_000, { seed: 0, size: 1, full: 32_034 })).toBe(-1);
    expect(scaledBound(1500, { seed: 0, size: 1, full: 2000 })).toBe(-1);
  });
});

describe("a property run that fails", () => {
  it("names the seed and the size that replay it", () => {
    const run = { seed: 42, size: 7, full: 2000 };
    expect(() =>
      replayable(run, () => {
        expect(1).toBe(2);
      }),
    ).toThrow(
      "Property run: seed 42, 7 of 2000 samples. Replay it with UF_PROPERTY_SEED=42 UF_PROPERTY_RUNS=7.",
    );
  });

  it("hands the body its run", () => {
    const run = { seed: 1, size: 2, full: 3 };
    let seen: unknown;
    replayable(run, (given) => {
      seen = given;
    });
    expect(seen).toBe(run);
  });
});
