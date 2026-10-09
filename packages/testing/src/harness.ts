// What the integration harness provides to every project (`test.provide`), so the browser API,
// the browser commands and the Node drivers agree on the cases, the mode and the write policy.
// Types only, plus pure helpers: the values are computed once per run in Node
// (`createHarnessRun` in `@unframework/testing/node`).
import type { Capabilities } from "@unframework/codegen";

import type { QuarantineEntry } from "./layers.ts";

/** An SSR scenario of a case: the props it renders with. */
export interface SsrScenario {
  props?: Record<string, unknown>;
}

/** A case's optional `case.json` (plan §7.1). */
export interface CaseConfig {
  description?: string;
  /**
   * The input the spec and the SSR scenarios render, by file name (`"Form.uf.tsx"`), when the
   * case holds several: the others are its children or its harness parents (ADR-0057). A case
   * with one input needs none.
   */
  main?: string;
  /** L6 scenarios by name; a case without any renders `default` with no props. */
  ssr?: Record<string, SsrScenario>;
  /** The axe rule ids L11 expects to fail on this case, exactly; none by default. */
  axe?: string[];
  /**
   * Why every test of the case requires a capability (ADR-0050): its client code changes the
   * mounted DOM (an `onMounted` that writes state, say), so no test of it can pass on a target
   * without the capability, and the server render (L6) is what checks that target. The harness
   * refuses the note on a case with a test that requires nothing, and requires it on a case
   * whose every test requires something.
   */
  requires?: string;
  /**
   * The target that writes the case's shared expectations in place of the run's reference
   * (ADR-0057), for a case that requires a capability Vue renders differently (`listbox`): the
   * compile project checks that Vue declares the capability unsupported and this target native.
   */
  reference?: string;
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
    /**
     * Browser projects: the target's capability matrix, as plain data. The browser reads it to
     * skip a test that requires an unsupported capability (`it(name, { requires }, fn)`) and to
     * refuse interactions where nothing runs; it never imports a target, whose compiler code
     * does not run in a browser.
     */
    ufCapabilities: Capabilities;
    /**
     * Browser projects: the cases the target has no output for (their expected diagnostics hold
     * an error for it, the one it declares for a capability it lacks), by case id, each with
     * those errors. Their specs load against a stand-in for the component, and each test is
     * skipped with `no output: <the errors>`. Absent outside the harness.
     */
    ufNoOutput: Record<string, string>;
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

/**
 * The target that writes a case's shared artefacts: the one its `case.json` names (ADR-0057), or
 * the run's reference.
 */
export function caseReference(
  harness: Pick<HarnessContext, "reference" | "cases">,
  caseId: string,
): string {
  return harness.cases[caseId]?.reference ?? harness.reference;
}

/**
 * Whether a target writes a case's shared artefacts in update mode: the case's reference
 * (`caseReference`).
 */
export function isReference(
  harness: Pick<HarnessContext, "reference" | "cases">,
  target: string,
  caseId: string,
): boolean {
  return caseReference(harness, caseId) === target;
}

/**
 * The targets that write some case's shared artefacts in place of the run's reference
 * (ADR-0057): they run after the reference and before every other target (`groupOrder`).
 */
export function caseReferences(harness: Pick<HarnessContext, "reference" | "cases">): string[] {
  return [
    ...new Set(
      Object.values(harness.cases).flatMap((config) =>
        config.reference && config.reference !== harness.reference ? [config.reference] : [],
      ),
    ),
  ].sort();
}
