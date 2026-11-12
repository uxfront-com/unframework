// The shard files (shards.ts, ADR-0093) keep themselves complete: each share is taken by a rule,
// every canary and case lands in exactly one shard, and the files on disk are exactly those the
// counts name, each calling its own index, in the project that runs them.
import { readdirSync, readFileSync } from "node:fs";
import { join, matchesGlob } from "node:path";

import { TARGET_NAMES } from "@unframework.dev/compiler";
import type { HarnessContext } from "@unframework.dev/testing/node";
import { describe, expect, inject, it } from "vitest";
import type { UserWorkspaceConfig } from "vitest/config";

import { corpusChecks } from "./canaries-corpus.ts";
import { CANARIES } from "./canaries.ts";
import { listCases } from "./cases.ts";
import { ROOT } from "./paths.ts";
import { harnessProjects, ssrShardCount } from "./projects.ts";
import { SHARDS, SSR_SHARDS, shardFiles, shardOf } from "./shards.ts";
import type { ShardKind } from "./shards.ts";

/** Every shard of `items` for `count`, in order. */
const shardsOf = <T>(items: readonly T[], count: number) =>
  Array.from({ length: count }, (_, index) => shardOf(items, index, count));

describe("shardOf", () => {
  it.each([0, 1, 9])("puts each of %i items in exactly one shard, for any count", (length) => {
    const items = Array.from({ length }, (_, index) => `item-${index}`);
    for (const count of [1, 2, 3, 4, 10]) {
      const shards = shardsOf(items, count);
      expect(shards.flat().toSorted()).toEqual(items.toSorted());
      // As even as a rule by position makes them: no shard holds two more than another.
      const sizes = shards.map((shard) => shard.length);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    }
  });

  it.each([
    [0, 0],
    [1, 1],
    [-1, 2],
    [0.5, 2],
    [0, 1.5],
    [0, Number.NaN],
  ])("refuses shard %d of %d", (index, count) => {
    expect(() => shardOf(["a"], index, count)).toThrow(/shard/i);
  });
});

describe("the canaries' corpus shards", () => {
  it("run every plugin canary that changes an output, and the map canary, exactly once", () => {
    const checks = corpusChecks();
    expect(new Set(checks).size).toBe(checks.length);
    expect(checks.toSorted()).toEqual(
      CANARIES.filter(
        (canary) =>
          canary.id === "L14-map-shifted" ||
          (canary.plugin && canary.id !== "L1-plugin-throws" && canary.id !== "L15-slow-compile"),
      )
        .map((canary) => canary.id)
        .toSorted(),
    );
    const shards = shardsOf(checks, SHARDS["canaries-corpus"]);
    expect(shards.flat().toSorted()).toEqual(checks.toSorted());
    // A shard file with no test fails, so every shard has some.
    expect(shards.every((shard) => shard.length > 0)).toBe(true);
  });

  it("take a new canary into one shard", () => {
    const added = { ...CANARIES.find((canary) => canary.plugin !== undefined)!, id: "L99-new" };
    const checks = corpusChecks([...CANARIES, added]);
    const holding = shardsOf(checks, SHARDS["canaries-corpus"]).filter((shard) =>
      shard.includes("L99-new"),
    );
    expect(holding).toHaveLength(1);
  });

  it("are run by the harness project", () => {
    // The harness project's glob (harnessProjects): every corpus shard file matches it.
    for (const file of shardFiles("canaries-corpus")) {
      expect(matchesGlob(file, "harness/*.unit.test.ts")).toBe(true);
    }
  });
});

describe("the ssr shards", () => {
  const harness: HarnessContext = inject("ufHarness");
  const mode = { update: false, pixels: "baseline", canary: null, ci: false } as const;
  /** The ssr project of `target`, resolved, as Vitest resolves it. */
  const ssrProject = async (only?: Record<string, string[]>) => {
    const projects = harnessProjects({ harness, mode, targets: ["react"], referencesOnly: only });
    // compile, harness, toolchain:react, then ssr:react.
    const project = await (projects[3] as () => Promise<UserWorkspaceConfig>)();
    expect(project.test?.name).toBe("ssr:react");
    return project.test!;
  };

  it("are as many as the target's count, or one, and the files on disk hold the most", () => {
    expect(ssrShardCount({}, "angular")).toBe(SSR_SHARDS.angular);
    expect(ssrShardCount({}, "react")).toBe(1);
    expect(TARGET_NAMES).toEqual(expect.arrayContaining(Object.keys(SSR_SHARDS)));
    expect(SHARDS.ssr).toBe(Math.max(...TARGET_NAMES.map((target) => ssrShardCount({}, target))));
    // A count of one is the default: naming it would only hide which targets are split.
    expect(Object.values(SSR_SHARDS).every((count) => Number.isInteger(count) && count > 1)).toBe(
      true,
    );
  });

  it("are what an ssr project includes, its first shard files, with the count it provides", async () => {
    const test = await ssrProject();
    expect(test.include).toEqual(shardFiles("ssr", ssrShardCount({}, "react")));
    expect(test.provide).toMatchObject({ ufSsrShards: ssrShardCount({}, "react") });
  });

  it("are one for a project that renders a reference's cases alone (ADR-0057)", async () => {
    const only = { angular: ["semantics/listbox"] };
    expect(ssrShardCount({ referencesOnly: only }, "angular")).toBe(1);
    expect(ssrShardCount({ referencesOnly: only }, "vue")).toBe(1);
    const test = await ssrProject({ react: ["semantics/listbox"] });
    expect(test.include).toEqual(["harness/ssr.0.test.ts"]);
    expect(test.provide).toMatchObject({ ufSsrShards: 1, ufOnly: ["semantics/listbox"] });
  });

  it.each(Object.keys(SSR_SHARDS))("render every case of the corpus once on %s", (target) => {
    const cases = listCases(harness.casesDir).map((info) => info.id);
    const shards = shardsOf(cases, ssrShardCount({}, target));
    expect(shards.flat().toSorted()).toEqual(cases.toSorted());
    expect(shards.every((shard) => shard.length > 0)).toBe(true);
  });
});

describe("the shard files on disk", () => {
  const harnessDir = join(ROOT, "harness");
  const calls: Record<ShardKind, RegExp> = {
    "canaries-corpus": /^describeCorpusShard\((\d+)\);$/m,
    ssr: /^describeSsrShard\((\d+)\);$/m,
  };

  it.each(Object.keys(SHARDS) as ShardKind[])(
    "are exactly the %s shards the count names, each calling its own index",
    (kind) => {
      const pattern = new RegExp(`^${kind}\\.[^.]+\\.(?:unit\\.)?test\\.ts$`);
      const onDisk = readdirSync(harnessDir)
        .filter((name) => pattern.test(name))
        .map((name) => `harness/${name}`)
        .toSorted();
      expect(onDisk).toEqual(shardFiles(kind).toSorted());
      shardFiles(kind).forEach((file, index) => {
        const match = calls[kind].exec(readFileSync(join(ROOT, file), "utf8"));
        expect(match?.[1], file).toBe(String(index));
      });
    },
  );
});
