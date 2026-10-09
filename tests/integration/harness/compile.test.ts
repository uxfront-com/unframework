// The compile project (L1, L2): every source of every case compiled to every target, against its
// committed artefacts, plus the corpus gates: coverage, and no stale shared expectations. A case
// of several sources (ADR-0057) has one IR snapshot per source, and its diagnostics and golden
// files join every source's. In update mode
// (`pnpm test:update`) this project owns and writes `__output__/**` and
// `__expected__/diagnostics.json`, and deletes the shared expectations no case owns.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { compile, TARGET_NAMES } from "@unframework/compiler";
import type { CompileResult, CompilerPlugin } from "@unframework/compiler";
import { formatDiagnostics, toJsonDiagnostics } from "@unframework/diagnostics";
import type { Diagnostic, JsonDiagnostic } from "@unframework/diagnostics";
import { irSchema } from "@unframework/ir";
import {
  checkLayers,
  diffLines,
  NO_OUTPUT_SKIP,
  settleArtefact,
  settleArtefactDirectory,
} from "@unframework/testing/node";
import type { ArtefactContext, LayerCheck, LayerName } from "@unframework/testing/node";
import { Ajv } from "ajv";
import { describe, expect, inject, it } from "vitest";

import { canaryCase, canaryFixes, canaryFormats, canaryPlugins, canarySource } from "./canaries.ts";
import { listCases, removeStaleArtefacts, specProblems, staleArtefacts } from "./cases.ts";
import type { CaseInfo, CaseSource } from "./cases.ts";
import {
  checkFixes,
  expectationProblems,
  formattingProblems,
  forTarget,
  nondeterminism,
  referenceProblems,
} from "./compile-checks.ts";
import { coverageProblems } from "./coverage.ts";
import { ROOT } from "./paths.ts";
import { caseDiagnostics, caseOutputs, caseResolver, sourceTexts } from "./sources.ts";
import type { SourceCompile } from "./sources.ts";
import { REFERENCE, selectTargets } from "./targets.ts";

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

/**
 * One compile of a source to every target, its children resolved in its case (ADR-0057); each
 * compiles twice per run (determinism).
 */
function compileSource(
  info: CaseInfo,
  source: CaseSource,
  text: string,
  plugins: readonly CompilerPlugin[],
  format = true,
): Promise<CompileResult> {
  return compile(text, {
    filename: source.filename,
    targets: TARGET_NAMES,
    plugins,
    format,
    resolve: caseResolver(info, harness.casesDir),
  });
}

/** A source of a case and its two compiles. */
interface CompiledSource {
  source: CaseSource;
  /** What the compile project compiles: the input, or the input a source canary corrupted. */
  text: string;
  first: CompileResult;
  second: CompileResult;
}

const memo = new Map<string, Promise<CompiledSource[]>>();
/** Each source's two compiles, with the run's canary installed (a fresh plugin for each). */
function compiled(info: CaseInfo): Promise<CompiledSource[]> {
  let pending = memo.get(info.id);
  if (!pending) {
    pending = Promise.all(
      info.sources.map(async (source) => {
        const text = canarySource(harness.canary, readFileSync(source.source, "utf8"));
        const once = () =>
          compileSource(
            info,
            source,
            text,
            canaryPlugins(harness.canary),
            canaryFormats(harness.canary),
          );
        const [first, second] = await Promise.all([once(), once()]);
        return { source, text, first, second };
      }),
    );
    memo.set(info.id, pending);
  }
  return pending;
}

/** The first compile of each source, as the case's artefacts join them. */
const firsts = (compiles: readonly CompiledSource[]): SourceCompile[] =>
  compiles.map(({ source, text, first }) => ({ source, text, result: first }));

/** `toJsonDiagnostics` without the documentation URL, which only restates the code. */
function jsonDiagnostics(diagnostics: readonly Diagnostic[], texts: ReadonlyMap<string, string>) {
  return toJsonDiagnostics(diagnostics, texts).map(({ url: _url, ...diagnostic }) => diagnostic);
}

const hasErrors = (diagnostics: readonly Diagnostic[], target: string) =>
  forTarget(diagnostics, target).some((diagnostic) => diagnostic.severity === "error");

