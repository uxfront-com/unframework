// The cases that name their own reference target (ADR-0057), as the runs that serve them read
// them: the SSR project of a target the run adds only for those cases, and the baseline script's
// pass of each such target (`scripts/references.ts`).
import { relative, resolve, sep } from "node:path";

import type { CaseInfo } from "./cases.ts";
import { ROOT } from "./paths.ts";

/** The cases a project renders: every one, or those `only` names (`ufOnly`). */
export function onlyCases<T extends Pick<CaseInfo, "id">>(
  cases: readonly T[],
  only: readonly string[] | undefined,
): T[] {
  return only ? cases.filter((info) => only.includes(info.id)) : [...cases];
}

/**
 * The Vitest options whose value is the next argument. Any other argument that does not start
 * with `-` is a file filter, as Vitest reads it.
 */
const VALUED_OPTIONS: ReadonlySet<string> = new Set([
  "-t",
  "--testNamePattern",
  "-p",
  "--project",
  "--maxWorkers",
  "--minWorkers",
  "--shard",
  "--reporter",
  "--outputFile",
  "--testTimeout",
  "--hookTimeout",
  "--retry",
  "--bail",
  "--exclude",
]);

/** One target's baseline pass: the arguments `scripts/run.ts` takes after its project. */
export interface ReferencePass {
  target: string;
  args: string[];
}

/**
 * The baseline passes of the targets cases name as their reference (ADR-0057), each on its cases
 * alone, with the caller's arguments: its options as given (but `--project`, which the pass sets
 * itself), and its file filters as Vitest applies them, a spec whose path contains one. A target
 * none of whose specs a filter selects has no pass.
 */
export function referencePasses(
  cases: readonly Pick<CaseInfo, "spec" | "config">[],
  argv: readonly string[],
): ReferencePass[] {
  const options: string[] = [];
  const filters: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    const name = arg.split("=")[0]!;
    const project = name === "--project" || name === "-p";
    const valued = VALUED_OPTIONS.has(arg) && index + 1 < argv.length;
    if (!arg.startsWith("-")) filters.push(arg);
    else if (!project) options.push(arg, ...(valued ? [argv[index + 1]!] : []));
    if (valued) index += 1;
  }
  const specs = new Map<string, string[]>();
  for (const info of cases) {
    const { reference } = info.config;
    if (reference === undefined || !info.spec) continue;
    const spec = relative(ROOT, info.spec).split(sep).join("/");
    const absolute = resolve(ROOT, spec);
    if (filters.length && !filters.some((each) => spec.includes(each) || absolute.includes(each))) {
      continue;
    }
    specs.set(reference, [...(specs.get(reference) ?? []), spec]);
  }
  return [...specs]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([target, selected]) => ({ target, args: [...options, ...selected] }));
}
