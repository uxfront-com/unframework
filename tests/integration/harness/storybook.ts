// What the harness gives a target's Storybook (`tests/storybook/<target>/.storybook/main.ts`): the
// stories, generated from the corpus on every start, and the compile options. There is no second
// list of cases: a new case or scenario is a new story with no other edit.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { writeIfChanged } from "@unframework/testing/node";
import type { UnframeworkOptions } from "@unframework/unplugin/vite";
import { generateRunner, generateStories } from "@unframework/visual";
import type { GeneratedFile, Story } from "@unframework/visual";
import { createStorybookConfig } from "@unframework/visual/preset";
import type { StorybookConfig } from "@unframework/visual/preset";

import { caseStories, listCases } from "./cases.ts";
import type { CaseInfo } from "./cases.ts";
import { enginePlugins, toolchainContext } from "./engines.ts";
import { goldenGuard } from "./guard.ts";
import { noOutputCases, noOutputPlugin, standInCases, standInReasons } from "./no-output.ts";
import { CASES_DIR, REPO_ROOT, ROOT } from "./paths.ts";
import { QUARANTINE } from "./quarantine.ts";
import { loadToolchain } from "./targets.ts";

/** The targets whose Storybook is proved to build and open: the others join it target by target. */
export const STORYBOOK_TARGETS: readonly string[] = ["vue"];

/** The cases a `storybook <target> --cases …` keeps, comma-separated. */
export const CASES_ENV = "UF_STORYBOOK_CASES";

/** A target's Storybook package. */
export function storybookDir(target: string): string {
  return join(REPO_ROOT, "tests", "storybook", target);
}

/**
 * Where a target's stories files are written: gitignored, and outside what Turborepo hashes, since
 * they follow from the corpus and the generator, which it hashes already. A start that keeps some
 * cases has a directory of its own, or it would delete the stories of a build running beside it.
 */
export function storiesDir(target: string, cases?: string, root: string = ROOT): string {
  // A hash, since a dozen case ids would be longer than a file name may be.
  const kept = cases && createHash("sha256").update(cases).digest("hex").slice(0, 12);
  return join(root, ".uf-cache", "storybook", kept ? `${target}--${kept}` : target);
}

/** The cases a value of {@link CASES_ENV} names. Throws on one the corpus doesn't hold. */
export function selectCases(cases: readonly CaseInfo[], value: string | undefined): CaseInfo[] {
  const names = value
    ?.split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  if (!names?.length) return [...cases];
  const unknown = names.filter((name) => !cases.some((info) => info.id === name));
  if (unknown.length) throw new Error(`No such case: ${unknown.join(", ")}.`);
  return cases.filter((info) => names.includes(info.id));
}

/** A target's stories. Every target has the same ids: a case without output keeps its own. */
export function targetStories(cases: readonly CaseInfo[], target: string): Story[] {
  const reasons = standInReasons(noOutputCases(cases, target), {});
  return cases.flatMap((info) =>
    caseStories(info).map((story) => {
      const noOutput = reasons[info.id];
      return noOutput === undefined ? story : { ...story, noOutput };
    }),
  );
}

/** The files of a target's Storybook: its stories, and the runner story with each spec. */
export function storyFiles(
  cases: readonly CaseInfo[],
  target: string,
  directory: string,
): GeneratedFile[] {
  return [
    ...generateStories(directory, targetStories(cases, target)),
    generateRunner(directory, {
      target,
      specs: cases.flatMap((info) => (info.spec ? [info.spec] : [])),
    }),
  ];
}

/** Writes the files, and removes those an earlier start wrote that no story needs now. */
function writeStories(directory: string, files: readonly GeneratedFile[]): void {
  mkdirSync(directory, { recursive: true });
  const kept = new Set(files.map(({ file }) => file));
  for (const entry of existsSync(directory) ? readdirSync(directory) : []) {
    if (!kept.has(entry)) rmSync(join(directory, entry));
  }
  for (const { file, contents } of files) writeIfChanged(join(directory, file), contents);
}

/** A target's Storybook configuration, with its stories written. */
export async function storybookConfig(
  target: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<StorybookConfig> {
  const all = listCases(CASES_DIR);
  const cases = selectCases(all, env[CASES_ENV]);
  const directory = storiesDir(target, env[CASES_ENV]);
  writeStories(directory, storyFiles(cases, target, directory));
  const toolchain = await loadToolchain(target);
  // A spec of a case the target can't compile still loads, against a stand-in (ADR-0068).
  const reasons = standInReasons(noOutputCases(all, target), standInCases(all, target, QUARANTINE));
  return createStorybookConfig({
    target,
    root: ROOT,
    stories: [join(directory, "*.stories.ts")],
    mainModules: new Set(cases.map((info) => info.source)),
    unplugin: {
      target: target as UnframeworkOptions["target"],
      // The browser tests run the reviewed code: a module that isn't its golden output throws.
      onCompile: (event) => goldenGuard(event),
    },
    plugins: async () => [noOutputPlugin(all, reasons), ...(await enginePlugins())],
    vite: () => toolchain.vite("browser", toolchainContext(target)),
  });
}
