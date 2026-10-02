// The run's mode (DESIGN §4.4, §4.7), resolved once at config time from the environment, and
// the project ordering it needs. Every refusal throws while the config loads, before anything
// runs or writes.
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import type { CaseConfig, HarnessContext, PixelMode } from "../harness.ts";
import type { QuarantineEntry } from "../layers.ts";

/**
 * The image and platform the committed Linux baselines (`*-chromium-linux.png`, geometry) come
 * from: CI's browser jobs run in it, and `pnpm test:baselines` exports it as
 * `UF_BASELINE_ENVIRONMENT`. Only a run in it writes them. The image follows the playwright
 * version of the catalog, which ships its browsers.
 */
export const BASELINE_ENVIRONMENT = "mcr.microsoft.com/playwright:v1.63.0-noble linux/amd64";

/** How this run treats artefacts. */
export interface HarnessMode {
  /** `UF_UPDATE=1`: owners and the reference write. */
  update: boolean;
  /**
   * `baseline` in CI and in the baseline environment, `live` elsewhere; `UF_PIXELS` overrides.
   * Another host's Chromium and system libraries render differently from the image's, so a
   * plain Linux host compares live too.
   */
  pixels: PixelMode;
  /** `UF_CANARY=<id>`: the canary compiler plugin to install. */
  canary: string | null;
  /** `CI` is set: check mode only, against committed baselines. */
  ci: boolean;
  /**
   * `UF_BASELINE_ENVIRONMENT`: the image and platform the run says it is in, if any. Only
   * {@link BASELINE_ENVIRONMENT} may write the committed visual baselines.
   */
  baselineEnvironment?: string | null;
}

/** What {@link resolveHarnessMode} reads. */
export interface ModeInput {
  env: Readonly<Record<string, string | undefined>>;
  platform: NodeJS.Platform;
  /** The CPU architecture, `process.arch` by default: the baseline environment is x64. */
  arch?: NodeJS.Architecture;
  argv: readonly string[];
  /**
   * The run has no committed visual baselines (the testing package's own fixture, whose one
   * target is its own reference): pixels are always live, in CI too, and `UF_PIXELS` is refused.
   */
  liveOnly?: boolean;
}

/** Resolves the run's mode, refusing combinations that would write the wrong thing. */
export function resolveHarnessMode(input: ModeInput): HarnessMode {
  const { env } = input;
  const ci = isCI(env);
  if (input.argv.some((arg) => arg === "-u" || arg === "--update" || arg.startsWith("--update="))) {
    throw new Error(
      "[uf] Vitest's -u does not update the harness's artefacts, and would let every project write the shared ones. Run `pnpm test:update` (UF_UPDATE=1) instead.",
    );
  }
  const update = flag(env, "UF_UPDATE");
  if (update && ci) {
    throw new Error("[uf] CI never writes artefacts: refusing UF_UPDATE while CI is set.");
  }
  const canary = env.UF_CANARY?.trim() || null;
  if (canary && update) {
    throw new Error(
      `[uf] A canary run never writes artefacts: refusing UF_UPDATE with UF_CANARY=${canary}.`,
    );
  }
  const baselineEnvironment = env.UF_BASELINE_ENVIRONMENT?.trim() || null;
  const here = `${input.platform}/${input.arch ?? process.arch}`;
  if (baselineEnvironment === BASELINE_ENVIRONMENT && here !== "linux/x64") {
    throw new Error(
      `[uf] UF_BASELINE_ENVIRONMENT says ${baselineEnvironment}, but this run is on ${here}.`,
    );
  }
  const forced = env.UF_PIXELS?.trim();
  if (forced && forced !== "baseline" && forced !== "live") {
    throw new Error(`[uf] UF_PIXELS must be "baseline" or "live", not "${forced}".`);
  }
  if (input.liveOnly) {
    if (forced) {
      throw new Error(
        `[uf] This run has no committed baselines: UF_PIXELS=${forced} cannot apply.`,
      );
    }
    return { update, pixels: "live", canary, ci, baselineEnvironment };
  }
  const pixels: PixelMode =
    (forced as PixelMode | undefined) ?? (ci || baselineEnvironment ? "baseline" : "live");
  if (ci && pixels === "live") {
    throw new Error("[uf] CI compares pixels against the committed Linux baselines, never live.");
  }
  if (ci && input.platform !== "linux") {
    throw new Error(
      `[uf] CI compares pixels against the committed Linux baselines, so it runs on Linux, not ${input.platform}.`,
    );
  }
  if (update && pixels === "baseline" && baselineEnvironment !== BASELINE_ENVIRONMENT) {
    throw new Error(
      `[uf] UF_UPDATE with baseline pixels would write the committed Linux baselines, which only ${BASELINE_ENVIRONMENT} writes (\`pnpm test:baselines\`); this run is ${baselineEnvironment ?? `on ${here}, outside it`}. Unset UF_PIXELS (or set it to live) to update everything else.`,
    );
  }
  return { update, pixels, canary, ci, baselineEnvironment };
}

