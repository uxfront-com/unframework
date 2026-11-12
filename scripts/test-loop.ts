// The two local test loops. `pnpm test:quick` is the loop to run while you work: the unit tests
// of the packages the branch changed, the repo invariants and the corpus's `compile` project.
// `pnpm test:full` is the loop to run before a pull request: what CI's test jobs run.
//
//   pnpm test:quick                  changed since the merge base of origin/main and HEAD
//   pnpm test:quick --base <ref>     changed since the merge base of <ref> and HEAD
//   pnpm test:full                   every CI test job this machine can run
//   pnpm test:quick --list           print the steps, and run nothing (test:full too)
//
// Each step runs whatever the earlier ones returned, and the script exits non-zero when any
// failed. It never fetches, and it reads and sets no UF_* variable: turbo.json puts UF_* in the
// `test` task's hash, so a new one would miss every cache.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The repository's root. */
const ROOT: string = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The integration corpus: its `test` runs every default project, browser ones included. */
export const INTEGRATION = "@unframework.dev/integration";

/** The repo invariants: about a second, never cached, and the tests of `scripts/` itself. */
export const REPO_TESTS = "@unframework.dev/repo-tests";

/** The ref `test:quick` compares with when no `--base` is given. */
export const DEFAULT_BASE = "origin/main";

export interface Command {
  command: string;
  args: string[];
}

export interface Step {
  name: string;
  /** Run one after another; the step stops at the first that fails. */
  commands: Command[];
  /** The CI jobs in `.github/workflows/ci.yml` it stands for. */
  jobs: string[];
  /** `canary-paths`: runs only when the branch changes a path on CANARY_PATHS, as CI does. */
  when?: "canary-paths";
}

export type StepStatus = "passed" | "failed" | "skipped";

export interface StepResult {
  name: string;
  status: StepStatus;
  seconds: number;
  note?: string;
}

/**
 * The turbo arguments of `test:quick`'s unit step. `[<base>]` without `...` selects the packages
 * changed since <base>, not their dependents: the integration package depends on every target, so
 * `...[<base>]` would bring in its full run and the browser projects. It is left out by name too,
 * since a change to the harness itself would select it. The repo invariants always join, so the
 * run is never empty. Two at a time, as CI runs them: more starve the browser suites.
 */
export function quickUnitArgs(base: string): string[] {
  return [
    "exec",
    "turbo",
    "run",
    "test",
    `--filter=[${base}]`,
    `--filter=!${INTEGRATION}`,
    `--filter=${REPO_TESTS}`,
    "--continue",
    "--concurrency=2",
  ];
}

/** The Vitest arguments of `test:quick`'s corpus step: L1 and L2 on all seven targets. */
export const QUICK_COMPILE_VITEST_ARGS: readonly string[] = ["--project", "compile"];

/** The steps of `test:quick`, for the merge base <base>. */
export function quickSteps(base: string): Step[] {
  return [
    { name: "unit", commands: [{ command: "pnpm", args: quickUnitArgs(base) }], jobs: [] },
    {
      name: "compile",
      // Through the package's `test` script, so the partial parity summary prints too.
      commands: [
        {
          command: "pnpm",
          args: ["--filter", INTEGRATION, "test", "--", ...QUICK_COMPILE_VITEST_ARGS],
        },
      ],
      jobs: [],
    },
  ];
}

/** The steps of `test:full`, each with the CI jobs it stands for. */
export const FULL_STEPS: readonly Step[] = [
  {
    name: "unit",
    commands: [
      {
        command: "pnpm",
        args: [
          "exec",
          "turbo",
          "run",
          "test",
          `--filter=!${INTEGRATION}`,
          "--continue",
          "--concurrency=2",
        ],
      },
    ],
    // Its four shards together are every package but the integration corpus.
    jobs: ["unit"],
  },
  {
    name: "corpus",
    // Alone, so the browser projects get the machine: every default project, then the summary.
    commands: [
      { command: "pnpm", args: ["exec", "turbo", "run", "test", `--filter=${INTEGRATION}`] },
    ],
    jobs: [
      "integration-compile",
      "integration-toolchains",
      "integration-ssr",
      "integration-browser",
    ],
  },
  {
    name: "bench",
    // The `bench` project, which the default run leaves out, then its summary (L15).
    commands: [{ command: "pnpm", args: ["--filter", INTEGRATION, "budgets"] }],
    jobs: ["bench"],
  },
  {
    name: "e2e",
    // Without `--pack` or `--reuse-tarballs`, prepare-apps packs and installs in one go.
    commands: [
      { command: "pnpm", args: ["--filter", "@unframework.dev/e2e", "prepare-apps"] },
      { command: "pnpm", args: ["--filter", "@unframework.dev/e2e", "e2e"] },
    ],
    jobs: ["pack", "e2e"],
  },
  {
    name: "canaries",
    commands: [{ command: "pnpm", args: ["test:canaries"] }],
    jobs: ["canaries"],
    when: "canary-paths",
  },
];

/** The CI jobs `test:full` leaves out, each with its reason. `.github/CONTRIBUTING.md` names them too. */
export const EXCLUDED_JOBS: Readonly<Record<string, string>> = {
  check:
    "format, lint and types, not tests: run `pnpm format:check && pnpm lint && pnpm check-types` first",
  changes: "CI's gate: test:full runs every step, and reuses the gate for the canaries alone",
  baselines:
    "needs Docker: `pnpm test:baselines:check` runs it, and on macOS the browser projects compare the targets live",
  parity: "merges CI's artefacts: the corpus step's own summary judges the local run",
  build: "builds the docs site, not a test: `pnpm --filter web build`",
  lighthouse: "audits the docs site, not a test: `pnpm --filter web lighthouse` after a build",
};

