// The corpus (DESIGN §4.4): every case directory, its input, its spec and its case.json. Every
// project lists the cases from here, so they agree on what the corpus is.
import { existsSync, readdirSync, readFileSync, rmdirSync, rmSync, statSync } from "node:fs";
import { basename, dirname, join, sep } from "node:path";

import { KEBAB_CASE, ssrScenarios } from "@unframework/testing/node";
import type { CaseConfig } from "@unframework/testing/node";

import { CASES_DIR } from "./paths.ts";

/** One case of the corpus. */
export interface CaseInfo {
  /** `area/name`, relative to the cases directory. */
  id: string;
  /** The case directory (absolute). */
  dir: string;
  /** The `.uf.tsx` input (absolute). */
  source: string;
  /** The input's file name relative to the cases directory, as the compiler sees it. */
  filename: string;
  /** The browser spec, absent for diagnostics cases. */
  spec: string | undefined;
  config: CaseConfig;
}

const CASE_KEYS = new Set(["description", "ssr", "axe"]);

/** Every case, sorted by id. Throws on a malformed case, so a broken corpus is loud. */
export function listCases(casesDir: string = CASES_DIR): CaseInfo[] {
  const cases: CaseInfo[] = [];
  for (const area of sortedDirectories(casesDir)) {
    for (const name of sortedDirectories(join(casesDir, area))) {
      const id = `${area}/${name}`;
      if (!KEBAB_CASE.test(area) || !KEBAB_CASE.test(name)) {
        throw new Error(
          `Case ${id}: an area and a case name are kebab-case, such as basics/hello.`,
        );
      }
      cases.push(readCase(casesDir, id));
    }
  }
  if (!cases.length) throw new Error(`No cases under ${casesDir}.`);
  return cases;
}

/** Each case's `case.json`, by id: what the harness provides to every project. */
export function caseConfigs(cases: readonly CaseInfo[]): Record<string, CaseConfig> {
  return Object.fromEntries(cases.map((info) => [info.id, info.config]));
}

function readCase(casesDir: string, id: string): CaseInfo {
  const dir = join(casesDir, id);
  const files = readdirSync(dir);
  const inputs = files.filter((file) => file.endsWith(".uf.tsx"));
  if (inputs.length !== 1) {
    // Harness components (slot content, plan §7.1) arrive with slots, in M3.
    throw new Error(
      `Case ${id} must hold exactly one .uf.tsx input, found ${inputs.length ? inputs.join(", ") : "none"}.`,
    );
  }
  const specs = files.filter((file) => file.endsWith(".test.ts"));
  if (specs.length > 1) throw new Error(`Case ${id} has more than one spec: ${specs.join(", ")}.`);
  const source = join(dir, inputs[0]!);
  return {
    id,
    dir,
    source,
    filename: `${id}/${basename(source)}`,
    spec: specs[0] && join(dir, specs[0]),
    config: readConfig(id, join(dir, "case.json")),
  };
}

function readConfig(id: string, file: string): CaseConfig {
  if (!existsSync(file)) return {};
  const config = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  const problems: string[] = [];
  for (const key of Object.keys(config)) {
    if (!CASE_KEYS.has(key)) problems.push(`unknown key "${key}"`);
  }
  if (config.description !== undefined && typeof config.description !== "string") {
    problems.push(`"description" must be a string`);
  }
  if (
    config.axe !== undefined &&
    (!Array.isArray(config.axe) || config.axe.some((rule) => typeof rule !== "string"))
  ) {
    problems.push(`"axe" must be a list of axe rule ids`);
  }
  if (config.ssr !== undefined) {
    if (typeof config.ssr !== "object" || config.ssr === null || Array.isArray(config.ssr)) {
      problems.push(`"ssr" must map scenario names to { "props": {…} }`);
    } else {
      for (const [scenario, value] of Object.entries(config.ssr)) {
        if (!KEBAB_CASE.test(scenario))
          problems.push(`SSR scenario "${scenario}", which is not kebab-case`);
        const props = (value as { props?: unknown } | null)?.props;
        if (
          typeof value !== "object" ||
          value === null ||
          (props !== undefined && (typeof props !== "object" || props === null))
        ) {
          problems.push(`SSR scenario "${scenario}" must be { "props": {…} }`);
        }
      }
    }
  }
  if (problems.length) throw new Error(`Case ${id}: case.json has ${problems.join("; ")}.`);
  return config as CaseConfig;
}

/** The diagnostics a case expects (`__expected__/diagnostics.json`), or `undefined` if missing. */
export function expectedDiagnostics(info: CaseInfo): ExpectedDiagnostic[] | undefined {
  const file = join(info.dir, "__expected__", "diagnostics.json");
  if (!existsSync(file)) return undefined;
  return JSON.parse(readFileSync(file, "utf8")) as ExpectedDiagnostic[];
}

/** The fields of a JSON diagnostic the harness reads; the file holds the full form. */
export interface ExpectedDiagnostic {
  code: string;
  severity: "error" | "warning" | "info";
  target?: string;
  /** The fixes L1 applies, which the L1-fix-no-op canary corrupts. */
  fixes?: readonly unknown[];
}