describe("compile", () => {
  for (const info of cases) {
    describe(info.id, () => {
      for (const target of targets) {
        it(`${info.id} › ${target}`, async ({ task }) => {
          const compiles = await compiled(info);
          const checks: Partial<Record<LayerName, LayerCheck>> = {
            L1: () => checkDiagnostics(info, compiles, target),
            L2: () => checkOutputs(info, compiles, target),
          };
          if (hasErrors(caseDiagnostics(firsts(compiles)), target)) {
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
      cases.flatMap((info) =>
        info.sources.map((source) =>
          compileSource(info, source, readFileSync(source.source, "utf8"), []),
        ),
      ),
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

/**
 * L1: every source's diagnostics equal `__expected__/diagnostics.json`, and each source's fixes
 * recompile it clean.
 */
async function checkDiagnostics(
  info: CaseInfo,
  compiles: readonly CompiledSource[],
  target: string,
): Promise<void> {
  const joined = firsts(compiles);
  const actual = jsonDiagnostics(caseDiagnostics(joined), sourceTexts(joined));
  const path = join(info.dir, "__expected__", "diagnostics.json");
  const outcome = settleArtefact(path, `${JSON.stringify(actual, null, 2)}\n`, owner);
  if (!outcome.pass) {
    if (outcome.status !== "mismatch") throw new Error(outcome.message);
    // The file is target-independent: fail the targets whose own diagnostics differ, with the
    // difference in theirs, which every other target's would bury in a case of several.
    const expected = JSON.parse(readFileSync(path, "utf8")) as Omit<JsonDiagnostic, "url">[];
    const own = (list: readonly Omit<JsonDiagnostic, "url">[]) =>
      `${JSON.stringify(forTarget(list, target), null, 2)}\n`;
    if (own(expected) !== own(actual)) {
      const file = relative(ROOT, path).split(sep).join("/");
      throw new Error(
        `${file} differs from this run's output on ${target}:\n${diffLines(own(expected), own(actual))}\n\nRun \`pnpm test:update\` and review the diff if the change is intended.`,
      );
    }
  }

  // P2: no internal error is an expectation, and a feature case expects only declared errors.
  // The case's own reference (ADR-0057) is judged on the L1 cell of the target that writes its
  // expectations.
  const problems = [
    ...expectationProblems(actual, target, info.spec !== undefined),
    ...(target === (info.config.reference ?? REFERENCE)
      ? referenceProblems(actual, info.spec !== undefined, REFERENCE, info.config.reference)
      : []),
  ];
  if (problems.length) throw new Error(problems.join("\n"));

  // The L1-fix-no-op canary corrupts the fixes here, on the cases whose diagnostics have one.
  for (const { source, text, first } of compiles) {
    await checkFixes(
      text,
      canaryFixes(harness.canary, canaryCase(info), target, text, first.diagnostics),
      target,
      async (fixed) => (await compileSource(info, source, fixed, [])).diagnostics,
    );
  }
}

/**
 * L2: each source's IR snapshot (schema-valid), the target's golden files (exactly the files of
 * every source's compile), diagnostics.txt for a case with errors, determinism, and formatting
 * idempotence.
 */
async function checkOutputs(
  info: CaseInfo,
  compiles: readonly CompiledSource[],
  target: string,
): Promise<void> {
  const problems: string[] = [];
  const output = join(info.dir, "__output__");
  const settle = (outcome: { pass: boolean; message: string }) => {
    if (!outcome.pass) problems.push(outcome.message);
  };

  for (const { source, first } of compiles) {
    settle(
      settleArtefact(
        join(output, source.ir),
        first.ir ? `${JSON.stringify(first.ir, null, 2)}\n` : undefined,
        owner,
      ),
    );
    if (first.ir && !validateIr(first.ir)) {
      problems.push(
        `The IR of ${source.filename} does not validate against irSchema:\n${(
          validateIr.errors ?? []
        )
          .map((error) => `  ${error.instancePath || "/"} ${error.message ?? ""}`)
          .join("\n")}`,
      );
    }
  }
  // The snapshot of a source the case no longer holds is stale, like any other artefact.
  const snapshots = new Set(info.sources.map((source) => source.ir));
  const stale = existsSync(output)
    ? readdirSync(output).filter((file) => /^ir\..+\.json$/.test(file) && !snapshots.has(file))
    : [];
  for (const file of stale) settle(settleArtefact(join(output, file), undefined, owner));

  const joined = firsts(compiles);
  const diagnostics = caseDiagnostics(joined);
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  settle(
    settleArtefact(
      join(output, "diagnostics.txt"),
      errors.length ? `${formatDiagnostics(diagnostics, sourceTexts(joined))}\n` : undefined,
      owner,
    ),
  );

  const { files, problems: collisions } = caseOutputs(joined, target);
  problems.push(...collisions);
  settle(
    settleArtefactDirectory(join(output, target), files, {
      update: harness.update,
      root: ROOT,
    }),
  );

  // P8: the same input and versions give byte-identical, formatted output.
  for (const { first, second } of compiles) {
    const different = nondeterminism(first, second, target);
    if (different) problems.push(different);
    problems.push(...(await formattingProblems(target, first.outputs[target] ?? [])));
  }

  if (problems.length) throw new Error(problems.join("\n\n"));
}
