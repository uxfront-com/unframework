// Runs the harness's Vitest from scripts, with the package's own Vitest binary.
import { spawnSync } from "node:child_process";
import type { StdioOptions } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { ROOT } from "../harness/paths.ts";

const require = createRequire(import.meta.url);
const VITEST = join(dirname(require.resolve("vitest/package.json")), "vitest.mjs");

/** Runs `vitest run <args>` in the integration package and returns its exit status. */
export function runVitest(
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  stdio: StdioOptions = "inherit",
): { status: number; stdout: string } {
  const result = spawnSync(process.execPath, [VITEST, "run", ...args], {
    cwd: ROOT,
    env,
    stdio,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  // A signal (no status) is a failure too.
  return { status: result.status ?? 1, stdout: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

/** Whether `CI` is set (and not "0" or "false"). */
export function isCI(env: NodeJS.ProcessEnv): boolean {
  const value = env.CI?.trim();
  return Boolean(value) && value !== "0" && value !== "false";
}
