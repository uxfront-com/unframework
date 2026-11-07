// Whether a pull request runs the canaries (ADR-0073): CI's `changes` job pipes the PR's changed
// files here, one per line, and this prints `canaries=true` or `canaries=false` for $GITHUB_OUTPUT.
// It imports Node's builtins alone, because that job installs nothing.
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
  "packages/target-*/src/toolchain/**",
  "tests/toolchains/**",
  // The root script that runs them, and the versions of Vitest and Playwright.
  "package.json",
  "pnpm-workspace.yaml",
  "pnpm-lock.yaml",
];

function globToRegExp(glob: string): RegExp {
  const source = glob
    .replace(/[.+?^${}()|[\]\\]/g, String.raw`\$&`)
    .replace(/\*\*\/|\*\*|\*/g, (stars) =>
      stars === "**/" ? "(?:[^/]+/)*" : stars === "**" ? ".*" : "[^/]*",
    );
  return new RegExp(`^${source}$`);
}

const CANARY_PATTERNS: readonly RegExp[] = CANARY_PATHS.map(globToRegExp);

/**
 * Whether any of the files can change a canary's answer. `git diff` quotes a name with an unusual
 * character (`"a/caf\303\251.ts"`). Its escapes hold no `/`, so `*` still matches them once the
 * quotes are off, and such a name never skips the canaries (P2).
 */
export function runsCanaries(files: readonly string[]): boolean {
  return files.some((file) => {
    const path = file.replace(/^"(.*)"$/, "$1");
    return CANARY_PATTERNS.some((pattern) => pattern.test(path));
  });
}

if (import.meta.main) {
  const files = readFileSync(0, "utf8").split("\n");
  process.stdout.write(`canaries=${runsCanaries(files)}\n`);
}
