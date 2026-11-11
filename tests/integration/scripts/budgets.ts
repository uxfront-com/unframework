// L15, budgets (plan §7.2, ADR-0078). It measures what a case costs and compares it with
// `budgets.json`, a generated file:
//
//   pnpm --filter @unframework.dev/integration budgets   the `bench` project, then its summary
//   pnpm test:budgets:update                         measures, and writes `budgets.json`
//
// A compile's time is a ratio with `basics/hello` on the same machine, since an absolute time
// would measure the runner as much as the compiler. A size is each target's framework compile,
// bundled and minified with what its consumer already has left external.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { gzipSync } from "node:zlib";

import type { Toolchain, ToolchainFile } from "@unframework.dev/codegen";
import { compile, TARGET_NAMES } from "@unframework.dev/compiler";
import type { CompilerPlugin, TargetName } from "@unframework.dev/compiler";
import { rolldown } from "rolldown";
import type { Plugin } from "rolldown";
import { Bench } from "tinybench";

import { errorState, listCases } from "../harness/cases.ts";
import type { CaseInfo } from "../harness/cases.ts";
import { ENGINE_DECLARATIONS } from "../harness/engines.ts";
import { committedOutputFiles } from "../harness/output-files.ts";
import { ROOT, toolchainDir } from "../harness/paths.ts";
import { caseOracle, caseResolver } from "../harness/sources.ts";
import { loadToolchain, selectTargets } from "../harness/targets.ts";
import { runSummary } from "./summary.ts";
import { isCI, runVitest } from "./vitest.ts";

/** The generated file of budgets. */
export const BUDGETS_FILE: string = join(ROOT, "budgets.json");

/** The case every compile time is a ratio of. */
export const CALIBRATION = "basics/hello";

/** A size fails above its budget plus this much. */
export const SIZE_MARGIN = 0.05;

/** A compile time fails above its budget times this: the runners are noisy. */
export const TIME_MARGIN = 2;

const ITERATIONS = 20;
const WARMUP_ITERATIONS = 5;

/** A target's output size, in bytes. */
export interface OutputSize {
  raw: number;
  gzip: number;
}

/** What a case costs. */
export interface CaseCost {
  /** Its compile on all seven targets, as a ratio of {@link CALIBRATION}'s. */
  time: number;
  /** Its size on each target it has output for. */
  sizes: Partial<Record<TargetName, OutputSize>>;
}

/** The contents of `budgets.json`. */
export interface Budgets {
  cases: Record<string, CaseCost>;
}

/** The budgets on disk. A missing file fails each cell that reads it, with what to run. */
export function readBudgets(file: string = BUDGETS_FILE): Budgets {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Budgets;
  } catch (cause) {
    throw new Error(`${file} cannot be read. Run \`pnpm test:budgets:update\` to write it.`, {
      cause,
    });
  }
}

/** Every way a compile time and a target's size break their budgets. */
export function budgetProblems(
  budget: CaseCost | undefined,
  target: TargetName,
  time: number,
  size: OutputSize,
): string[] {
  const limit = budget?.sizes[target];
  if (!budget || !limit) return ["No budget for this cell. Run `pnpm test:budgets:update`."];
  const update = "Run `pnpm test:budgets:update` if the change is intended.";
  const problems: string[] = [];
  if (time > budget.time * TIME_MARGIN) {
    problems.push(
      `compile time ${time.toFixed(2)} × ${CALIBRATION} is above ${TIME_MARGIN} × its budget of ${budget.time}. ${update}`,
    );
  }
  for (const kind of ["raw", "gzip"] as const) {
    if (size[kind] > limit[kind] * (1 + SIZE_MARGIN)) {
      problems.push(
        `${kind} size ${size[kind]} B is above its budget of ${limit[kind]} B plus ${SIZE_MARGIN * 100}%. ${update}`,
      );
    }
  }
  return problems;
}

/**
 * What `budgets.json` holds that no cell reads: a case the corpus has left or that has output on
 * no target, and a target of a case that has no output there.
 */
export function staleBudgets(budgets: Budgets, cases: readonly CaseInfo[]): string[] {
  const known = new Map(cases.map((info) => [info.id, info]));
  return Object.entries(budgets.cases).flatMap(([id, budget]) => {
    const info = known.get(id);
    if (!info) return [id];
    return Object.keys(budget.sizes)
      .filter((target) => errorState(info, target) !== false)
      .map((target) => `${id} › ${target}`);
  });
}