/** 0 when every step passed or was skipped, 1 otherwise. */
export function exitCode(results: readonly StepResult[]): number {
  return results.every((result) => result.status !== "failed") ? 0 : 1;
}

class UsageError extends Error {}

function print(line: string): void {
  process.stdout.write(`${line}\n`);
}

function git(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

/**
 * The merge base of <ref> and HEAD. turbo's own `[<ref>]` diffs against the tip of <ref>, so a
 * branch behind main would count main's newer commits as its own changes.
 */
export function resolveMergeBase(ref: string): string {
  const verified = git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
  if (verified.status !== 0) {
    throw new UsageError(
      `No commit named \`${ref}\`. Run \`git fetch origin main\`, or pass \`--base <ref>\` with a ref that exists.`,
    );
  }
  const base = git(["merge-base", ref, "HEAD"]);
  if (base.status !== 0 || base.stdout === "") {
    throw new UsageError(
      `\`${ref}\` and HEAD have no common commit. In a shallow clone, run \`git fetch --unshallow\`, or pass \`--base <ref>\`.`,
    );
  }
  return base.stdout;
}

/** The files the branch changed since <base>: committed, uncommitted and untracked. */
function changedFiles(base: string): string[] {
  const tracked = git(["diff", "--no-renames", "--name-only", base]);
  const untracked = git(["ls-files", "--others", "--exclude-standard"]);
  if (tracked.status !== 0 || untracked.status !== 0) {
    throw new Error(`git could not list the changed files: ${tracked.stderr || untracked.stderr}`);
  }
  return [...tracked.stdout.split("\n"), ...untracked.stdout.split("\n")].filter(Boolean);
}

/** CI's own gate: tests/integration/scripts/canary-paths.ts, given the changed files. */
function changesCanaryPaths(base: string): boolean {
  const gate = spawnSync(process.execPath, ["tests/integration/scripts/canary-paths.ts"], {
    cwd: ROOT,
    encoding: "utf8",
    input: `${changedFiles(base).join("\n")}\n`,
  });
  if (gate.status !== 0) throw new Error(`canary-paths.ts failed: ${gate.stderr.trim()}`);
  return /^canaries=true$/m.test(gate.stdout);
}

function format(command: Command): string {
  return [command.command, ...command.args].join(" ");
}

function runStep(step: Step, base: string): StepResult {
  const started = performance.now();
  const seconds = () => (performance.now() - started) / 1000;
  if (step.when === "canary-paths" && !changesCanaryPaths(base)) {
    return {
      name: step.name,
      status: "skipped",
      seconds: seconds(),
      note: "no canary path changed",
    };
  }
  for (const command of step.commands) {
    print(`\n[test-loop] ${step.name}: ${format(command)}\n`);
    const result = spawnSync(command.command, command.args, {
      cwd: ROOT,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    if (result.status !== 0) return { name: step.name, status: "failed", seconds: seconds() };
  }
  return { name: step.name, status: "passed", seconds: seconds() };
}

function list(mode: "quick" | "full", steps: readonly Step[]): void {
  for (const step of steps) {
    const jobs = step.jobs.length > 0 ? ` (CI: ${step.jobs.join(", ")})` : "";
    const when = step.when === "canary-paths" ? " [only when a canary path changed]" : "";
    print(`${step.name}${jobs}${when}`);
    for (const command of step.commands) print(`  ${format(command)}`);
  }
  if (mode === "full") {
    print("\nLeft out:");
    for (const [job, reason] of Object.entries(EXCLUDED_JOBS)) print(`  ${job}: ${reason}`);
  }
}

function parseArgs(argv: string[]): { mode: "quick" | "full"; base: string; list: boolean } {
  const args = argv.filter((arg) => arg !== "--");
  const mode = args.shift();
  if (mode !== "quick" && mode !== "full") {
    throw new UsageError("Usage: node scripts/test-loop.ts quick|full [--base <ref>] [--list]");
  }
  let base = DEFAULT_BASE;
  let listOnly = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--list") {
      listOnly = true;
    } else if (arg === "--base" && next !== undefined && !next.startsWith("--")) {
      base = next;
      index++;
    } else if (arg?.startsWith("--base=")) {
      base = arg.slice("--base=".length);
    } else {
      throw new UsageError(
        `Unknown argument \`${arg}\`. Usage: test:${mode} [--base <ref>] [--list]`,
      );
    }
  }
  return { mode, base, list: listOnly };
}

function main(): number {
  const options = parseArgs(process.argv.slice(2));
  if (options.list) {
    list(options.mode, options.mode === "quick" ? quickSteps("<merge-base>") : FULL_STEPS);
    return 0;
  }
  const base = resolveMergeBase(options.base);
  print(
    `[test-loop] test:${options.mode}: changes since ${base.slice(0, 12)}, the merge base of ${options.base} and HEAD`,
  );
  const steps = options.mode === "quick" ? quickSteps(base) : FULL_STEPS;
  const results = steps.map((step) => runStep(step, base));
  print(`\n[test-loop] test:${options.mode}`);
  for (const result of results) {
    const note = result.note ? ` (${result.note})` : "";
    print(
      `  ${result.name.padEnd(9)}${result.status.padEnd(8)}${result.seconds.toFixed(1)} s${note}`,
    );
  }
  return exitCode(results);
}

if (import.meta.main) {
  try {
    process.exitCode = main();
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    process.stderr.write(`[test-loop] ${error.message}\n`);
    process.exitCode = 1;
  }
}
