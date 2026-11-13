// The canaries on the corpus: each one must change every target's output of every case it is
// judged on, and keep the IR valid (canaries.unit.test.ts tests them on components of their
// own). It compiles the whole corpus once per canary, so it runs as shard files
// (`canaries-corpus.<k>.unit.test.ts`, ADR-0093), each one call of `describeCorpusShard` with its
// index, which takes its share of `corpusChecks()` by position (`shardOf`). The test titles are
// those of the one file it was, so a run's test names do not change.
import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { compile, TARGET_NAMES } from "@unframework.dev/compiler";
import type { CompileResult, TargetName } from "@unframework.dev/compiler";
import { describe, expect, it } from "vitest";

import {
  CANARIES,
  canaryCase,
  canaryFormats,
  canaryMaps,
  canaryPlugins,
  corrupts,
  findCanary,
} from "./canaries.ts";
import type { Canary } from "./canaries.ts";
import { listCases } from "./cases.ts";
import { sourceMapProblems } from "./compile-checks.ts";
import { CASES_DIR } from "./paths.ts";
import { SHARDS, shardOf } from "./shards.ts";
import { caseOracle, caseResolver } from "./sources.ts";
import { REFERENCE } from "./targets.ts";

/** The canary whose corruption is of the source maps, which the corpus check has a test of its own for. */
const MAP_CANARY = "L14-map-shifted";

/** The targets a canary corrupts: every one, the followers, or the ones it names. */
export function corruptedTargets(canary: Canary): TargetName[] {
  return (
    canary.followersOnly ? TARGET_NAMES.filter((name) => name !== REFERENCE) : [...TARGET_NAMES]
  ).filter((name) => corrupts(canary, name));
}

/**
 * The canaries the corpus check runs, by id, in order: every plugin canary but the one that throws
 * and the one that only slows the compile, which change no output, then the map canary's test.
 * That test compiles the corpus on its own, so it comes last, which puts it in a shard without
 * the slowest plugin canaries while their order stays as it is.
 */
export function corpusChecks(canaries: readonly Canary[] = CANARIES): string[] {
  return [
    ...canaries
      .filter(
        (canary) =>
          canary.plugin && canary.id !== "L1-plugin-throws" && canary.id !== "L15-slow-compile",
      )
      .map((canary) => canary.id),
    MAP_CANARY,
  ];
}

/** Registers shard `index` of the corpus check: its share of `corpusChecks()`. */
export function describeCorpusShard(
  index: number,
  count: number = SHARDS["canaries-corpus"],
): void {
  const ids = new Set(shardOf(corpusChecks(), index, count));

  describe("every canary on the corpus", () => {
    const cases = listCases();

    if (ids.has(MAP_CANARY)) {
      it("L14-map-shifted corrupts one map of every case with output, on every target", async () => {
        const canary = findCanary(MAP_CANARY);
        const evidence = canary.evidence.compile!["round trip"]!;
        const pattern = (target: string) =>
          typeof evidence === "function" ? evidence(target) : evidence;
        const problems: string[] = [];
        let corrupted = 0;
        for (const info of cases) {
          const modules = new Set(info.modules.map(({ source }) => basename(source)));
          const results = await Promise.all(
            info.sources.map(async (source) => {
              const text = readFileSync(source.source, "utf8");
              const typeOracle = caseOracle(info, CASES_DIR, { filename: source.filename, text });
              try {
                const result = await compile(text, {
                  filename: source.filename,
                  targets: TARGET_NAMES,
                  sourceMap: true,
                  resolve: caseResolver(info, CASES_DIR, typeOracle),
                  typeOracle,
                });
                return { source, text, result };
              } finally {
                await typeOracle.dispose();
              }
            }),
          );
          for (const target of TARGET_NAMES) {
            if (
              results.some(({ result }) =>
                result.diagnostics.some(
                  (diagnostic) =>
                    diagnostic.severity === "error" &&
                    (diagnostic.target === undefined || diagnostic.target === target),
                ),
              )
            ) {
              continue;
            }
            const where = `${info.id} › ${target}`;
            const reports = results.map(({ source, text, result }) => {
              const files = result.outputs[target] ?? [];
              const input = { filename: source.filename, text };
              return {
                before: sourceMapProblems(target, files, input, modules),
                after: sourceMapProblems(target, canaryMaps(canary.id, files), input, modules),
              };
            });
            const before = reports.flatMap((report) => report.before);
            if (before.length) problems.push(`${where}: clean maps fail: ${before.join("; ")}`);
            const after = reports.flatMap((report) => report.after);
            if (after.some((message) => pattern(target).test(message))) corrupted += 1;
            else problems.push(`${where}: not caught: ${after.join("; ") || "no problem"}`);
          }
        }
        expect(problems).toEqual([]);
        expect(corrupted).toBeGreaterThan(1000);
      });
    }

    const compiled = new Map<string, Promise<{ input: string; result: CompileResult }>>();
    /** A case's source and its clean compile, once per run of this shard. */
    const clean = (info: (typeof cases)[number]) => {
      let pending = compiled.get(info.id);
      if (!pending) {
        const input = readFileSync(info.source, "utf8");
        pending = compile(input, { filename: info.filename, targets: TARGET_NAMES }).then(
          (result) => ({ input, result }),
        );
        compiled.set(info.id, pending);
      }
      return pending;
    };

    const plugins = CANARIES.filter((canary) => canary.id !== MAP_CANARY && ids.has(canary.id));
    if (!plugins.length) return;
    it.each(plugins)(
      "$id corrupts every case with output on every target it corrupts, keeping the IR valid",
      async (canary) => {
        const problems: string[] = [];
        for (const info of cases) {
          const { input, result } = await clean(info);
          // Only the cases it applies to on each target: the verdict judges no other.
          const applies = canaryCase(info);
          const targets = corruptedTargets(canary).filter(
            (target) =>
              result.outputs[target]?.length &&
              (!canary.appliesTo || canary.appliesTo(applies, target)) &&
              !result.diagnostics.some(
                (diagnostic) =>
                  diagnostic.severity === "error" &&
                  (diagnostic.target === undefined || diagnostic.target === target),
              ),
          );
          if (!targets.length) continue;
          const after = await compile(input, {
            filename: info.filename,
            targets,
            plugins: canaryPlugins(canary.id, targets[0]),
            format: canaryFormats(canary.id),
          });
          for (const diagnostic of after.diagnostics.filter(({ code }) => code === "UF8001")) {
            problems.push(`${info.id}: ${diagnostic.message}`);
          }
          for (const target of targets) {
            if (JSON.stringify(after.outputs[target]) === JSON.stringify(result.outputs[target])) {
              problems.push(`${info.id} › ${target}: the output did not change`);
            }
          }
        }
        expect(problems).toEqual([]);
      },
    );
  });
}