/** Whether `CI` is set to anything but `0` or `false`, as CI providers set it. */
export function isCI(env: Readonly<Record<string, string | undefined>>): boolean {
  return flag(env, "CI", { allowAny: true });
}

function flag(
  env: Readonly<Record<string, string | undefined>>,
  name: string,
  options: { allowAny?: boolean } = {},
): boolean {
  const value = env[name]?.trim();
  if (!value || value === "0" || value === "false") return false;
  if (value === "1" || value === "true" || options.allowAny) return true;
  throw new Error(`[uf] ${name} must be 1 or 0, not "${value}".`);
}

/** The kinds of project the harness runs (plan §7.3). */
export type ProjectKind = "compile" | "harness" | "toolchain" | "ssr" | "browser";

/**
 * A project's `sequence.groupOrder`. Groups run one after another, so a project that reads what
 * another writes in the same run must sit in a later group:
 *
 * - update: compile (and the harness's own tests) 0, then the toolchains and the reference's
 *   ssr and browser projects 1, then every follower 2;
 * - check with live pixels: the reference browser project 0, the other browser projects 1;
 * - check with baselines (CI): everything 0, in parallel.
 */
export function groupOrder(
  kind: ProjectKind,
  target: string | undefined,
  mode: Pick<HarnessMode, "update" | "pixels">,
  reference: string,
): number {
  const isReference = target === reference;
  if (mode.update) {
    if (kind === "compile" || kind === "harness") return 0;
    if (kind === "toolchain" || isReference) return 1;
    return 2;
  }
  if (mode.pixels === "live" && kind === "browser") return isReference ? 0 : 1;
  return 0;
}

/** What a run is made of, besides the mode. */
export interface HarnessRunOptions {
  /** The integration package's directory: scratch output goes under it. */
  root: string;
  casesDir: string;
  reference: string;
  mode: HarnessMode;
  quarantine: QuarantineEntry[];
  cases: Record<string, CaseConfig>;
}

const RUN = Symbol.for("unframework.harness.run");

/**
 * Creates the run's context, once per process: Vitest evaluates the config file more than once
 * (the root, then each project), and every evaluation must agree on the run id. Each run's
 * scratch output (the ledger, live captures and diffs) is its own directory, named by the run
 * id; the first call removes the directories of runs that have ended, and never those of a run
 * still going in another process (`pnpm test:canaries` next to `pnpm test`).
 */
export function createHarnessRun(options: HarnessRunOptions): HarnessContext {
  const store = globalThis as { [RUN]?: HarnessContext };
  const existing = store[RUN];
  const quarantine = applicableQuarantine(options.quarantine, options.mode.pixels);
  if (existing && existing.casesDir === options.casesDir) {
    // A re-evaluated config (watch mode) may have new cases or quarantine entries.
    existing.cases = options.cases;
    existing.quarantine = quarantine;
    return existing;
  }
  const runId = `${Date.now().toString(36)}-${process.pid}`;
  const scratch = {
    ledger: join(options.root, ".reports", "ledger"),
    live: join(options.root, ".live"),
    diffs: join(options.root, ".reports", "diffs"),
  };
  for (const directory of Object.values(scratch)) removeEndedRuns(directory);
  const run: HarnessContext = {
    runId,
    casesDir: options.casesDir,
    reference: options.reference,
    update: options.mode.update,
    pixels: options.mode.pixels,
    canary: options.mode.canary,
    baselineEnvironment: options.mode.baselineEnvironment ?? null,
    ledgerDir: join(scratch.ledger, runId),
    liveDir: join(scratch.live, runId),
    diffsDir: join(scratch.diffs, runId),
    quarantine,
    cases: options.cases,
  };
  store[RUN] = run;
  return run;
}

/**
 * The entries a run in this pixel mode applies: every entry, but an L10 entry that names the
 * other mode. Throws on an entry that names a pixel mode for a layer that has none.
 */
function applicableQuarantine(
  entries: readonly QuarantineEntry[],
  pixels: PixelMode,
): QuarantineEntry[] {
  for (const entry of entries) {
    if (entry.pixels === undefined) continue;
    if (entry.layer !== "L10" || (entry.pixels !== "baseline" && entry.pixels !== "live")) {
      throw new Error(
        `[uf] The quarantine entry ${entry.case} › ${entry.target} › ${entry.layer} names pixels: ${JSON.stringify(entry.pixels)}: only L10 depends on the pixel mode, which is "baseline" or "live".`,
      );
    }
  }
  return entries.filter((entry) => entry.pixels === undefined || entry.pixels === pixels);
}

/** Removes the run directories under `directory` whose process has ended (`<time>-<pid>`). */
function removeEndedRuns(directory: string): void {
  if (!existsSync(directory)) return;
  for (const name of readdirSync(directory)) {
    const pid = /^[0-9a-z]+-(\d+)$/.exec(name)?.[1];
    if (pid !== undefined && isRunning(Number(pid))) continue;
    rmSync(join(directory, name), { recursive: true, force: true });
  }
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: the process exists, but belongs to someone else.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}
