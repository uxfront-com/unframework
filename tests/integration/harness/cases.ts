// The corpus (plan §7.1): every case directory, its input, its spec and its case.json. Every
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

const CASE_KEYS = new Set(["description", "ssr", "axe", "requires"]);

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
  // Why every test of the case requires a capability (`CaseConfig.requires`, ADR-0050).
  if (
    config.requires !== undefined &&
    (typeof config.requires !== "string" || !config.requires.trim())
  ) {
    problems.push(`"requires" must be a sentence saying why every test requires a capability`);
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
  message: string;
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
  // A name names one scenario: two checks of one name would settle the same trace (and DOM)
  // twice, maybe once with steps and once without.
  const repeated = [...new Set(names.filter((name, index) => names.indexOf(name) !== index))];
  if (repeated.length) {
    throw new Error(
      `Case ${info.id}: ${basename(info.spec)} checks scenario(s) under a name twice: ${repeated.map((name) => JSON.stringify(name)).join(", ")}. Each scenario is unique in its case.`,
    );
  }
  return [...new Set(names)].toSorted();
}

/** One test of a spec, as its source reads. */
export interface SpecTest {
  name: string;
  /**
   * The capabilities it declares it requires (`it(name, { requires: ["interactivity"] }, fn)`),
   * in order: none when it declares none.
   */
  requires: string[];
  /** Whether it checks a scenario before its first action (`view.user.…`), if it acts at all. */
  checksFirst: boolean;
  /** Whether it acts through `view.user`. */
  acts: boolean;
  /** Whether it rerenders (`view.rerender(…)`). */
  rerenders: boolean;
  /**
   * The first assertion after its first `expectParity`, as written (`expect.element(`,
   * `expect.poll(` or `expect(`), or none.
   */
  firstAssertion: string | undefined;
  /**
   * The steps it takes (an action, a rerender or a clock tick of a mounted view) that an
   * assertion comes after, or the test ends after, before any `expectParity` compares them:
   * the first of each run of such steps, with what came next.
   */
  uncompared: UncomparedStep[];
}

/** A step a test takes that no `expectParity` compares before an assertion or the test's end. */
export interface UncomparedStep {
  /** The step's line in the spec, from 1. */
  line: number;
  /** The step, as written (`view.user.type(`). */
  step: string;
  /** The assertion that came before any `expectParity`, as written, or none at the test's end. */
  next: string | undefined;
}

