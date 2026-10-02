// What the integration harness provides to every project (`test.provide`), so the browser API,
// the browser commands and the Node drivers agree on the cases, the mode and the write policy.
// Types only, plus pure helpers: the values are computed once per run in Node
// (`createHarnessRun` in `@unframework/testing/node`).
import type { QuarantineEntry } from "./layers.ts";

/** An SSR scenario of a case: the props it renders with. */
export interface SsrScenario {
  props?: Record<string, unknown>;
}

/** A case's optional `case.json` (DESIGN §4.4). */
export interface CaseConfig {
  description?: string;
  /** L6 scenarios by name; a case without any renders `default` with no props. */
  ssr?: Record<string, SsrScenario>;
  /** The axe rule ids L11 expects to fail on this case, exactly; none by default. */
  axe?: string[];
}

/**
 * What L10 compares with: the committed Linux baselines (geometry and pixels), or the reference
 * target's capture from this run.
 */
export type PixelMode = "baseline" | "live";

/** The run-wide harness context, provided to every project as `ufHarness`. */
export interface HarnessContext {
  /** Identifies this run: the scratch files of different runs never mix. */
  runId: string;
  /** Absolute path of the cases directory; a case id is a path relative to it. */
  casesDir: string;
  /** The reference target (D10): in update mode it alone writes the shared artefacts. */
  reference: string;
  /** Update mode (`UF_UPDATE=1`): writes artefacts instead of only comparing. */
  update: boolean;
  pixels: PixelMode;
  /** The canary installed in this run (`UF_CANARY`), or `null`. */
  canary: string | null;
  /**
   * The image and platform the run is in (`UF_BASELINE_ENVIRONMENT`), or `null`. The visual
   * command writes the committed baselines only when it is `BASELINE_ENVIRONMENT`.
   */
  baselineEnvironment: string | null;
  /** Update mode: where the reference records what it wrote in this run, for its followers. */
  ledgerDir: string;
  /** Live pixels: where the reference publishes its captures for this run. */
  liveDir: string;
  /** Where this run's failed visual comparisons leave their reference, actual and diff images. */
  diffsDir: string;
  quarantine: QuarantineEntry[];
  /** Every case's `case.json`, by case id (`{}` when a case has none). */
  cases: Record<string, CaseConfig>;
}

declare module "vitest" {
  interface ProvidedContext {
    /** The target this project verifies, such as `"vue"`. */
    target: string;
    ufHarness: HarnessContext;
  }
}

/** The SSR scenarios of a case: its declared ones, or `default` with no props. */
export function ssrScenarios(config: CaseConfig): Record<string, SsrScenario> {
  return config.ssr && Object.keys(config.ssr).length ? config.ssr : { default: {} };
}

/**
 * The case a file belongs to: the path of its directory relative to the cases directory, with
 * forward slashes. Throws for a file outside every case, because its results would have
 * nowhere to go in the parity matrix.
 */
export function caseOfFile(
  file: string,
  harness: Pick<HarnessContext, "casesDir" | "cases">,
): string {
  const normalized = file.replaceAll("\\", "/");
  const casesDir = harness.casesDir.replaceAll("\\", "/").replace(/\/$/, "");
  const directory = normalized.slice(0, normalized.lastIndexOf("/"));
  const id = directory.startsWith(`${casesDir}/`) ? directory.slice(casesDir.length + 1) : "";
  if (!id || !Object.hasOwn(harness.cases, id)) {
    throw new Error(
      `${file} is not in a case directory under ${casesDir}: a spec lives next to its case's .uf.tsx.`,
    );
  }
  return id;
}

/** Whether a target is the run's reference, which writes the shared artefacts in update mode. */
export function isReference(harness: Pick<HarnessContext, "reference">, target: string): boolean {
  return harness.reference === target;
}