/** The cases a budget can judge: a case with output on no target has no cell to fail. */
export function budgetedCases(cases: readonly CaseInfo[]): CaseInfo[] {
  return cases.filter((info) => TARGET_NAMES.some((target) => errorState(info, target) === false));
}

/**
 * Each case's compile time as a ratio of {@link CALIBRATION}'s: every source of the case, to all
 * seven targets with formatting, the median of {@link ITERATIONS} after a warm-up. The calibration
 * case runs before each case, and a ratio divides by the median of those runs: it's the shortest
 * compile of all, so one run alone is noisy, and the run's first would still be warming up.
 */
export async function measureTimes(
  cases: readonly CaseInfo[],
  casesDir: string,
  plugins: () => readonly CompilerPlugin[] = () => [],
): Promise<Map<string, number>> {
  const bench = new Bench({
    iterations: ITERATIONS,
    time: 0,
    warmup: true,
    warmupIterations: WARMUP_ITERATIONS,
    warmupTime: 0,
    throws: true,
    now: cpuTime,
  });
  const calibration = cases.find((info) => info.id === CALIBRATION);
  if (!calibration) throw new Error(`The corpus has no ${CALIBRATION}, which every time divides.`);
  const measured = cases.filter((info) => info !== calibration);
  const before = (id: string) => `${CALIBRATION} before ${id}`;
  for (const info of measured) {
    bench.add(before(info.id), compileCase(calibration, casesDir, plugins));
    bench.add(info.id, compileCase(info, casesDir, plugins));
  }
  await bench.run();
  const median = (name: string): number => {
    const result = bench.getTask(name)?.result;
    if (result?.state !== "completed") throw new Error(`The compile "${name}" did not complete.`);
    return result.latency.p50;
  };
  const calibrations = measured.map((info) => median(before(info.id))).toSorted((a, b) => a - b);
  const divisor = calibrations[calibrations.length >> 1]!;
  return new Map([
    [CALIBRATION, 1],
    ...measured.map((info) => [info.id, median(info.id) / divisor] as const),
  ]);
}

/**
 * This thread's CPU time, in milliseconds. The clock on the wall would charge a compile for
 * whatever else the machine runs: on a loaded machine, two runs' ratios differed tenfold. The
 * process's CPU time would charge it for V8's background GC and JIT, which land on whichever
 * case is running: `types/imported-interface` measured 2 to 5.4 × `basics/hello` from run to run.
 * oxfmt formats on a native thread, so this clock counts almost none of it (ADR-0078).
 */
export function cpuTime(): number {
  const { user, system } = process.threadCpuUsage();
  return (user + system) / 1000;
}

/** One compile of every source of a case, to all seven targets with formatting. */
function compileCase(
  info: CaseInfo,
  casesDir: string,
  plugins: () => readonly CompilerPlugin[],
): () => Promise<void> {
  const sources = info.sources.map((source) => ({
    source,
    text: readFileSync(source.source, "utf8"),
  }));
  return async () => {
    for (const { source, text } of sources) {
      const typeOracle = caseOracle(info, casesDir, { filename: source.filename, text });
      try {
        await compile(text, {
          filename: source.filename,
          targets: TARGET_NAMES,
          plugins: plugins(),
          resolve: caseResolver(info, casesDir, typeOracle),
          typeOracle,
        });
      } finally {
        await typeOracle.dispose();
      }
    }
  };
}

/**
 * A target's size for a case's output files: its framework's compile, then a minified rolldown
 * bundle of every file, with the framework, each stylesheet and each `passThrough` import left
 * external. A size doesn't depend on where the checkout lives, so it holds on any machine.
 */
export async function measureSize(
  toolchain: Toolchain,
  target: string,
  files: readonly string[],
): Promise<OutputSize> {
  if (!files.length) {
    throw new Error(`There's no ${target} output to measure. Run \`pnpm test:update\`.`);
  }
  const contents: ToolchainFile[] = files.map((path) => ({
    path,
    contents: readFileSync(path, "utf8"),
  }));
  const emitted = await toolchain.frameworkEmit(contents, {
    toolchainDir: toolchainDir(target),
    root: ROOT,
    declarations: ENGINE_DECLARATIONS,
  });
  return bundleSize(files.map((path) => emitted.get(path) ?? []));
}

