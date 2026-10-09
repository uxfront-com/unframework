// How `pnpm test:canaries` judges a canary run (plan §7.7). The run must fail, and on every
// target the canary corrupts, every case a project of the canary verifies must fail the
// canary's layer with the evidence of each sub-check the canary names. A case where the layer
// passes is a blind spot, not a warning: the canary corrupted it, and nothing noticed.
//
// Each kind of project is judged on its own cells (the run's `byProject`), never on a cell
// merged across projects: an ssr project's failure proves nothing of the browser project, and
// a browser project whose every test of a case its target skipped by capability ran nothing,
// which is no evidence either way. A target on which the canary applies to no case is not
// judged, and the verdict says so.
import { outcomeOfCell } from "@unframework/testing/node";
import type { PartialMatrix, ProjectKind } from "@unframework/testing/node";

import { canaryProjects, corrupts, skippedByCapability } from "./canaries.ts";
import type { Canary, CanaryCase, Evidence } from "./canaries.ts";
import type { LoadFailure } from "./load-failures.ts";
import { REFERENCE } from "./targets.ts";

/** One canary run: Vitest's exit status, and what it wrote, if it got that far. */
export interface CanaryRun {
  status: number;
  /** Each project's own cells (its parity matrix's `byProject`): project → case → target → layer. */
  projects: PartialMatrix["byProject"] | undefined;
  /** The specs it could not load. */
  loadFailures?: readonly LoadFailure[] | undefined;
}

/** Whether a canary was caught, every reason it was not, and what was not judged and why. */
export interface CanaryVerdict {
  caught: boolean;
  problems: string[];
  /** The targets the canary corrupts but applies to no case of, which prove nothing. */
  notes: string[];
}

/** The project of a kind that verifies a target: `compile`, or `<kind>:<target>`. */
export function projectOf(kind: ProjectKind, target: string): string {
  return kind === "compile" || kind === "harness" ? kind : `${kind}:${target}`;
}

/** Judges one canary run against the targets it ran on and the corpus. */
export function judgeCanary(
  canary: Canary,
  run: CanaryRun,
  targets: readonly string[],
  cases: readonly CanaryCase[],
): CanaryVerdict {
  const problems: string[] = [];
  const notes: string[] = [];
  if (run.status === 0) problems.push("the run passed");
  const { projects } = run;
  if (!projects) {
    problems.push("the run wrote no parity matrix");
    return { caught: false, problems, notes };
  }
  if (canary.loadEvidence && !run.loadFailures) {
    problems.push("the run wrote no list of the specs it could not load");
    return { caught: false, problems, notes };
  }
  const corrupted = (
    canary.followersOnly ? targets.filter((target) => target !== REFERENCE) : targets
  ).filter((target) => {
    // A canary of one framework's own code corrupts no other target, and runs no other's projects.
    if (!corrupts(canary, target)) return false;
    // A target where the canary applies to no case (Astro, for a canary of the cases whose
    // tests act) has nothing to prove: no case is corrupted there.
    if (!canary.appliesTo || cases.some((info) => canary.appliesTo!(info, target))) return true;
    notes.push(`${target}: not judged, the canary applies to none of its cases`);
    return false;
  });
  if (!corrupted.length) problems.push("the run covered no target the canary corrupts");
  for (const target of corrupted) {
    /** The kinds of project that had a case to judge on this target. */
    const judged = new Set<ProjectKind>();
    for (const info of cases) {
      const kinds = canaryProjects(canary).filter((kind) => verifies(canary, kind, info, target));
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
      for (const kind of kinds.filter((candidate) => candidate in canary.evidence)) {
        const project = projectOf(kind, target);
        const where = `${target} › ${info.id} › ${canary.layer} (${project})`;
        const cell = projects[project]?.[info.id]?.[target]?.[canary.layer];
        if (cell === undefined) {
          problems.push(`${where}: no result, although the canary corrupted the case`);
          continue;
        }
        const outcome = outcomeOfCell(cell);
        // A known failure hides what failed, and a cell every test of which its target skipped
        // by capability ran nothing to corrupt; the other cases must prove the canary.
        if (outcome.status === "quarantined" || skippedByCapability(cell)) continue;
        judged.add(kind);
        if (outcome.status !== "fail") {
          problems.push(`${where}: ${cell}, although the canary corrupted the case`);
          continue;
        }
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
  return { caught: problems.length === 0, problems, notes };
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
 * Whether a kind of project verifies a case on a target under a canary: only the cases the
 * canary applies to. A case with compile errors has no output to corrupt, except for the
 * compile project under a source or fix canary, which corrupts the source or the fixes the
 * case has all the same; the browser projects run only cases with a spec, and prove something
 * only where a test of it runs (the others are skipped by capability). A spec that fails to
 * load is judged where any test would have run.
 */
function verifies(canary: Canary, kind: ProjectKind, info: CanaryCase, target: string): boolean {
  if (canary.appliesTo && !canary.appliesTo(info, target)) return false;
  // A canary that spares the reference spares a case's own reference (ADR-0057).
  if (canary.followersOnly && target === info.reference) return false;
  if (kind === "compile" && (canary.source !== undefined || canary.fixes !== undefined)) {
    return true;
  }
  if (!info.hasOutput(target)) return false;
  if (kind !== "browser") return true;
  return info.spec !== undefined && (kind in (canary.loadEvidence ?? {}) || info.runs(target));
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
