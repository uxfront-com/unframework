// Whether a run of ci.yml runs the canaries (ADR-0073, ADR-0123) and the test jobs (ADR-0084): CI's
// `changes` job pipes the changed files here, one per line, with `--event <name>`, and this prints
// `canaries=<bool>` and `tests=<bool>` for $GITHUB_OUTPUT. With no `--event`, it prints the answer
// for every path on CANARY_PATHS, which `pnpm test:full` reads (scripts/test-loop.ts). It imports
// Node's builtins alone, because that job installs nothing.
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

/** The paths that can change a canary's answer, as globs: `*` within a segment, `**` across them. */
export const CANARY_PATHS: ReadonlyArray<string> = [
	// The job that runs them, and the action that installs their dependencies.
	".github/workflows/ci.yml",
	".github/actions/setup/**",
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

/**
 * The harness itself: the paths where a pull request still runs the canaries (ADR-0123). Every
 * other path on CANARY_PATHS runs them in the merge queue, on the commit `main` receives. Each
 * entry is also on CANARY_PATHS, which canary-paths.unit.test.ts holds.
 */
export const HARNESS_PATHS: ReadonlyArray<string> = [
	".github/workflows/ci.yml",
	".github/actions/setup/**",
	"tests/integration/harness/**",
	"tests/integration/scripts/**",
	"tests/integration/*.ts",
	"tests/integration/*.d.ts",
	"tests/integration/tsconfig*.json",
	"tests/integration/package.json",
	"packages/testing/**",
];

/** A glob as a regular expression over a whole path. */
export function globToRegExp(glob: string): RegExp {
	const source = glob
		.replaceAll(/[.+?^${}()|[\]\\]/g, String.raw`\$&`)
		.replaceAll(/\*\*\/|\*\*|\*/g, (stars) =>
			stars === "**/" ? "(?:[^/]+/)*" : stars === "**" ? ".*" : "[^/]*",
		);
	return new RegExp(`^${source}$`);
}

/**
 * The documentation: what a pull request that changes nothing else need not test (ADR-0084). The
 * docs site is built from these files, so `Build`, which is never gated, still checks them.
 */
export const DOCS_PATHS: ReadonlyArray<string> = ["**/*.md", "docs/**", "apps/web/content/**"];

/**
 * The documentation that a test reads, so a change to it still runs the tests (ADR-0084). The
 * guard in canary-paths.unit.test.ts fails a test file that names another page under
 * `apps/web/content` or the corpus.
 */
export const TESTED_DOCS: ReadonlyArray<string> = [
	// tests/repo/test/targets-page.test.ts renders the table from the targets' cells.
	"apps/web/content/docs/3.reference/1.targets.md",
	// tests/repo/test/diagnostics-page.test.ts compares each section with the catalogue.
	"apps/web/content/docs/3.reference/2.diagnostics.md",
	// listCases (harness/cases.ts) fails on a stray file in a case's directory.
	"tests/integration/cases/**",
];

const CANARY_PATTERNS: ReadonlyArray<RegExp> = CANARY_PATHS.map(globToRegExp);
const HARNESS_PATTERNS: ReadonlyArray<RegExp> = HARNESS_PATHS.map(globToRegExp);
const DOCS_PATTERNS: ReadonlyArray<RegExp> = DOCS_PATHS.map(globToRegExp);
const TESTED_DOCS_PATTERNS: ReadonlyArray<RegExp> = TESTED_DOCS.map(globToRegExp);

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
export function runsCanaries(files: ReadonlyArray<string>): boolean {
	return matchesAny(files, CANARY_PATTERNS);
}

/** Whether any of the files is the harness's own, Markdown left out as for `runsCanaries`. */
export function runsHarnessCanaries(files: ReadonlyArray<string>): boolean {
	return matchesAny(files, HARNESS_PATTERNS);
}

function matchesAny(files: ReadonlyArray<string>, patterns: ReadonlyArray<RegExp>): boolean {
	return files.some((file) => {
		const path = unquote(file);
		return !path.endsWith(".md") && patterns.some((pattern) => pattern.test(path));
	});
}

/**
 * Whether the test jobs run: unless every file is documentation that no test reads (ADR-0084). An
 * empty list runs them, since nothing then shows that the change is documentation alone (P2).
 * Every path on `CANARY_PATHS` is outside `DOCS_PATHS`, so the canaries never run without the tests.
 */
export function runsTests(files: ReadonlyArray<string>): boolean {
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

/** The `changes` job's outputs. */
export interface Outputs {
	canaries: boolean;
	tests: boolean;
}

/**
 * The outputs for a run of ci.yml, from its event and changed files (ADR-0123). The merge queue
 * runs the canaries whenever a path on CANARY_PATHS changed, as ADR-0073 decided for every pull
 * request, and a pull request runs them only when it changes the harness. A push to `main` runs
 * every test job and no canary, and `workflow_dispatch` runs them all (ADR-0084). Any other event
 * throws, so the job fails rather than guess (P2).
 */
export function resolveOutputs(event: string, files: ReadonlyArray<string>): Outputs {
	switch (event) {
		case "merge_group":
			return { canaries: runsCanaries(files), tests: runsTests(files) };
		case "pull_request":
			return { canaries: runsHarnessCanaries(files), tests: runsTests(files) };
		case "push":
			return { canaries: false, tests: true };
		case "workflow_dispatch":
			return { canaries: true, tests: true };
		default:
			throw new Error(`canary-paths.ts: no rule for the event ${JSON.stringify(event)}.`);
	}
}

if (import.meta.main) {
	const { values } = parseArgs({ options: { event: { type: "string" } } });
	const files = readFileSync(0, "utf8").split("\n");
	const outputs: Outputs =
		values.event === undefined
			? { canaries: runsCanaries(files), tests: runsTests(files) }
			: resolveOutputs(values.event, files);
	process.stdout.write(`canaries=${outputs.canaries}\ntests=${outputs.tests}\n`);
}
