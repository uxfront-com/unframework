// `pnpm test:canaries` (plan §7.7): runs each canary against the projects that verify its layer,
// with UF_CANARY=<id>, and fails unless the run failed and the layer caught the canary on every
// case and target it corrupts, in every sub-check the canary names (harness/canary-verdict.ts).
// Each run's parity matrix, the specs it could not load and its log go to `.canary/<id>/`.
//
//   pnpm test:canaries                    every canary
//   pnpm test:canaries L7-wrong-text …    some of them
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import type { ParityMatrix, ProjectKind } from "@unframework/testing/node";

import { canaryProjects, CANARIES, findCanary } from "../harness/canaries.ts";
import type { Canary } from "../harness/canaries.ts";
import { judgeCanary } from "../harness/canary-verdict.ts";
import type { CanaryCase, CanaryVerdict } from "../harness/canary-verdict.ts";
import { errorState, listCases } from "../harness/cases.ts";
import { LOAD_FAILURES, readLoadFailures } from "../harness/load-failures.ts";
import { CANARY_DIR, ROOT } from "../harness/paths.ts";
import { selectTargets } from "../harness/targets.ts";
import { runVitest } from "./vitest.ts";

const PROJECTS: Record<ProjectKind, string> = {
  compile: "compile",
  harness: "harness",
  toolchain: "toolchain:*",
  ssr: "ssr:*",
  browser: "browser:*",
};

/** Runs one canary and judges whether its layer caught it everywhere it should. */
function runCanary(
  canary: Canary,
  targets: readonly string[],
  cases: readonly CanaryCase[],
): CanaryVerdict & { log: string } {
  const directory = join(CANARY_DIR, canary.id);
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  const env: NodeJS.ProcessEnv = { ...process.env, UF_CANARY: canary.id };
  delete env.UF_UPDATE;
  const args = canaryProjects(canary).flatMap((kind) => ["--project", PROJECTS[kind]]);
  const { status, stdout } = runVitest(args, env, "pipe");
  const log = join(directory, "vitest.log");
  writeFileSync(log, stdout);
  const matrixFile = join(directory, "parity-matrix.json");
  const matrix = existsSync(matrixFile)
    ? (JSON.parse(readFileSync(matrixFile, "utf8")) as ParityMatrix)
    : undefined;
  const loadFailures = readLoadFailures(join(directory, LOAD_FAILURES));
  return {
    ...judgeCanary(canary, { status, cells: matrix?.cases, loadFailures }, targets, cases),
    log,
  };
}

function main(): number {
  const requested = process.argv.slice(2).filter((arg) => arg !== "--");
  const canaries = requested.length ? requested.map(findCanary) : CANARIES;
  const targets = selectTargets(process.env.UF_TARGETS);
  const cases: CanaryCase[] = listCases().map((info) => ({
    id: info.id,
    hasOutput: (target) => errorState(info, target) === false,
    spec: info.spec && relative(ROOT, info.spec).split(sep).join("/"),
  }));
  const print = (line: string) => process.stdout.write(`${line}\n`);
  const missed: string[] = [];
  for (const canary of canaries) {
    const verdict = runCanary(canary, targets, cases);
    print(
      `[uf:canaries] ${canary.id} (${canary.layer}, ${canaryProjects(canary).join(" + ")}): ${verdict.caught ? "caught" : "NOT CAUGHT"}`,
    );
    for (const problem of verdict.problems) print(`    ${problem}`);
    if (!verdict.caught) {
      print(`    log: ${relative(ROOT, verdict.log)}`);
      missed.push(canary.id);
    }
  }
  print(
    missed.length
      ? `[uf:canaries] ${missed.length} of ${canaries.length} canaries were not caught: ${missed.join(", ")}. Logs and matrices: ${relative(ROOT, CANARY_DIR)}/<id>/.`
      : `[uf:canaries] All ${canaries.length} canaries were caught on every case and target they corrupt (${targets.join(", ")}).`,
  );
  return missed.length ? 1 : 0;
}

process.exitCode = main();
