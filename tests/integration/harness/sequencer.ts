// The harness's test sequencer (ADR-0106): Vitest's own order, with one change. The hydrate
// projects share their pages, so the spec file that leaves a target's page unusable
// (`LEAVES_PAGE_UNUSABLE`) runs after every other file of that target's hydrate project. Each
// page takes its next file from its project's queue, in this order, so no file runs after the
// unusable one on its page.
import { resolve } from "node:path";

import { BaseSequencer } from "vitest/node";
import type { TestSpecification } from "vitest/node";

import type { CaseInfo } from "./cases.ts";
import { LEAVES_PAGE_UNUSABLE } from "./projects.ts";

/** What `runLast` reads of a spec: its project's name and its file. */
export interface SequencedSpec {
  project: { name: string };
  moduleId: string;
}

/**
 * The spec file each hydrate project runs last, by project name: the spec of the case
 * `LEAVES_PAGE_UNUSABLE` names for the project's target. A listed case that is not in the corpus,
 * or has no spec, throws: the list would otherwise keep nothing last, silently.
 */
export function lastSpecs(
  cases: readonly Pick<CaseInfo, "id" | "spec">[],
  leaves: Readonly<Record<string, { case: string }>> = LEAVES_PAGE_UNUSABLE,
): Map<string, string> {
  const last = new Map<string, string>();
  for (const [target, entry] of Object.entries(leaves)) {
    const spec = cases.find((info) => info.id === entry.case)?.spec;
    if (!spec) {
      throw new Error(
        `[uf] LEAVES_PAGE_UNUSABLE names ${entry.case} for ${target}, which is not a case with a spec.`,
      );
    }
    last.set(`hydrate:${target}`, resolve(spec));
  }
  return last;
}

/**
 * `specs` in the same order, but each project's file that `last` names moved after that project's
 * other files. Every other file keeps its place. A project with no other file keeps the named one
 * where it is.
 */
export function runLast<T extends SequencedSpec>(
  specs: readonly T[],
  last: ReadonlyMap<string, string>,
): T[] {
  const runsLast = (spec: T): boolean => last.get(spec.project.name) === resolve(spec.moduleId);
  // Where each project's last file that is not held back sits.
  const end = new Map<string, number>();
  specs.forEach((spec, index) => {
    if (!runsLast(spec)) end.set(spec.project.name, index);
  });
  const held = new Map<string, T[]>();
  const sorted: T[] = [];
  specs.forEach((spec, index) => {
    const project = spec.project.name;
    const projectEnd = end.get(project);
    if (runsLast(spec) && projectEnd !== undefined && projectEnd > index) {
      held.set(project, [...(held.get(project) ?? []), spec]);
    } else {
      sorted.push(spec);
    }
    if (index === projectEnd) sorted.push(...(held.get(project) ?? []));
  });
  return sorted;
}

/** The sequencer `vitest.config.ts` sets: `BaseSequencer`'s order, then `runLast`. */
export function harnessSequencer(
  cases: readonly Pick<CaseInfo, "id" | "spec">[],
): typeof BaseSequencer {
  const last = lastSpecs(cases);
  return class HarnessSequencer extends BaseSequencer {
    override async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
      return runLast(await super.sort(files), last);
    }
  };
}
