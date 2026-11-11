// `unframework test [--target <t>]… [--update] [-- <vitest args>]` (ADR-0086): runs a project's
// tests with Vitest, on its `vitest.config.ts` when it has one, or else on `defineTestConfig()`.
// The umbrella registers it (D3), so `@unframework.dev/cli`, a layer below, never imports it.
import { existsSync } from "node:fs";
import { join } from "node:path";

import { TARGET_NAMES } from "@unframework.dev/compiler";
import { parseCLI, startVitest } from "vitest/node";

import { defineTestConfig } from "./config/index.ts";

/** Where the command runs and writes: the shape of `@unframework.dev/cli`'s `Io`. */
export interface TestIo {
  cwd: string;
  stdout(text: string): void;
  stderr(text: string): void;
}

/** The command's arguments, read. */
export interface TestArguments {
  targets: string[];
  update: boolean;
  /** What follows `--`, for Vitest. */
  vitest: string[];
}

/** The files a project's own Vitest configuration may have, the first one found winning. */
const VITEST_CONFIGS = [
  "vitest.config.ts",
  "vitest.config.mts",
  "vitest.config.js",
  "vitest.config.mjs",
];

/** Reads the arguments, throwing on a usage error: the CLI exits 2 with the message. */
export function parseTestArguments(args: readonly string[]): TestArguments {
  const parsed: TestArguments = { targets: [], update: false, vitest: [] };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === "--") {
      parsed.vitest = args.slice(index + 1);
      break;
    }
    if (arg === "--update") {
      parsed.update = true;
      continue;
    }
    const target = /^--target(?:=(.*))?$/s.exec(arg);
    if (target) {
      const value = target[1] ?? args[(index += 1)];
      if (value === undefined || value === "" || value.startsWith("-")) {
        throw new Error("--target needs a target's name, such as --target react.");
      }
      parsed.targets.push(value);
      continue;
    }
    throw new Error(
      `unknown argument "${arg}". Pass Vitest's own options after --, such as unframework test -- --reporter=json.`,
    );
  }
  const unknown = parsed.targets.filter(
    (name) => !(TARGET_NAMES as readonly string[]).includes(name),
  );
  if (unknown.length) {
    throw new Error(
      `unknown target${unknown.length > 1 ? "s" : ""} ${unknown.join(", ")}. The targets are ${TARGET_NAMES.join(", ")}.`,
    );
  }
  return parsed;
}

/**
 * Runs the tests and gives the exit code: 0 when every test passes, 1 when one fails, and 2 on a
 * usage or configuration error, which it reports, as the CLI's other commands do (ADR-0076).
 * Vitest's own options (`--reporter`, a file filter) follow `--`.
 */
export async function run(args: string[], io: TestIo): Promise<number> {
  const parsed = parseTestArguments(args);
  const { filter, options } = parseCLI(["vitest", ...parsed.vitest]);
  if (options.update !== undefined && options.update !== false) {
    throw new Error(
      "Vitest's --update does not update the shared expectations: run unframework test --update.",
    );
  }
  const config = VITEST_CONFIGS.map((name) => join(io.cwd, name)).find((file) => existsSync(file));
  // The targets and the mode reach the project's configuration through the environment, whether
  // it is the project's own file or `defineTestConfig()` here.
  const saved = {
    targets: process.env.UF_TARGETS,
    update: process.env.UF_UPDATE,
    cli: process.env.UF_TEST_CLI,
  };
  const exitCode = process.exitCode;
  if (parsed.targets.length) process.env.UF_TARGETS = parsed.targets.join(",");
  else delete process.env.UF_TARGETS;
  if (parsed.update) process.env.UF_UPDATE = "1";
  else delete process.env.UF_UPDATE;
  process.env.UF_TEST_CLI = "1";
  try {
    // An invalid configuration is a configuration error, before Vitest starts.
    const inline = config === undefined ? await defineTestConfig({ root: io.cwd }) : undefined;
    process.exitCode = 0;
    const vitest = await startVitest(
      filter,
      { ...options, root: io.cwd, run: true, watch: false, config: config ?? false },
      inline,
    );
    const failed =
      process.exitCode !== 0 ||
      vitest.state.getCountOfFailedTests() > 0 ||
      vitest.state.getUnhandledErrors().length > 0;
    return failed ? 1 : 0;
  } finally {
    process.exitCode = exitCode;
    restore("UF_TARGETS", saved.targets);
    restore("UF_UPDATE", saved.update);
    restore("UF_TEST_CLI", saved.cli);
  }
}

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