/** A test call with a string literal name: `it("…",` or `test("…",`. */
const TEST_CALL = /\b(?:it|test)\s*\(\s*(["'`])((?:(?!\1)[^\\\n])*)\1\s*,/g;

/** An action a spec takes through `view.user`, called on anything else. */
const DIRECT_ACTION =
  /\.(?:click|dblClick|tripleClick|fill|type|clear|hover|unhover|selectOptions|wheel|focus|keyboard|tab)\s*\(/g;

/** An action through `view.user`. */
const ACTION = /\.user\.[A-Za-z]+\s*\(/;

/** A rerender of a view. */
const RERENDER = /\.rerender\s*\(/;

/** An assertion: `expect(`, `expect.element(`, `expect.poll(`. */
const ASSERTION = /\bexpect\b(?:\s*\.\s*[A-Za-z]+)?\s*\(/;

/**
 * What a test's statements do, in order, as L9 sees them: a step (an action, a rerender, a
 * clock tick), the `expectParity` that compares the steps before it, an assertion, an unmount
 * (after which a tick is no step: the view records none) and a mount (a new view).
 */
const EVENTS =
  /\.user\.[A-Za-z]+\s*\(|\.rerender\s*\(|\.clock\.tick\s*\(|\.expectParity\s*\(|\bexpect\b(?:\s*\.\s*[A-Za-z]+)?\s*\(|\.unmount\s*\(|\bmount(?:Scenario)?\s*\(/g;

/**
 * The tests of a spec, read from its source as `parityScenarios` reads the scenarios: each
 * test call's name, the capabilities its options (before its function) declare it requires,
 * whether its body checks a scenario before it first acts, whether it acts or rerenders, and
 * the steps a later step or assertion follows before an `expectParity`. Throws on a `requires`
 * that is not an array of string literals: the canaries read which tests run on a target from
 * it.
 */
export function specTests(source: string): SpecTest[] {
  const code = withoutComments(source);
  const calls = [...code.matchAll(TEST_CALL)];
  return calls.map((call, index) => {
    const start = call.index + call[0].length;
    const body = code.slice(start, calls[index + 1]?.index ?? code.length);
    const fn = body.search(/=>|\bfunction\b/);
    const header = fn === -1 ? body : body.slice(0, fn);
    const parity = body.search(/\.expectParity\s*\(/);
    const action = body.search(ACTION);
    const assertion =
      parity === -1 ? undefined : ASSERTION.exec(body.slice(parity))?.[0].replace(/\s+/g, "");
    return {
      name: call[2]!,
      requires: declaredRequires(call[2]!, header),
      checksFirst: parity !== -1 && (action === -1 || parity < action),
      acts: action !== -1,
      rerenders: RERENDER.test(body),
      firstAssertion: assertion,
      uncompared: uncomparedSteps(code, start, body),
    };
  });
}

/** The capability names a test's options declare in `requires`, which must be string literals. */
function declaredRequires(name: string, header: string): string[] {
  if (!/\brequires\s*:/.test(header)) return [];
  const list = /\brequires\s*:\s*\[([^\]]*)\]/.exec(header)?.[1];
  const items = list
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const names = items?.flatMap((item) => /^(["'])([a-z][a-z0-9-]*)\1$/.exec(item)?.[2] ?? []);
  if (!items || !names || names.length !== items.length) {
    throw new Error(
      `The test ${JSON.stringify(name)} declares requires that is not an array of capability names in string literals: write requires: ["interactivity"]. The harness reads which tests run on a target from it.`,
    );
  }
  return names;
}

/**
 * The steps of a test's body that an assertion follows, or the test ends after, before an
 * `expectParity` compares them: the first step of each such run.
 */
function uncomparedSteps(code: string, start: number, body: string): UncomparedStep[] {
  const found: UncomparedStep[] = [];
  let pending: { index: number; text: string } | undefined;
  let unmounted = false;
  const report = (next: string | undefined) => {
    if (!pending) return;
    found.push({
      line: code.slice(0, start + pending.index).split("\n").length,
      step: `view${pending.text}`,
      next,
    });
    pending = undefined;
  };
  for (const match of body.matchAll(EVENTS)) {
    const text = match[0].replace(/\s+/g, "");
    if (text.startsWith(".expectParity")) pending = undefined;
    else if (text.startsWith(".unmount")) unmounted = true;
    else if (/^\.?mount/.test(text)) unmounted = false;
    else if (text.startsWith("expect")) report(text);
    // A tick once the view is unmounted records no step: there is nothing to compare.
    else if (!(text.startsWith(".clock") && unmounted)) pending ??= { index: match.index, text };
  }
  report(undefined);
  return found;
}

/**
 * The source with its comments blanked to spaces, so a comment that names an action is no
 * action, and every offset (and line) stays where it was. A `//` inside a string literal (a
 * URL) is kept: a comment starts a line or follows whitespace.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\/|(?<=^|\s)\/\/[^\n]*/g, (comment) =>
    comment.replace(/[^\n]/g, " "),
  );
}

/**
 * Where a case's spec breaks the spec rules the harness can read (ADR-0043, ADR-0050), each as
 * a message: none when it has no spec.
 * - Each test has a name of its own: the summary compares each target's tests by name.
 * - A spec acts only through `view.user`, so every action runs through the target's adapter,
 *   settles and is recorded in the trace: it imports nothing from `vitest/browser` (`userEvent`,
 *   `page`), and calls no action on a locator or an element.
 * - A spec acts and rerenders inside its tests' bodies, where the harness reads which tests
 *   act and rerender (the L9 canaries judge only the targets those tests run on).
 * - A test asserts after `expectParity`: between a step (an action through `view.user`, a
 *   rerender or a clock tick of a mounted view) and the `expectParity` that compares it, it
 *   asserts nothing, and it ends with no step uncompared. A step whose handler is missing then
 *   fails L9, which compares its trace, before an assertion can abort the test (the L9
 *   canaries depend on it).
 * - At least one test checks a scenario before it acts, so a static target (Astro) and the
 *   canaries reach the case.
 * - A test that requires nothing asserts first, after its `expectParity`, through a locator
 *   (`expect.element`, `expect.poll`): on a render of nothing it then fails as a query that
 *   finds nothing, which the L8 canary reads as its evidence on every target, a static one
 *   included, where no action fails first.
 * - `case.json`'s `requires` note is there exactly when every test requires a capability: when
 *   the case's client code changes what it mounts, no test can pass without the capability, and
 *   the server render checks a static target.
 */
export function specProblems(info: CaseInfo): string[] {
  if (!info.spec) return [];
  const source = readFileSync(info.spec, "utf8");
  const file = `${info.id}/${basename(info.spec)}`;
  const problems: string[] = [];
  const tests = specTests(source);
  const names = tests.map((test) => test.name);
  for (const name of new Set(names.filter((each, index) => names.indexOf(each) !== index))) {
    problems.push(
      `${file}: two tests are named ${JSON.stringify(name)}; each test's name is its own.`,
    );
  }
  if (/\bfrom\s+["']vitest\/browser["']|\bimport\s*\(\s*["']vitest\/browser["']/.test(source)) {
    problems.push(
      `${file}: imports from vitest/browser. A spec acts through view.user and queries through the view, so every action settles and is recorded in the trace.`,
    );
  }
  for (const match of source.matchAll(DIRECT_ACTION)) {
    const before = source.slice(0, match.index);
    if (/\.user\s*$/.test(before)) continue;
    const action = match[0].slice(1).replace(/\s*\($/, "");
    problems.push(
      `${file}:${before.split("\n").length}: calls ${action}() directly. Act through view.user (view.user.${action}(…)): it runs the action through the target's adapter, settles, and records a step of the trace.`,
    );
  }
  const code = withoutComments(source);
  const first = code.search(TEST_CALL);
  const prelude = first === -1 ? code : code.slice(0, first);
  if (ACTION.test(prelude) || RERENDER.test(prelude)) {
    problems.push(
      `${file}: acts or rerenders outside a test. Each test takes its own steps in its own body, where the harness reads which tests act and rerender.`,
    );
  }
  for (const test of tests) {
    for (const { line, step, next } of test.uncompared) {
      problems.push(
        next === undefined
          ? `${file}:${line}: ${JSON.stringify(test.name)} ends with ${step}…) uncompared. Call expectParity("<scenario>") after the test's last step: it compares the steps' trace (L9).`
          : `${file}:${line}: ${JSON.stringify(test.name)} asserts (${next}…)) after ${step}…) before an expectParity compares the step. Call expectParity("<scenario>") right after the step, then assert: a step whose handler is missing must fail L9, which compares its trace, before an assertion can abort the test.`,
      );
    }
  }
  for (const test of tests) {
    if (test.requires.length || test.firstAssertion === undefined) continue;
    if (test.firstAssertion === "expect.element(" || test.firstAssertion === "expect.poll(") {
      continue;
    }
    problems.push(
      `${file}: ${JSON.stringify(test.name)} requires nothing, and its first assertion after its expectParity is ${test.firstAssertion}…). Assert first through a locator (await expect.element(view.getBy…)…): on a render of nothing it then fails as a query that finds nothing, on every target, a static one included.`,
    );
  }
  if (tests.length && !tests.some((test) => test.checksFirst)) {
    problems.push(
      `${file}: no test checks a scenario before it acts. One test at least calls expectParity before any view.user action, so a static target and the canaries reach the case.`,
    );
  }
  const unrequired = tests.filter((test) => !test.requires.length);
  if (tests.length && !unrequired.length && info.config.requires === undefined) {
    problems.push(
      `${file}: every test requires a capability. Say why in case.json's "requires" note (the case's client code changes what it mounts), or check the initial render in a test that requires nothing.`,
    );
  }
  if (info.config.requires !== undefined && unrequired.length) {
    problems.push(
      `${file}: case.json's "requires" note says every test requires a capability, but ${unrequired.map((test) => JSON.stringify(test.name)).join(", ")} requires none.`,
    );
  }
  return problems;
}

/**
 * The shared artefacts a case owns (plan §7.1), relative to its directory: its expected
 * diagnostics; when it has output, the server HTML of each SSR scenario; and for each
 * `expectParity` scenario of its spec, the DOM, the ARIA tree, the interaction trace (which the
 * browser run decides must exist, or not, ADR-0050), the geometry and the Linux screenshot.
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
    owned.add(`__expected__/trace.${name}.json`);
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
