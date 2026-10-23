// Where the harness lives and writes. Real paths: plugin-vue compares ids with the root by
// prefix, and Vite's ids are real paths (the SSR spike, on macOS's /tmp symlink).
import { realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { BrowserEngine } from "@unframework/testing/node";

/** The integration package: the Vitest root of every project. */
export const ROOT: string = realpathSync(fileURLToPath(new URL("..", import.meta.url)));

/** The corpus: a case is a directory `cases/<area>/<name>/` holding its `.uf.tsx` inputs. */
export const CASES_DIR: string = join(ROOT, "cases");

/** The partial parity matrices (`parity-matrix.<run>.json`) and the merged summary. */
export const REPORTS_DIR: string = join(ROOT, ".reports");

/**
 * Where a run in an engine writes its partial matrices and its summary: Chromium's in
 * {@link REPORTS_DIR}, Firefox's and WebKit's each in a directory of its own (ADR-0066), so a
 * run in one engine never supersedes or merges the records of another.
 */
export function reportsDirOf(browser: BrowserEngine): string {
  return browser === "chromium" ? REPORTS_DIR : join(REPORTS_DIR, browser);
}

/** Vitest's screenshots of failed browser tests: scratch, never next to the baselines. */
export const FAILURE_SCREENSHOTS_DIR: string = join(REPORTS_DIR, "failures");

/** Canary runs: each canary's fresh compile and its parity matrix (`.canary/<id>/`). */
export const CANARY_DIR: string = join(ROOT, ".canary");

/** The repository root. */
export const REPO_ROOT: string = realpathSync(join(ROOT, "..", ".."));

/** A target's test toolchain package: its checkers and their TypeScript 6 (ADR-0022). */
export function toolchainDir(target: string): string {
  return join(REPO_ROOT, "tests", "toolchains", target);
}
