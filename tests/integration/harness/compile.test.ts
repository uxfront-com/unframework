// The compile project (L1, L2): every case compiled to every target, against its committed
// artefacts, plus the corpus gates: coverage, and no stale shared expectations. In update mode
// (`pnpm test:update`) this project owns and writes `__output__/**` and
// `__expected__/diagnostics.json`, and deletes the shared expectations no case owns.
import { readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { compile, TARGET_NAMES } from "@unframework/compiler";
import type { CompileResult, CompilerPlugin } from "@unframework/compiler";
import { formatDiagnostics, toJsonDiagnostics } from "@unframework/diagnostics";
import type { Diagnostic, JsonDiagnostic } from "@unframework/diagnostics";
import { irSchema } from "@unframework/ir";
import {
  checkLayers,
  NO_OUTPUT_SKIP,
  settleArtefact,
  settleArtefactDirectory,
} from "@unframework/testing/node";
import type { ArtefactContext, LayerCheck, LayerName } from "@unframework/testing/node";
import { Ajv } from "ajv";
import { describe, expect, inject, it } from "vitest";

import { canaryCase, canaryFixes, canaryFormats, canaryPlugins, canarySource } from "./canaries.ts";
import { listCases, removeStaleArtefacts, specProblems, staleArtefacts } from "./cases.ts";
import type { CaseInfo } from "./cases.ts";
import {
  checkFixes,
  expectationProblems,
  formattingProblems,
  forTarget,
  nondeterminism,
} from "./compile-checks.ts";
import { coverageProblems } from "./coverage.ts";
import { ROOT } from "./paths.ts";
import { selectTargets } from "./targets.ts";

const harness = inject("ufHarness");
const cases = listCases(harness.casesDir);
const targets = selectTargets(process.env.UF_TARGETS);
const owner: ArtefactContext = { role: "owner", update: harness.update, root: ROOT };

/** The layers a case with compile errors has nothing to verify at: there is no output. */
const NO_OUTPUT_LAYERS: readonly LayerName[] = [
  "L3",
  "L4",
  "L5",
  "L6",
  "L7",
  "L8",
  "L9",
  "L10",
  "L11",
  "L13",
];

const validateIr = new Ajv({ allErrors: true, strict: true }).compile(irSchema);

/** One compile of a case to every target; each case compiles twice per run (determinism). */
function compileCase(
  info: CaseInfo,
  source: string,
  plugins: readonly CompilerPlugin[],
  format = true,
): Promise<CompileResult> {
  return compile(source, { filename: info.filename, targets: TARGET_NAMES, plugins, format });
}

const memo = new Map<string, Promise<[CompileResult, CompileResult]>>();
/** The case's two compiles, with the run's canary installed (a fresh plugin for each). */
function compiled(info: CaseInfo, source: string): Promise<[CompileResult, CompileResult]> {
  let pending = memo.get(info.id);
  if (!pending) {
    const once = () =>
      compileCase(info, source, canaryPlugins(harness.canary), canaryFormats(harness.canary));
    pending = Promise.all([once(), once()]);
    memo.set(info.id, pending);
  }
  return pending;
}

/** `toJsonDiagnostics` without the documentation URL, which only restates the code. */
function jsonDiagnostics(diagnostics: readonly Diagnostic[], info: CaseInfo, source: string) {
  return toJsonDiagnostics(diagnostics, new Map([[info.filename, source]])).map(
    ({ url: _url, ...diagnostic }) => diagnostic,
  );
}

const hasErrors = (diagnostics: readonly Diagnostic[], target: string) =>
  forTarget(diagnostics, target).some((diagnostic) => diagnostic.severity === "error");

describe("compile", () => {
  for (const info of cases) {
    // What the compile project compiles: the input, or the input a source canary corrupted.
    const source = canarySource(harness.canary, readFileSync(info.source, "utf8"));
    describe(info.id, () => {
      for (const target of targets) {
        it(`${info.id} › ${target}`, async ({ task }) => {
          const [first, second] = await compiled(info, source);
          const checks: Partial<Record<LayerName, LayerCheck>> = {
            L1: () => checkDiagnostics(info, source, first, target),
            L2: () => checkOutputs(info, source, first, second, target),
          };
          if (hasErrors(first.diagnostics, target)) {
            for (const layer of NO_OUTPUT_LAYERS) checks[layer] = () => ({ skip: NO_OUTPUT_SKIP });
          }
          await checkLayers(
            task,
            { case: info.id, target, quarantine: harness.quarantine },
            checks,
          );
        });
      }
    });
  }

  it("covers every IR kind, capability cell and diagnostic code with a case", async () => {
    // Without the canary, so the gate measures the corpus.
    const results = await Promise.all(
      cases.map(async (info) => compileCase(info, readFileSync(info.source, "utf8"), [])),
    );
    const problems = coverageProblems(results);
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("holds specs that follow the spec rules the harness can read", () => {
    const problems = cases.flatMap(specProblems);
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("holds no shared expectation that no case owns", () => {
    if (harness.update) {
      for (const info of cases) removeStaleArtefacts(info);
      return;
    }
    const stale = cases.flatMap((info) =>
      staleArtefacts(info).map((file) => relative(ROOT, join(info.dir, file)).split(sep).join("/")),
    );
    expect(
      stale,
      `Stale artefacts: no test reads them. Run \`pnpm test:update\` to delete them.\n  ${stale.join("\n  ")}`,
    ).toEqual([]);
  });
});

/** L1: the diagnostics equal `__expected__/diagnostics.json`, and their fixes recompile clean. */
async function checkDiagnostics(
  info: CaseInfo,
  source: string,
  result: CompileResult,
  target: string,
): Promise<void> {
  const actual = jsonDiagnostics(result.diagnostics, info, source);
  const path = join(info.dir, "__expected__", "diagnostics.json");
  const outcome = settleArtefact(path, `${JSON.stringify(actual, null, 2)}\n`, owner);
  if (!outcome.pass) {
    if (outcome.status !== "mismatch") throw new Error(outcome.message);
    // The file is target-independent: fail the targets whose own diagnostics differ.
    const expected = JSON.parse(readFileSync(path, "utf8")) as Omit<JsonDiagnostic, "url">[];
    if (JSON.stringify(forTarget(expected, target)) !== JSON.stringify(forTarget(actual, target))) {
      throw new Error(outcome.message);
    }
  }

  // P2: no internal error is an expectation, and a feature case expects only declared errors.
  const problems = expectationProblems(actual, target, info.spec !== undefined);
  if (problems.length) throw new Error(problems.join("\n"));

  // The L1-fix-no-op canary corrupts the fixes here, on the cases whose diagnostics have one.
  await checkFixes(
    source,
    canaryFixes(harness.canary, canaryCase(info), target, source, result.diagnostics),
    target,
    async (fixed) => (await compileCase(info, fixed, [])).diagnostics,
  );
}

/**
 * L2: the IR snapshot (schema-valid), the target's golden files (exactly the compiler's files),
 * diagnostics.txt for a case with errors, determinism, and formatting idempotence.
 */
async function checkOutputs(
  info: CaseInfo,
  source: string,
  first: CompileResult,
  second: CompileResult,
  target: string,
): Promise<void> {
  const problems: string[] = [];
  const output = join(info.dir, "__output__");
  const settle = (outcome: { pass: boolean; message: string }) => {
    if (!outcome.pass) problems.push(outcome.message);
  };

  settle(
    settleArtefact(
      join(output, "ir.json"),
      first.ir ? `${JSON.stringify(first.ir, null, 2)}\n` : undefined,
      owner,
    ),
  );
  if (first.ir && !validateIr(first.ir)) {
    problems.push(
      `The IR does not validate against irSchema:\n${(validateIr.errors ?? [])
        .map((error) => `  ${error.instancePath || "/"} ${error.message ?? ""}`)
        .join("\n")}`,
    );
  }

  const errors = first.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  settle(
    settleArtefact(
      join(output, "diagnostics.txt"),
      errors.length
        ? `${formatDiagnostics(first.diagnostics, { [info.filename]: source })}\n`
        : undefined,
      owner,
    ),
  );

  const files = first.outputs[target] ?? [];
  settle(
    settleArtefactDirectory(
      join(output, target),
      new Map(files.map((file) => [file.path, file.contents])),
      {
        update: harness.update,
        root: ROOT,
      },
    ),
  );

  // P8: the same input and versions give byte-identical, formatted output.
  const different = nondeterminism(first, second, target);
  if (different) problems.push(different);
  problems.push(...(await formattingProblems(target, files)));

  if (problems.length) throw new Error(problems.join("\n\n"));
}
