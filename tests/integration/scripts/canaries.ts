// `pnpm test:canaries` (plan §7.7): runs each canary against the projects that verify its layer,
// with UF_CANARY=<id>, and fails unless the run failed and the layer caught the canary on every
// case and target it corrupts, in every sub-check the canary names (harness/canary-verdict.ts).
// Each run's parity matrix, the specs it could not load and its log go to `.canary/<id>/`.
//
//   pnpm test:canaries                    every canary
//   pnpm test:canaries L7-wrong-text …    some of them
//   pnpm test:canaries L5 L8              the canaries of some layers (each CI job runs one
//                                         layer or one canary)
//   pnpm test:canaries L8 --shard 1/2     a part of the cases, as CI runs a browser canary
//                                         (ADR-0052)
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { LAYERS } from "@unframework/testing/node";
import type { LayerName, PartialMatrix, ProjectKind } from "@unframework/testing/node";

import { canaryCase, canaryProjects, CANARIES, findCanary } from "../harness/canaries.ts";
import type { Canary, CanaryCase } from "../harness/canaries.ts";
import { judgeCanary } from "../harness/canary-verdict.ts";
import type { CanaryVerdict } from "../harness/canary-verdict.ts";
import { listCases } from "../harness/cases.ts";
import { LOAD_FAILURES, readLoadFailures } from "../harness/load-failures.ts";
import { CANARY_DIR, ROOT } from "../harness/paths.ts";
import { selectTargets } from "../harness/targets.ts";
import { runVitest } from "./vitest.ts";

const PROJECTS: Record<ProjectKind, string> = {
  compile: "compile",
  harness: "harness",
  toolchain: "toolchain:*",
  ssr: "ssr:*",
  browser: "browser:*",
};

/**
 * The canaries the arguments name: a canary's id, or a layer for every canary of that layer.
 * An unknown name, or a layer without canaries, throws: a typo never runs nothing.
 */
export function selectCanaries(names: readonly string[]): Canary[] {
  if (!names.length) return [...CANARIES];
  const selected = names.flatMap((name) => {
    if (!LAYERS.includes(name as LayerName)) return [findCanary(name)];
    const ofLayer = CANARIES.filter((canary) => canary.layer === name);
    if (!ofLayer.length) throw new Error(`No canary proves ${name}: it is not live.`);
    return ofLayer;
  });
  return [...new Set(selected)];
}

/** One part of the corpus (`--shard <index>/<count>`), from 1 to `count`. */
export interface CanaryShard {
  index: number;
  count: number;
}

/** The canaries the arguments name, and the shard `--shard <index>/<count>` names, if any. */
export function parseArguments(argv: readonly string[]): {
  names: string[];
  shard: CanaryShard | undefined;
} {
  const names: string[] = [];
  let shard: CanaryShard | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (argument === "--") continue;
    const option = /^--shard(?:=(.*))?$/s.exec(argument);
    if (!option) {
      names.push(argument);
      continue;
    }
    if (shard) throw new Error("--shard is given twice.");
    const value = option[1] ?? argv[(index += 1)] ?? "";
    const match = /^(\d+)\/(\d+)$/.exec(value);
    const [part, count] = [Number(match?.[1]), Number(match?.[2])];
    if (!match || part < 1 || part > count) {
      throw new Error(
        `--shard takes <index>/<count>, from 1/<count> to <count>/<count>: "${value}".`,
      );
    }
    shard = { index: part, count };
  }
  return { names, shard };
}

/**
 * The cases of a shard: every `count`th case of the corpus, from the `index`th. Shards 1 to
 * `count` hold every case once, and share each area's cases, so the diagnostics cases, which
 * have no spec, do not leave one shard with the browser specs.
 */
export function shardCases<T>(cases: readonly T[], shard: CanaryShard | undefined): T[] {
  return shard
    ? cases.filter((_, position) => position % shard.count === shard.index - 1)
    : [...cases];
}

/**
 * The file filters of a shard. A browser project runs a spec a case, so it runs the shard's
 * specs alone; the other projects run one harness file over the corpus, which they run whole,
 * as does a project whose toolchain cannot load (`harness/unavailable.test.ts`).
 */
export function shardFilters(
  cases: readonly CanaryCase[],
  shard: CanaryShard | undefined,
): string[] {
  return shard ? ["harness/", ...cases.flatMap((info) => (info.spec ? [info.spec] : []))] : [];
}

/** Runs one canary and judges whether its layer caught it everywhere it should. */
function runCanary(
  canary: Canary,
  targets: readonly string[],
  cases: readonly CanaryCase[],
  shard: CanaryShard | undefined,
): CanaryVerdict & { log: string; seconds: number } {
  const directory = join(CANARY_DIR, canary.id);
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  const env: NodeJS.ProcessEnv = { ...process.env, UF_CANARY: canary.id };
  delete env.UF_UPDATE;
  const args = canaryProjects(canary).flatMap((kind) =>
    // A canary of some targets runs their projects only: the others have nothing corrupted.
    canary.targets && kind !== "compile" && kind !== "harness"
      ? canary.targets
          .filter((target) => targets.includes(target))
          .flatMap((target) => ["--project", `${kind}:${target}`])
      : ["--project", PROJECTS[kind]],
  );
  args.push(...shardFilters(cases, shard));
  const started = performance.now();
  const { status, stdout } = runVitest(args, env, "pipe");
  const seconds = (performance.now() - started) / 1000;
  const log = join(directory, "vitest.log");
  writeFileSync(log, stdout);
  const matrixFile = join(directory, "parity-matrix.json");
  const matrix = existsSync(matrixFile)
    ? (JSON.parse(readFileSync(matrixFile, "utf8")) as PartialMatrix)
    : undefined;
  const loadFailures = readLoadFailures(join(directory, LOAD_FAILURES));
  return {
    ...judgeCanary(canary, { status, projects: matrix?.byProject, loadFailures }, targets, cases),
    log,
    seconds,
  };
}

function main(): number {
  const { names, shard } = parseArguments(process.argv.slice(2));
  const canaries = selectCanaries(names);
  const targets = selectTargets(process.env.UF_TARGETS);
  // Every kind of project is judged on the shard's cases: shards 1 to n judge each case once.
  const cases = shardCases(listCases(), shard).map(canaryCase);
  const print = (line: string) => process.stdout.write(`${line}\n`);
  if (shard) print(`[uf:canaries] Shard ${shard.index}/${shard.count}: ${cases.length} cases.`);
  const missed: string[] = [];
  for (const canary of canaries) {
    const verdict = runCanary(canary, targets, cases, shard);
    print(
      `[uf:canaries] ${canary.id} (${canary.layer}, ${canaryProjects(canary).join(" + ")}): ${verdict.caught ? "caught" : "NOT CAUGHT"} in ${verdict.seconds.toFixed(1)} s`,
    );
    for (const note of verdict.notes) print(`    (${note})`);
    for (const problem of verdict.problems) print(`    ${problem}`);
    if (!verdict.caught) {
      print(`    log: ${relative(ROOT, verdict.log)}`);
      missed.push(canary.id);
    }
  }
  print(
    missed.length
      ? `[uf:canaries] ${missed.length} of ${canaries.length} canaries were not caught: ${missed.join(", ")}. Logs and matrices: ${relative(ROOT, CANARY_DIR)}/<id>/.`
      : `[uf:canaries] All ${canaries.length} canaries were caught on every case and target they corrupt (${targets.join(", ")}${shard ? `; shard ${shard.index}/${shard.count}` : ""}).`,
  );
  return missed.length ? 1 : 0;
}

if (import.meta.main) process.exitCode = main();
