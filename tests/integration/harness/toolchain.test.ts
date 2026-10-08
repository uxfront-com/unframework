// The toolchain projects (L3, L4, L5): one framework-compile pass, one checker run and one lint
// run per target, over every case's output, then one test per case. The tools run once in
// beforeAll (per target, one tsgo / vue-tsc / svelte-check / ngc / astro check run, one oxlint
// run and, for a template language, one ESLint run, plan §7.3); a tool that cannot start fails
// its own layer on every case, loudly, and so does one that reports a problem outside the
// outputs (its configuration, a file an output imports): every case was checked with it. Each
// tool settles on its own, so a linter that cannot read a canary's corrupted file fails L5 and
// leaves L3's and L4's evidence alone. With UF_CANARY, the cases are compiled afresh with the
// canary under `.canary/<id>/<target>/` and those files are checked instead of the goldens. L4's
// checker run also reads each case's consumer fixtures (ADR-0059, `consumers.ts`), copied beside
// a canary's compile so they import it.
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

import type { FrameworkCompileResult, ToolchainFile, ToolchainMessage } from "@unframework/codegen";
import { compile } from "@unframework/compiler";
import type { TargetName } from "@unframework/compiler";
import { checkLayers, formatError, writeIfChanged } from "@unframework/testing/node";
import { beforeAll, describe, inject, it } from "vitest";

import { canaryPlugins } from "./canaries.ts";
import { errorState, listCases } from "./cases.ts";
import type { CaseInfo } from "./cases.ts";
import { consumerFixtures, consumerProblems, copyFixtures } from "./consumers.ts";
import type { Fixture } from "./consumers.ts";
import { CANARY_DIR, ROOT, toolchainDir } from "./paths.ts";
import { caseResolver } from "./sources.ts";
import { loadToolchain } from "./targets.ts";
import {
  display,
  frameworkCompileProblems,
  lintProblems,
  typecheckProblems,
} from "./toolchain-results.ts";

const target = inject("target");
const harness = inject("ufHarness");
const cases = listCases(harness.casesDir);

interface Checked {
  /** Each case's output files (absolute paths). */
  files: Map<string, string[]>;
  /** Every output file of the run: a message on any other path fails every case. */
  outputs: Set<string>;
  /** Each case's consumer fixtures, which only the checker reads (L4). */
  fixtures: Map<string, Fixture[]>;
  /** Every file the checker read: the outputs and the fixtures. */
  typechecked: Set<string>;
  /** What each tool returned, or why it did not run, by the layer it decides. */
  L3: PromiseSettledResult<Map<string, FrameworkCompileResult>>;
  L4: PromiseSettledResult<Map<string, ToolchainMessage[]>>;
  L5: PromiseSettledResult<Map<string, ToolchainMessage[]>>;
}

/** The tool that decides each layer, as its failure names it. */
const TOOLS = { L3: "framework compiler", L4: "checker", L5: "linter" } as const;

let checked: Checked | undefined;
/** Why no tool ran (the toolchain or the outputs could not load): every case fails each layer. */
let failure: string | undefined;

beforeAll(async () => {
  try {
    const toolchain = await loadToolchain(target);
    const files = await outputFiles();
    const all = [...files.values()].flat();
    const fixtures = caseFixtures(files);
    const typechecked = new Set([
      ...all,
      ...[...fixtures.values()].flat().map(({ checked }) => checked),
    ]);
    const context = { toolchainDir: toolchainDir(target), root: ROOT };
    const contents: ToolchainFile[] = all.map((path) => ({
      path,
      contents: readFileSync(path, "utf8"),
    }));
    const [L3, L4, L5] = await Promise.allSettled([
      toolchain.frameworkCompile(contents, context),
      toolchain.typecheck([...typechecked], context),
      toolchain.lint(all, context),
    ]);
    checked = { files, outputs: new Set(all), fixtures, typechecked, L3, L4, L5 };
  } catch (error) {
    failure = `The ${target} toolchain did not run: ${describeError(error)}`;
  }
});

