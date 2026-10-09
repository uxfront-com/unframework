// The cases that name their own reference target in case.json (ADR-0057), one line per target:
// `<target> <case directory>…`, relative to the integration package, for the baseline scripts.
import { relative } from "node:path";

import { listCases } from "../harness/cases.ts";
import { ROOT } from "../harness/paths.ts";

const byTarget = new Map<string, string[]>();
for (const info of listCases()) {
  const { reference } = info.config;
  if (reference === undefined) continue;
  byTarget.set(reference, [...(byTarget.get(reference) ?? []), relative(ROOT, info.dir)]);
}
for (const [target, dirs] of [...byTarget].sort(([a], [b]) => a.localeCompare(b))) {
  process.stdout.write(`${target} ${dirs.join(" ")}\n`);
}
