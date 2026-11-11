// The bench project (L15, ADR-0078): every case's compile time and every target's output size,
// against `budgets.json`. It measures once, in beforeAll, then gives one test per cell. It stays
// out of the default run (`harnessProjects`), since twenty iterations per case would slow every
// `pnpm test`. A canary's fresh compile is what's measured under one, and a canary of some cases
// measures only those, beside the case every time is a ratio of.
import type { TargetName } from "@unframework.dev/compiler";
import { checkLayers, NO_OUTPUT_SKIP } from "@unframework.dev/testing/node";
import { beforeAll, describe, expect, inject, it } from "vitest";

import {
  budgetedCases,
  budgetProblems,
  CALIBRATION,
  measureSize,
  measureTimes,
  readBudgets,
  staleBudgets,
} from "../scripts/budgets.ts";
import type { Budgets, OutputSize } from "../scripts/budgets.ts";
import { canaryCase, canaryPlugins, findCanary } from "./canaries.ts";
import { errorState, listCases } from "./cases.ts";
import "./context.ts";
import { outputFiles } from "./output-files.ts";
import { loadToolchain, selectTargets } from "./targets.ts";

const harness = inject("ufHarness");
const targets = selectTargets(process.env.UF_TARGETS);
const canary = harness.canary ? findCanary(harness.canary) : undefined;
const corpus = listCases(harness.casesDir);
const cases = canary?.appliesTo
  ? corpus.filter(
      (info) =>
        info.id === CALIBRATION ||
        targets.some((target) => canary.appliesTo!(canaryCase(info), target)),
    )
  : corpus;
const timed = !canary || "compile time" in (canary.evidence.bench ?? {});

let budgets: Budgets;
let times: Map<string, number>;
/** Why nothing could be measured: every cell fails with it, as a check that cannot start does. */
let failure: Error | undefined;
/** Each cell's size, or why it could not be measured: that cell's alone to fail. */
const sizes = new Map<string, OutputSize | Error>();
const cell = (id: string, target: string) => `${id} › ${target}`;
const asError = (error: unknown) => (error instanceof Error ? error : new Error(String(error)));

/** Measures a target's cells. A toolchain that cannot start fails only that target's. */
async function measureTarget(target: string): Promise<void> {
  const owed = cases.filter((info) => errorState(info, target) === false);
  try {
    const toolchain = await loadToolchain(target);
    const files = await outputFiles(owed, target, harness.casesDir, harness.canary);
    for (const info of owed) {
      const size = measureSize(toolchain, target, files.get(info.id) ?? []);
      sizes.set(cell(info.id, target), await size.catch(asError));
    }
  } catch (error) {
    for (const info of owed) sizes.set(cell(info.id, target), asError(error));
  }
}

beforeAll(async () => {
  try {
    budgets = readBudgets();
    // First and alone: nothing else in this process competes with the timed iterations. A canary
    // of the sizes alone skips them, and passes every time: they'd take most of its CI job's
    // ten minutes to prove nothing about it.
    times = timed
      ? await measureTimes(budgetedCases(cases), harness.casesDir, () =>
          canaryPlugins(harness.canary),
        )
      : new Map();
    for (const target of targets) await measureTarget(target);
  } catch (error) {
    failure = asError(error);
  }
});

describe("bench", () => {
  for (const info of cases) {
    for (const target of targets) {
      it(cell(info.id, target), async ({ task }) => {
        const errors = errorState(info, target);
        if (errors instanceof Error) throw errors;
        await checkLayers(
          task,
          { case: info.id, target, quarantine: harness.quarantine },
          {
            L15: () => {
              if (errors) return { skip: NO_OUTPUT_SKIP };
              if (failure) throw failure;
              const size = sizes.get(cell(info.id, target));
              if (size instanceof Error) throw size;
              const problems = budgetProblems(
                budgets.cases[info.id],
                target as TargetName,
                times.get(info.id) ?? 0,
                size!,
              );
              if (problems.length) throw new Error(problems.join("\n"));
              return undefined;
            },
          },
        );
      });
    }
  }

  it("holds a budget for no case or target that has no cell", () => {
    if (failure) throw failure;
    const stale = staleBudgets(budgets, budgetedCases(corpus));
    expect(stale, "Stale budgets: run `pnpm test:budgets:update`.").toEqual([]);
  });
});
