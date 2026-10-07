// L5 for Qwik (ADR-0042 and its M2 amendment): oxlint with the shared baseline and
// eslint-plugin-qwik as a JS plugin, and ESLint for the plugin's type-aware rules, which read
// types oxlint gives no JS plugin. typescript-eslint, which provides them, cannot load
// TypeScript 7, the toolchain's own for tsgo (L4), so ESLint runs from a lint host on
// TypeScript 6 that the toolchain directory installs (R8).
import { dirname, join } from "node:path";

import type { ToolchainContext, ToolchainMessage } from "@unframework/codegen";
import {
  lintWithEslint,
  lintWithOxlint,
  mergeLintResults,
  resolveInstalled,
} from "@unframework/codegen/toolchain-node";

/** The lint host's package, which the toolchain directory installs (tests/toolchains/qwik-eslint). */
const ESLINT_HOST = "@unframework/toolchain-qwik-eslint";

/**
 * Lints Qwik output files with oxlint and with the type-aware rules ({@link lintTypes}) at once,
 * and merges their results by file. When a linter cannot run, the run rejects with oxlint's
 * failure first, so a failure names the same linter whichever run ends first.
 */
export async function lint(
  files: readonly string[],
  context: ToolchainContext,
): Promise<Map<string, ToolchainMessage[]>> {
  const [oxlint, types] = await Promise.allSettled([
    lintWithOxlint(files, context),
    lintTypes(files, context),
  ]);
  if (oxlint.status === "rejected") throw oxlint.reason;
  if (types.status === "rejected") throw types.reason;
  return mergeLintResults([oxlint.value, types.value]);
}

/**
 * eslint-plugin-qwik's type-aware rules over `files`, in ESLint run from the lint host the
 * toolchain directory installs, with its `eslint.config.js`. The files are typed by the
 * toolchain's tsconfig, as tsgo checks them (L4): a `$` scope's captures are judged by the types
 * L4 proved.
 */
export async function lintTypes(
  files: readonly string[],
  context: ToolchainContext,
): Promise<Map<string, ToolchainMessage[]>> {
  const manifest = resolveInstalled(context.toolchainDir, `${ESLINT_HOST}/package.json`);
  if (manifest === undefined) {
    throw new Error(
      `${ESLINT_HOST} is not installed in ${context.toolchainDir}: the Qwik toolchain directory ` +
        `must install its ESLint host (in this repo, tests/toolchains/qwik lists it).`,
    );
  }
  return lintWithEslint(
    files,
    { ...context, toolchainDir: dirname(manifest) },
    { tsconfig: join(context.toolchainDir, "tsconfig.json") },
  );
}
