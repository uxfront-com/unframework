// The toolchain projects (L3, L4): one framework-compile pass and one checker run per target,
// over every case's output, then one test per case. The checkers run once in beforeAll (one
// tsgo / vue-tsc / svelte-check / ngc / astro check run per target, plan §7.3); a checker that
// cannot start fails every case, loudly, and so does one that reports a problem outside the
// outputs (its tsconfig, a file an output imports): every case was checked with it. With
// UF_CANARY, the cases are compiled afresh with the canary under `.canary/<id>/<target>/` and
// those files are checked instead of the goldens.
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
import { CANARY_DIR, ROOT, toolchainDir } from "./paths.ts";
import { loadToolchain } from "./targets.ts";
import { display, frameworkCompileProblems, typecheckProblems } from "./toolchain-results.ts";

const target = inject("target");
const harness = inject("ufHarness");
const cases = listCases(harness.casesDir);

interface Checked {
  /** Each case's output files (absolute paths). */
  files: Map<string, string[]>;
  /** Every output file of the run: a message on any other path fails every case. */
  outputs: Set<string>;
  frameworkCompile: Map<string, FrameworkCompileResult>;
  typecheck: Map<string, ToolchainMessage[]>;
}

let checked: Checked | undefined;
/** Why the toolchain did not run: every case fails L3 and L4 with it. */
let failure: string | undefined;

beforeAll(async () => {
  try {
    const toolchain = await loadToolchain(target);
    const files = await outputFiles();
    const all = [...files.values()].flat();
    const context = { toolchainDir: toolchainDir(target), root: ROOT };
    const contents: ToolchainFile[] = all.map((path) => ({
      path,
      contents: readFileSync(path, "utf8"),
    }));
    const [frameworkCompile, typecheck] = await Promise.all([
      toolchain.frameworkCompile(contents, context),
      toolchain.typecheck(all, context),
    ]);
    checked = { files, outputs: new Set(all), frameworkCompile, typecheck };
  } catch (error) {
    failure = `The ${target} toolchain did not run: ${formatError(error)}${error instanceof Error && error.cause ? `\ncaused by: ${formatError(error.cause)}` : ""}`;
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
          const { files, outputs, frameworkCompile } = ran();
          const problems = frameworkCompileProblems(
            frameworkCompile,
            casesFiles(files, info),
            outputs,
          );
          if (problems.length) throw new Error(problems.join("\n"));
        },
        L4: () => {
          const { files, outputs, typecheck } = ran();
          const problems = typecheckProblems(typecheck, casesFiles(files, info), outputs);
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
    const result = await compile(readFileSync(info.source, "utf8"), {
      filename: info.filename,
      targets: [target as TargetName],
      plugins: canaryPlugins(canary, target),
    });
    const directory = join(root, "cases", info.id, "__output__", target);
    const paths = (result.outputs[target] ?? []).map((file) => {
      const path = join(directory, file.path);
      writeIfChanged(path, file.contents);
      return path;
    });
    files.set(info.id, paths);
  }
  return files;
}

function listFiles(directory: string): string[] {
  return (readdirSync(directory, { recursive: true }) as string[])
    .map((entry) => join(directory, entry))
    .filter((path) => statSync(path).isFile())
    .sort();
}
