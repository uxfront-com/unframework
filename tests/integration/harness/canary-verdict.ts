// How `pnpm test:canaries` judges a canary run (plan §7.7). The run must fail, and on every
// target the canary corrupts, every case a project of the canary verifies must fail the
// canary's layer with the evidence of each sub-check the canary names. A case where the layer
// passes is a blind spot, not a warning: the canary corrupted it, and nothing noticed.
import { outcomeOfCell } from "@unframework/testing/node";
import type { ParityMatrix, ProjectKind } from "@unframework/testing/node";

import { canaryProjects } from "./canaries.ts";
import type { Canary, Evidence } from "./canaries.ts";
import type { LoadFailure } from "./load-failures.ts";
import { REFERENCE } from "./targets.ts";

/** What the verdict needs to know about a case of the corpus. */
export interface CanaryCase {
  id: string;
  /** Whether the case has output for a target: a case with compile errors has none to corrupt. */
  hasOutput(target: string): boolean;
  /** The browser spec, relative to the integration package, which the browser projects run. */
  spec: string | undefined;
}

/** One canary run: Vitest's exit status, and what it wrote, if it got that far. */
export interface CanaryRun {
  status: number;
  /** The cells of its parity matrix. */
  cells: ParityMatrix["cases"] | undefined;
  /** The specs it could not load. */
  loadFailures?: readonly LoadFailure[] | undefined;
}

/** Whether a canary was caught, and every reason it was not. */
export interface CanaryVerdict {
  caught: boolean;
  problems: string[];
}

/** Judges one canary run against the targets it ran on and the corpus. */
export function judgeCanary(
  canary: Canary,
  run: CanaryRun,
  targets: readonly string[],
  cases: readonly CanaryCase[],
): CanaryVerdict {
  const problems: string[] = [];
  if (run.status === 0) problems.push("the run passed");
  const { cells } = run;
  if (!cells) {
    problems.push("the run wrote no parity matrix");
    return { caught: false, problems };
  }
  if (canary.loadEvidence && !run.loadFailures) {
    problems.push("the run wrote no list of the specs it could not load");
    return { caught: false, problems };
  }
  const corrupted = canary.followersOnly
    ? targets.filter((target) => target !== REFERENCE)
    : targets;
  if (!corrupted.length) problems.push("the run covered no target the canary corrupts");
  for (const target of corrupted) {
    /** The kinds of project that had a case to judge on this target. */
    const judged = new Set<ProjectKind>();
    for (const info of cases) {
      const kinds = canaryProjects(canary).filter((kind) => verifies(canary, kind, info, target));
      const cellKinds = kinds.filter((candidate) => candidate in canary.evidence);
      for (const kind of kinds.filter((candidate) => candidate in (canary.loadEvidence ?? {}))) {
        const where = `${target} › ${info.id} › ${kind}:${target}`;
        const failure = run.loadFailures!.find(
          (candidate) => candidate.project === `${kind}:${target}` && candidate.file === info.spec,
        );
        judged.add(kind);
        if (!failure) {
          problems.push(`${where}: ${info.spec} loaded, although the canary corrupted the case`);
          continue;
        }
        const message = failure.errors.join("\n");
        problems.push(
          ...missingEvidence(where, kind, canary.loadEvidence![kind]!, target, message),
        );
      }
      if (!cellKinds.length) continue;
      const where = `${target} › ${info.id} › ${canary.layer}`;
      const cell = cells[info.id]?.[target]?.[canary.layer];
      if (cell === undefined) {
        problems.push(`${where}: no result, although the canary corrupted the case`);
        continue;
      }
      const outcome = outcomeOfCell(cell);
      // A known failure hides what failed; the other cases must prove the canary.
      if (outcome.status === "quarantined") continue;
      for (const kind of cellKinds) judged.add(kind);
      if (outcome.status !== "fail") {
        problems.push(`${where}: ${cell}, although the canary corrupted the case`);
        continue;
      }
      for (const kind of cellKinds) {
        problems.push(
          ...missingEvidence(where, kind, canary.evidence[kind] ?? {}, target, outcome.message),
        );
      }
    }
    for (const kind of canaryProjects(canary)) {
      if (!judged.has(kind)) {
        problems.push(`${target}: no case could prove it in the ${kind} projects`);
      }
    }
  }
  return { caught: problems.length === 0, problems };
}

/** The sub-checks whose evidence a failure's message lacks, as problems. */
function missingEvidence(
  where: string,
  kind: ProjectKind,
  checks: Readonly<Record<string, Evidence>>,
  target: string,
  message: string,
): string[] {
  return Object.entries(checks).flatMap(([check, evidence]) => {
    const pattern = typeof evidence === "function" ? evidence(target) : evidence;
    if (pattern.test(message)) return [];
    return [
      `${where}: failed, but not in the ${kind} ${check} check (${pattern}): ${summarise(message)}`,
    ];
  });
}

/**
 * Whether a kind of project verifies a case on a target under a canary. A case with compile
 * errors has no output to corrupt, except for the compile project under a source canary, which
 * corrupts the source itself; the browser projects run only cases with a spec.
 */
function verifies(canary: Canary, kind: ProjectKind, info: CanaryCase, target: string): boolean {
  if (kind === "compile" && canary.source !== undefined) return true;
  if (!info.hasOutput(target)) return false;
  return kind !== "browser" || info.spec !== undefined;
}

/** The first line of a failure, for one line of the runner's report. */
function summarise(message: string): string {
  const line =
    message
      .split("\n")
      .find((text) => text.trim())
      ?.trim() ?? "";
  return line.length > 200 ? `${line.slice(0, 199)}…` : line;
}
