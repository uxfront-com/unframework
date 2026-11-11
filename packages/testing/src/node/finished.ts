// Which case spec files each browser project finished in this run (ADR-0091). The setup file
// reports a file once its last afterAll hook has run, through `ufSpecFinished`. A follower whose
// reference has no capture of a scenario then tells "the reference never finished this case"
// (its browser connection closed, and Vitest dropped the rest of its queue) from "the reference
// ran it and captured no such scenario". Commands run in Vitest's main process, so every browser
// project of a run shares this record, as they share the reference's captures.
import type { SpecFinishedRequest } from "../commands.ts";
import { caseDirectory, projectHarness } from "./context.ts";
import type { CommandProject } from "./context.ts";

const STATE = Symbol.for("unframework.visual.finished");

/** Run id and target → the cases whose spec file that target's browser project finished. */
function finished(): Map<string, Set<string>> {
  const store = globalThis as { [STATE]?: Map<string, Set<string>> };
  return (store[STATE] ??= new Map());
}

const keyOf = (runId: string, target: string) => `${runId}:${target}`;

/**
 * `ufSpecFinished`: records that the calling project finished a case's spec file. The setup
 * file calls it from an `aroundAll` hook after the file's tests and its afterAll hooks, so it
 * resolves before the file ends, and so before any later `sequence.groupOrder` group starts.
 */
export function ufSpecFinished(context: CommandProject, request: SpecFinishedRequest): void {
  const { target, harness } = projectHarness(context);
  caseDirectory(harness, request.case);
  const key = keyOf(harness.runId, target);
  const cases = finished().get(key) ?? new Set<string>();
  cases.add(request.case);
  finished().set(key, cases);
}

/** Whether a target's browser project finished a case's spec file in a run. */
export function specFinished(runId: string, target: string, caseId: string): boolean {
  return finished().get(keyOf(runId, target))?.has(caseId) ?? false;
}