/**
 * Whether a case expects compile errors, from its committed `diagnostics.json`: such a case has
 * no output, so the layers from L3 on are skipped. Throws when the file is missing, because
 * the compile project must write it first (`pnpm test:update`).
 */
export function expectsErrors(info: CaseInfo, target?: string): boolean {
  const diagnostics = expectedDiagnostics(info);
  if (!diagnostics) {
    throw new Error(
      `Missing artefact ${info.id}/__expected__/diagnostics.json. Run \`pnpm test:update\` to write it.`,
    );
  }
  return diagnostics.some(
    (diagnostic) =>
      diagnostic.severity === "error" &&
      (diagnostic.target === undefined || diagnostic.target === target),
  );
}

/**
 * {@link expectsErrors}, or the reason it cannot tell: a project skips a case only when it is
 * sure the case has no output, and fails the case's own test otherwise.
 */
export function errorState(info: CaseInfo, target?: string): boolean | Error {
  try {
    return expectsErrors(info, target);
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * The scenarios a case's spec checks with `expectParity`, read from its source: they decide
 * which shared expectations the case owns. Throws when a call does not name its scenario with a
 * string literal, because then the case's expectations cannot be told from stale ones.
 */
export function parityScenarios(info: CaseInfo): string[] {
  if (!info.spec) return [];
  const source = readFileSync(info.spec, "utf8");
  const calls = source.match(/\bexpectParity\s*\(/g)?.length ?? 0;
  const names = [...source.matchAll(/\bexpectParity\s*\(\s*(["'`])([^"'`$\\\n]*)\1/g)].map(
    (match) => match[2]!,
  );
  if (names.length !== calls) {
    throw new Error(
      `Case ${info.id}: ${basename(info.spec)} calls expectParity without naming the scenario in a string literal. The harness reads the names from the spec to tell the case's expectations from stale ones: write expectParity("initial").`,
    );
  }
  // expectParity refuses these too, but only once the browser runs the spec; here the compile
  // project names the case.
  const malformed = names.filter((name) => !KEBAB_CASE.test(name));
  if (malformed.length) {
    throw new Error(
      `Case ${info.id}: ${basename(info.spec)} names scenario(s) that are not kebab-case: ${malformed.map((name) => JSON.stringify(name)).join(", ")}.`,
    );
  }
  return [...new Set(names)].toSorted();
}

/**
 * The shared artefacts a case owns (DESIGN §4.4), relative to its directory: its expected
 * diagnostics; when it has output, the server HTML of each SSR scenario; and for each
 * `expectParity` scenario of its spec, the DOM, the ARIA tree, the geometry and the Linux
 * screenshot.
 */
export function sharedArtefacts(info: CaseInfo): Set<string> {
  const owned = new Set(["__expected__/diagnostics.json"]);
  // A case whose diagnostics.json is missing fails L1 and keeps what it may own.
  if (errorState(info) !== true) {
    for (const scenario of Object.keys(ssrScenarios(info.config))) {
      owned.add(`__expected__/ssr.${scenario}.html`);
    }
  }
  for (const name of parityScenarios(info)) {
    owned.add(`__expected__/dom.${name}.html`);
    owned.add(`__expected__/aria.${name}.yaml`);
    owned.add(`__expected__/geometry.${name}.json`);
    owned.add(`__screenshots__/${name}-chromium-linux.png`);
  }
  return owned;
}

/**
 * The files under a case's `__expected__/` and `__screenshots__/` that it does not own: no test
 * reads them (a renamed scenario, a removed SSR scenario, a deleted spec), yet reviewers would
 * read them as the contract. Relative to the case directory, sorted.
 */
export function staleArtefacts(info: CaseInfo): string[] {
  const owned = sharedArtefacts(info);
  return ["__expected__", "__screenshots__"]
    .flatMap((directory) => {
      const path = join(info.dir, directory);
      if (!existsSync(path)) return [];
      return (readdirSync(path, { recursive: true }) as string[])
        .filter((entry) => !basename(entry).startsWith(".") && statSync(join(path, entry)).isFile())
        .map((entry) => `${directory}/${entry.split(sep).join("/")}`);
    })
    .filter((file) => !owned.has(file))
    .toSorted();
}

/**
 * Deletes a case's stale artefacts ({@link staleArtefacts}) and the directories they leave
 * empty: what `pnpm test:update` does with them. Returns what it deleted.
 */
export function removeStaleArtefacts(info: CaseInfo): string[] {
  const stale = staleArtefacts(info);
  for (const file of stale) {
    rmSync(join(info.dir, file));
    for (
      let directory = dirname(join(info.dir, file));
      directory !== info.dir && !readdirSync(directory).length;
      directory = dirname(directory)
    ) {
      rmdirSync(directory);
    }
  }
  return stale;
}

function sortedDirectories(directory: string): string[] {
  return readdirSync(directory)
    .filter((entry) => !entry.startsWith(".") && statSync(join(directory, entry)).isDirectory())
    .sort();
}