describe(`toolchain:${target}`, () => {
  for (const info of cases) {
    const errors = errorState(info, target);
    // A case with compile errors has no output: the compile project records L3+ as skipped.
    if (errors === true) continue;
    it(`${info.id} › ${target}`, async ({ task }) => {
      if (errors instanceof Error) throw errors;
      const subject = { case: info.id, target, quarantine: harness.quarantine };
      await checkLayers(task, subject, {
        L3: () => {
          const { files, outputs, L3 } = ran();
          const problems = frameworkCompileProblems(
            results("L3", L3),
            casesFiles(files, info),
            outputs,
          );
          if (problems.length) throw new Error(problems.join("\n"));
        },
        L4: () => {
          const { files, fixtures, typechecked, L4 } = ran();
          const messages = results("L4", L4);
          const problems = [
            ...typecheckProblems(messages, casesFiles(files, info), typechecked),
            ...consumerProblems(target, info, fixtures.get(info.id) ?? [], messages),
          ];
          if (problems.length) throw new Error(problems.join("\n"));
        },
        L5: () => {
          const { files, outputs, L5 } = ran();
          const problems = lintProblems(results("L5", L5), casesFiles(files, info), outputs);
          if (problems.length) throw new Error(problems.join("\n"));
        },
      });
    });
  }
});

function ran(): Checked {
  if (failure !== undefined || !checked) throw new Error(failure ?? "The toolchain did not run.");
  return checked;
}

/** A tool's results, or its failure to run, which fails its layer. */
function results<T>(layer: keyof typeof TOOLS, settled: PromiseSettledResult<T>): T {
  if (settled.status === "fulfilled") return settled.value;
  throw new Error(`The ${target} ${TOOLS[layer]} did not run: ${describeError(settled.reason)}`);
}

/** An error and its cause, as a failure shows them. */
function describeError(error: unknown): string {
  const cause =
    error instanceof Error && error.cause ? `\ncaused by: ${formatError(error.cause)}` : "";
  return `${formatError(error)}${cause}`;
}

function casesFiles(files: Map<string, string[]>, info: CaseInfo): string[] {
  const list = files.get(info.id);
  if (list?.length) return list;
  const directory = display(join(info.dir, "__output__", target));
  throw new Error(
    harness.canary
      ? `The canary compile of ${info.id} produced no ${target} output.`
      : `Missing artefact ${directory}. Run \`pnpm test:update\` to write it.`,
  );
}

/**
 * Each case's output files: the committed `__output__/<target>/` tree, or, with a canary, a
 * fresh compile written to `.canary/<id>/<target>/cases/<case>/__output__/<target>/`.
 */
async function outputFiles(): Promise<Map<string, string[]>> {
  const files = new Map<string, string[]>();
  // A case whose expected diagnostics are missing fails its own test; check what it has.
  const checked = cases.filter((info) => errorState(info, target) !== true);
  const canary = harness.canary;
  if (!canary) {
    for (const info of checked) {
      const directory = join(info.dir, "__output__", target);
      files.set(info.id, existsSync(directory) ? listFiles(directory) : []);
    }
    return files;
  }
  // Each target's project writes its own tree: the projects run in parallel.
  const root = join(CANARY_DIR, canary, target);
  rmSync(root, { recursive: true, force: true });
  for (const info of checked) {
    // Every source of the case, as the compile project writes them into one tree (ADR-0057):
    // a parent's output imports its children's.
    const directory = join(root, "cases", info.id, "__output__", target);
    const paths: string[] = [];
    for (const source of info.sources) {
      const result = await compile(readFileSync(source.source, "utf8"), {
        filename: source.filename,
        targets: [target as TargetName],
        plugins: canaryPlugins(canary, target),
        resolve: caseResolver(info, harness.casesDir),
      });
      for (const file of result.outputs[target] ?? []) {
        const path = join(directory, file.path);
        writeIfChanged(path, file.contents);
        paths.push(path);
      }
    }
    files.set(info.id, paths.sort());
  }
  return files;
}

/**
 * Each case's consumer fixtures, for the cases with output: the committed files, or, with a
 * canary, copies beside its compile under `.canary/<id>/<target>/consumers/`.
 */
function caseFixtures(files: Map<string, string[]>): Map<string, Fixture[]> {
  const fixtures = new Map<string, Fixture[]>();
  for (const id of files.keys()) {
    const paths = consumerFixtures(target, id);
    if (!paths.length) continue;
    fixtures.set(
      id,
      harness.canary
        ? copyFixtures(paths, join(CANARY_DIR, harness.canary, target), id)
        : paths.map((path) => ({ path, checked: path })),
    );
  }
  return fixtures;
}

function listFiles(directory: string): string[] {
  return (readdirSync(directory, { recursive: true }) as string[])
    .map((entry) => join(directory, entry))
    .filter((path) => statSync(path).isFile())
    .sort();
}
