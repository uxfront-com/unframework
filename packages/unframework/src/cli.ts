// The `unframework` command line of the umbrella (ADR-0016, ADR-0076, ADR-0086): the commands of
// `@unframework.dev/cli`, and the ones that need packages above it. `test` runs Vitest through
// `@unframework.dev/testing`, an optional peer dependency, so it loads when it runs, and says what
// to install when it can't (D3 of the M7 plan: `cli` sits below `testing` in LAYERS).
import { main as runCli } from "@unframework.dev/cli";
import type { Command, Io, RunCommand } from "@unframework.dev/cli";

export type { Io } from "@unframework.dev/cli";

/** What `unframework test` needs besides the umbrella: the testing package and its runner. */
export const TEST_PACKAGES: readonly string[] = [
  "@unframework.dev/testing",
  "vitest",
  "@vitest/browser-playwright",
  "playwright",
];

/**
 * What each target's tests need in the project: its framework and the framework's Vite plugin, which
 * the target packages keep as development dependencies. Angular's compiler stack resolves from
 * `package.resolveFrom` (ADR-0086).
 */
export const TARGET_TEST_PACKAGES: Readonly<Record<string, readonly string[]>> = {
  react: [
    "react",
    "react-dom",
    "@vitejs/plugin-react",
    "@babel/core",
    "babel-plugin-react-compiler",
  ],
  vue: ["vue", "@vitejs/plugin-vue"],
  svelte: ["svelte", "@sveltejs/vite-plugin-svelte"],
  solid: ["solid-js", "vite-plugin-solid", "@babel/core"],
  angular: [
    "@angular/core",
    "@angular/common",
    "@angular/platform-browser",
    "@angular/platform-server",
    "@angular/compiler",
    "@angular/compiler-cli",
    "@angular/build",
    "@analogjs/vite-plugin-angular",
  ],
  qwik: ["@qwik.dev/core"],
  astro: ["astro"],
};

/** Loads the test command, from `@unframework.dev/testing/cli`. */
export type TestLoader = () => Promise<{ run: RunCommand }>;

const loadTesting: TestLoader = () => import("@unframework.dev/testing/cli");

/**
 * The `test` command. When a package it needs is not installed, it runs a command that says what to
 * install and exits 2. Any other error loading it is the CLI's to report, as a configuration error.
 */
export function testCommand(load: TestLoader = loadTesting): Command {
  return {
    usage: "test [--target <t>]... [--update] [-- <vitest args>]",
    summary: "Run the project's tests on every target, through Vitest.",
    async load() {
      try {
        return await load();
      } catch (error) {
        if (!isMissingModule(error)) throw error;
        return { run: (_args, io) => Promise.resolve(missing(error, io)) };
      }
    },
  };
}

function isMissingModule(error: unknown): error is Error {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND";
}

function missing(error: Error, io: Io): number {
  const targets = Object.entries(TARGET_TEST_PACKAGES)
    .map(([target, names]) => `  ${target}: ${names.join(", ")}`)
    .join("\n");
  io.stderr(
    `unframework test: ${error.message}\n\n` +
      `unframework test needs ${TEST_PACKAGES.join(", ")} in the project:\n\n` +
      `  npm install --save-dev ${TEST_PACKAGES.join(" ")}\n\n` +
      `and, for each target it tests, the framework and its Vite plugin:\n\n${targets}\n`,
  );
  return 2;
}

/**
 * Runs a command line, `argv` without Node and the script, and gives the exit code: 0 for success,
 * 1 for error diagnostics or failed tests, 2 for a usage or configuration error.
 */
export function main(
  argv: readonly string[],
  io?: Io,
  load: TestLoader = loadTesting,
): Promise<number> {
  return runCli(argv, io, new Map([["test", testCommand(load)]]));
}
