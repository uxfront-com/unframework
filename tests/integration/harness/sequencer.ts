// The harness's test sequencer (ADR-0106): Vitest's own order, with one change. The hydrate
// projects share their pages, so the spec file that leaves a target's page unusable
// (`LEAVES_PAGE_UNUSABLE`) runs after every other file of that target's hydrate project. The spec
// files of an area that changes a target's page (`CHANGES_PAGE`, ADR-0101) run after every other
// file of the target's browser and hydrate projects, before the unusable one. Each page takes its
// next file from its project's queue, in this order, so no other file runs after them on its page.
import { resolve } from "node:path";

import { BaseSequencer } from "vitest/node";
import type { TestSpecification } from "vitest/node";

import type { CaseInfo } from "./cases.ts";
import { CHANGES_PAGE, LEAVES_PAGE_UNUSABLE } from "./projects.ts";

/** What `runLast` reads of a spec: its project's name and its file. */
export interface SequencedSpec {
  project: { name: string };
  moduleId: string;
}

/**
 * The spec files each project runs last, by project name, in the order they run: the specs of
 * the area `CHANGES_PAGE` names for a target, in its browser and hydrate projects, then the spec
 * of the case `LEAVES_PAGE_UNUSABLE` names, in its hydrate project. A listed case that is not in
 * the corpus, or has no spec, and an area with no spec, throw: the lists would otherwise keep
 * nothing last, silently.
 */
export function lastSpecs(
  cases: readonly Pick<CaseInfo, "id" | "spec">[],
  leaves: Readonly<Record<string, { case: string }>> = LEAVES_PAGE_UNUSABLE,
  changes: Readonly<Record<string, { area: string }>> = CHANGES_PAGE,
): Map<string, string[]> {
  const last = new Map<string, string[]>();
  const add = (project: string, specs: readonly string[]) =>
    last.set(project, [...(last.get(project) ?? []), ...specs]);
  for (const [target, entry] of Object.entries(changes)) {
    const specs = cases
      .filter((info) => info.id.startsWith(`${entry.area}/`) && info.spec)
      .map((info) => resolve(info.spec!))
      .sort();
    if (!specs.length) {
      throw new Error(
        `[uf] CHANGES_PAGE names the area ${entry.area} for ${target}, which holds no case with a spec.`,
      );
    }
    add(`browser:${target}`, specs);
    add(`hydrate:${target}`, specs);
  }
  for (const [target, entry] of Object.entries(leaves)) {
    const spec = cases.find((info) => info.id === entry.case)?.spec;
    if (!spec) {
      throw new Error(
        `[uf] LEAVES_PAGE_UNUSABLE names ${entry.case} for ${target}, which is not a case with a spec.`,
      );
    }
    add(`hydrate:${target}`, [resolve(spec)]);
  }
  return last;
}

/**
 * `specs` in the same order, but each project's files that `last` names moved after that
 * project's other files, in `last`'s order. Every other file keeps its place. A project with no
 * other file keeps the named ones where they are.
 */
export function runLast<T extends SequencedSpec>(
  specs: readonly T[],
  last: ReadonlyMap<string, readonly string[]>,
): T[] {
  const rank = (spec: T): number =>
    last.get(spec.project.name)?.indexOf(resolve(spec.moduleId)) ?? -1;
  const runsLast = (spec: T): boolean => rank(spec) >= 0;
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
    if (index === projectEnd) {
      sorted.push(...(held.get(project) ?? []).sort((a, b) => rank(a) - rank(b)));
    }
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