/** The path a module is found by, with no script extension: imports name either kind. */
const moduleKey = (path: string) => path.replace(/\.[cm]?[jt]sx?$/, "");

/**
 * What the bundle of some modules weighs: each list's first module is an entry, and every import
 * outside them is external. A relative import of nothing in the lists, but for a stylesheet,
 * rejects: the bundle would be missing what the module needs.
 */
export async function bundleSize(
  lists: readonly (readonly ToolchainFile[])[],
): Promise<OutputSize> {
  const modules = new Map(lists.flat().map((module) => [moduleKey(module.path), module] as const));
  const memory: Plugin = {
    name: "uf-budgets:memory",
    resolveId(source, importer) {
      if (!importer && modules.has(moduleKey(source))) return moduleKey(source);
      if (!/^\.\.?\//.test(source) || /\.css(?:\?|$)/.test(source)) {
        return { id: source, external: true };
      }
      const key = moduleKey(posix.join(dirname(importer ?? ""), source));
      if (modules.has(key)) return key;
      throw new Error(`${importer ?? ""} imports ${source}, which no module of the case provides.`);
    },
    load(id) {
      const module = modules.get(id);
      if (!module) return undefined;
      const moduleType = /\.[jt]sx$/.test(module.path) ? "tsx" : "ts";
      return { code: module.contents, moduleType };
    },
  };
  const bundle = await rolldown({
    input: lists.flatMap((list) => (list[0] ? [list[0].path] : [])),
    plugins: [memory],
    logLevel: "silent",
    tsconfig: false,
    transform: {
      jsx: { runtime: "automatic" },
      // What a production build of the frameworks replaces, whose branches then drop out.
      define: { "process.env.NODE_ENV": '"production"', ngDevMode: "false" },
    },
  });
  try {
    const { output } = await bundle.generate({ format: "es", minify: true });
    const chunks = output.flatMap((file) => (file.type === "chunk" ? [file.code] : []));
    return {
      raw: chunks.reduce((sum, code) => sum + Buffer.byteLength(code), 0),
      gzip: chunks.reduce((sum, code) => sum + gzipSync(code, { level: 9 }).length, 0),
    };
  } finally {
    await bundle.close();
  }
}

/** Measures every cell and writes `budgets.json`: the baseline, which the margins sit on. */
async function update(): Promise<void> {
  const cases = budgetedCases(listCases());
  const times = await measureTimes(cases, join(ROOT, "cases"));
  const budgets: Budgets = { cases: {} };
  for (const info of cases) {
    // Two decimals, rounded up: more would only record the noise.
    const time = Math.ceil(times.get(info.id)! * 100) / 100;
    budgets.cases[info.id] = { time, sizes: {} };
  }
  for (const target of TARGET_NAMES) {
    const toolchain = await loadToolchain(target);
    for (const info of cases) {
      if (errorState(info, target) !== false) continue;
      const files = committedOutputFiles(info, target);
      budgets.cases[info.id]!.sizes[target] = await measureSize(toolchain, target, files);
    }
  }
  writeFileSync(BUDGETS_FILE, `${JSON.stringify(budgets, null, 2)}\n`);
  process.stdout.write(`[uf:budgets] ${cases.length} case(s) measured → ${BUDGETS_FILE}\n`);
}

async function main(): Promise<number> {
  if (!process.argv.includes("--update")) {
    const started = new Date();
    const { status } = runVitest(["--project", "bench"], process.env);
    const summary = runSummary(process.env, { since: started, requireComplete: false });
    return status || summary;
  }
  if (isCI(process.env) || process.env.UF_CANARY) {
    console.error("[uf] `pnpm test:budgets:update` refuses to run in CI or under a canary.");
    return 1;
  }
  if (selectTargets(process.env.UF_TARGETS).length !== TARGET_NAMES.length) {
    console.error("[uf] `pnpm test:budgets:update` measures every target: unset UF_TARGETS.");
    return 1;
  }
  await update();
  return 0;
}

if (import.meta.main) process.exitCode = await main();
