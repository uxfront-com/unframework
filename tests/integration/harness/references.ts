// The cases that name their own reference target (ADR-0057), as the runs that serve them read
// them: the SSR project of a target the run adds only for those cases, and the baseline script's
// pass of each such target (`scripts/references.ts`).
import type { CaseInfo } from "./cases.ts";

/** The cases a project renders: every one, or those `only` names (`ufOnly`). */
export function onlyCases<T extends Pick<CaseInfo, "id">>(
  cases: readonly T[],
  only: readonly string[] | undefined,
): T[] {
  return only ? cases.filter((info) => only.includes(info.id)) : [...cases];
}

/** One target's baseline pass: the arguments `scripts/run.ts` takes after its project. */
export interface ReferencePass {
  target: string;
  args: string[];
}

/**
 * The baseline passes of the targets cases name as their reference (ADR-0057), each with the
 * caller's arguments as given, but `--project`, which the pass sets itself. UF_REFERENCE_PASS
 * keeps each target to its cases (`referencesOnly` in projects.ts), and Vitest applies the
 * caller's file filters and options.
 */
export function referencePasses(
  cases: readonly Pick<CaseInfo, "config">[],
  argv: readonly string[],
): ReferencePass[] {
  const args: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === "--project" || arg === "-p") index += 1;
    else if (!arg.startsWith("--project=") && !arg.startsWith("-p=")) args.push(arg);
  }
  const targets = new Set(cases.flatMap(({ config }) => config.reference ?? []));
  return [...targets].sort().map((target) => ({ target, args: [...args] }));
}
