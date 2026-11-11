// A project's cases (ADR-0086): the corpus's unit of a test (ADR-0085) in whatever layout the
// project keeps. A case is a directory with one test file. Its id is the directory relative to the
// project's root, and its main source is the one its `case.json` names, maybe outside the
// directory, or else the directory's only `.uf.tsx`. The corpus's own rules (kebab-case
// `<area>/<name>` ids, a main source among the case's files) stay in its harness.
import { existsSync, globSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import { TARGET_NAMES } from "@unframework.dev/compiler";

import { COLOR_SCHEMES } from "../harness.ts";
import type { CaseConfig } from "../harness.ts";
import { KEBAB_CASE } from "../node/names.ts";

/** One case of a project. */
export interface ProjectCase {
  /** The directory relative to the project's root, with forward slashes. */
  id: string;
  /** The case's directory (absolute). */
  dir: string;
  /** The test file (absolute). */
  spec: string;
  /** The main `.uf.tsx` source (absolute). */
  source: string;
  config: CaseConfig;
}

/** What {@link discoverCases} reads. */
export interface DiscoverOptions {
  /** The project's root (absolute): case ids are relative to it. */
  root: string;
  /** Globs of test files, relative to the root. */
  include: readonly string[];
}

/** What a test file never lies in: installed packages and build output. */
export const EXCLUDED: readonly string[] = ["**/node_modules/**", "**/dist/**"];

/** The keys of a project's `case.json`: the public ones (ADR-0085). */
const CASE_KEYS = new Set(["description", "main", "ssr", "axe", "colorScheme", "reference"]);

/**
 * Every case under the root, sorted by id. Throws, naming the fix, on a directory with two test
 * files, a case with no main source, a test file at the root itself and a malformed `case.json`:
 * a case that cannot be told apart would have nowhere to go in the run.
 */
export function discoverCases(options: DiscoverOptions): ProjectCase[] {
  const files = globSync([...options.include], {
    cwd: options.root,
    exclude: [...EXCLUDED],
  }).toSorted();
  const byDirectory = new Map<string, string[]>();
  for (const file of files) {
    const absolute = resolve(options.root, file);
    const directory = dirname(absolute);
    byDirectory.set(directory, [...(byDirectory.get(directory) ?? []), absolute]);
  }
  const cases: ProjectCase[] = [];
  for (const [dir, specs] of byDirectory) {
    const id = relative(options.root, dir).split(sep).join("/");
    if (!id) {
      throw new Error(
        `[uf] ${relative(options.root, specs[0]!)} is at the project's root: a case is a directory, so move the test file into a directory of its own, such as test/<name>/.`,
      );
    }
    if (specs.length > 1) {
      throw new Error(
        `[uf] Case ${id} holds ${specs.length} test files (${specs.map((spec) => relative(dir, spec)).join(", ")}): a case is a directory with one test file, so give each its own directory.`,
      );
    }
    const config = readCaseConfig(id, join(dir, "case.json"));
    cases.push({ id, dir, spec: specs[0]!, source: mainSource(id, dir, config.main), config });
  }
  return cases.toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * A case's main source: `main`, relative to the case's directory, or the directory's only
 * `.uf.tsx`.
 */
function mainSource(id: string, dir: string, main: string | undefined): string {
  if (main !== undefined) {
    const source = resolve(dir, main);
    if (!main.endsWith(".uf.tsx") || !existsSync(source)) {
      throw new Error(
        `[uf] Case ${id}: case.json's "main" names ${JSON.stringify(main)}, which is no .uf.tsx file relative to the case's directory. Point it at the component the test mounts, such as "../../src/Button.uf.tsx".`,
      );
    }
    return source;
  }
  const inputs = readdirSync(dir).filter((file) => file.endsWith(".uf.tsx"));
  if (inputs.length === 1) return join(dir, inputs[0]!);
  throw new Error(
    inputs.length
      ? `[uf] Case ${id} holds ${inputs.join(", ")}: name the one the test mounts in case.json, "main": "${inputs[0]}".`
      : `[uf] Case ${id} has no main source: add a .uf.tsx beside its test, or name the component in case.json, "main": "../../src/Button.uf.tsx".`,
  );
}

/** A case's `case.json`, checked: `{}` when it has none. */
export function readCaseConfig(id: string, file: string): CaseConfig {
  if (!existsSync(file)) return {};
  let config: unknown;
  try {
    config = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(
      `[uf] Case ${id}: case.json is not JSON: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    throw new Error(`[uf] Case ${id}: case.json must hold an object.`);
  }
  const record = config as Record<string, unknown>;
  const problems: string[] = [];
  for (const key of Object.keys(record)) {
    if (!CASE_KEYS.has(key)) {
      problems.push(`unknown key "${key}" (it takes ${[...CASE_KEYS].join(", ")})`);
    }
  }
  if (record.description !== undefined && typeof record.description !== "string") {
    problems.push(`"description" must be a string`);
  }
  if (record.main !== undefined && typeof record.main !== "string") {
    problems.push(`"main" must be the path of a .uf.tsx file, relative to the case`);
  }
  if (
    record.reference !== undefined &&
    !(TARGET_NAMES as readonly unknown[]).includes(record.reference)
  ) {
    problems.push(`"reference" must name a target: ${TARGET_NAMES.join(", ")}`);
  }
  if (
    record.colorScheme !== undefined &&
    !(COLOR_SCHEMES as readonly unknown[]).includes(record.colorScheme)
  ) {
    problems.push(`"colorScheme" must be one of ${COLOR_SCHEMES.map((s) => `"${s}"`).join(", ")}`);
  }
  if (
    record.axe !== undefined &&
    (!Array.isArray(record.axe) || record.axe.some((rule) => typeof rule !== "string"))
  ) {
    problems.push(`"axe" must be a list of axe rule ids`);
  }
  if (record.ssr !== undefined) {
    if (typeof record.ssr !== "object" || record.ssr === null || Array.isArray(record.ssr)) {
      problems.push(`"ssr" must map scenario names to { "props": {…} }`);
    } else {
      for (const [scenario, value] of Object.entries(record.ssr)) {
        // A scenario names its expectation files, `ssr.<scenario>.html`.
        if (!KEBAB_CASE.test(scenario)) {
          problems.push(`SSR scenario "${scenario}", which is not kebab-case`);
        }
        const props = (value as { props?: unknown } | null)?.props;
        if (
          typeof value !== "object" ||
          value === null ||
          Array.isArray(value) ||
          (props !== undefined &&
            (typeof props !== "object" || props === null || Array.isArray(props)))
        ) {
          problems.push(`SSR scenario "${scenario}" must be { "props": {…} }`);
        }
      }
    }
  }
  if (problems.length) throw new Error(`[uf] Case ${id}: case.json has ${problems.join("; ")}.`);
  return record as CaseConfig;
}
