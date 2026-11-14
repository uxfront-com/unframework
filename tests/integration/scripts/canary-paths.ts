// Whether a pull request runs the canaries (ADR-0073) and the test jobs (ADR-0084): CI's `changes`
// job pipes the PR's changed files here, one per line, and this prints `canaries=<bool>` and
// `tests=<bool>` for $GITHUB_OUTPUT. It imports Node's builtins alone, because that job installs
// nothing.
import { readFileSync } from "node:fs";

/** The paths that can change a canary's answer, as globs: `*` within a segment, `**` across them. */
export const CANARY_PATHS: readonly string[] = [
  // The job that runs them.
  ".github/workflows/ci.yml",
  // The harness, with its runner and the files at the package's root that the projects load.
  "tests/integration/harness/**",
  "tests/integration/scripts/**",
  "tests/integration/*.ts",
  "tests/integration/*.d.ts",
  "tests/integration/tsconfig*.json",
  "tests/integration/package.json",
  // The corpus specs a canary judges. Golden outputs, expectations, baselines and case sources
  // stay out: the harness's unit tests run the corruptions on every case they apply to, and check
  // that the output changes.
  "tests/integration/cases/**/*.test.ts",
  "tests/integration/cases/**/case.json",
  // The test kit, and the plugin hooks a canary installs through.
  "packages/testing/**",
  "packages/compiler/**",
  "packages/unplugin/**",
  // The toolchains that run L3 to L5.
  "packages/codegen/src/toolchain.ts",
  "packages/codegen/src/toolchain-node/**",
  "packages/codegen/src/toolchain-browser/**",
  "packages/target-*/src/toolchain/**",
  "tests/toolchains/**",
  // The root script that runs them, and the versions of Vitest and Playwright.
  "package.json",
  "pnpm-workspace.yaml",
  "pnpm-lock.yaml",
];

/** A glob as a regular expression over a whole path. */
export function globToRegExp(glob: string): RegExp {
  const source = glob
    .replace(/[.+?^${}()|[\]\\]/g, String.raw`\$&`)
    .replace(/\*\*\/|\*\*|\*/g, (stars) =>
      stars === "**/" ? "(?:[^/]+/)*" : stars === "**" ? ".*" : "[^/]*",
    );
  return new RegExp(`^${source}$`);
}

/**
 * The documentation: what a pull request that changes nothing else need not test (ADR-0084). The
 * docs site is built from these files, so `Build` and `Lighthouse`, which are never gated, still
 * check them.
 */
export const DOCS_PATHS: readonly string[] = ["**/*.md", "docs/**", "apps/web/content/**"];

/**
 * The documentation that a test reads, so a change to it still runs the tests (ADR-0084). The
 * guard in canary-paths.unit.test.ts fails a test file that names another page under
 * `apps/web/content` or the corpus.
 */
export const TESTED_DOCS: readonly string[] = [
  // tests/repo/test/targets-page.test.ts renders the table from the targets' cells.
  "apps/web/content/docs/3.reference/1.targets.md",
  // tests/repo/test/diagnostics-page.test.ts compares each section with the catalogue.
  "apps/web/content/docs/3.reference/2.diagnostics.md",
  // listCases (harness/cases.ts) fails on a stray file in a case's directory.
  "tests/integration/cases/**",
];

const CANARY_PATTERNS: readonly RegExp[] = CANARY_PATHS.map(globToRegExp);
const DOCS_PATTERNS: readonly RegExp[] = DOCS_PATHS.map(globToRegExp);
const TESTED_DOCS_PATTERNS: readonly RegExp[] = TESTED_DOCS.map(globToRegExp);

/** A name as `git diff` writes it, without the quotes it puts around an unusual one. */
function unquote(file: string): string {
  return file.replace(/^"(.*)"$/, "$1");
}

/**
 * Whether any of the files can change a canary's answer. Markdown never can (ADR-0084), a README
 * under a listed package included. `git diff` quotes a name with an unusual character
 * (`"a/caf\303\251.ts"`). Its escapes hold no `/`, so `*` still matches them once the quotes are
 * off, and such a name never skips the canaries (P2).
 */
export function runsCanaries(files: readonly string[]): boolean {
  return files.some((file) => {
    const path = unquote(file);
    return !path.endsWith(".md") && CANARY_PATTERNS.some((pattern) => pattern.test(path));
  });
}

/**
 * Whether the test jobs run: unless every file is documentation that no test reads (ADR-0084). An
 * empty list runs them, since nothing then shows that the change is documentation alone (P2).
 * Every path on `CANARY_PATHS` is outside `DOCS_PATHS`, so the canaries never run without the tests.
 */
export function runsTests(files: readonly string[]): boolean {
  const paths = files.filter((file) => file !== "").map(unquote);
  return (
    paths.length === 0 ||
    paths.some(
      (path) =>
        !DOCS_PATTERNS.some((pattern) => pattern.test(path)) ||
        TESTED_DOCS_PATTERNS.some((pattern) => pattern.test(path)),
    )
  );
}

if (import.meta.main) {
  const files = readFileSync(0, "utf8").split("\n");
  process.stdout.write(`canaries=${runsCanaries(files)}\ntests=${runsTests(files)}\n`);
}
