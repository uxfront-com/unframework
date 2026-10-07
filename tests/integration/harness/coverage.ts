// The coverage gate (plan §7.7), derived from the corpus: every IR kind the gate's records list
// (render nodes, attributes, bindings, setup items, handlers, watch sources and the references
// of setup code), every native or emulated capability cell of every target, and every
// catalogued diagnostic code has a case, or an exemption with a reason. An exemption the corpus
// covers is a problem, so the exemption lists only shrink. Plain functions, so
// `coverage.unit.test.ts` can prove the gate fails on a missing kind; the compile project runs
// them on the corpus.
import { CAPABILITY_NAMES } from "@unframework/codegen";
import { builtinTargets, requiredCapabilities, TARGET_NAMES } from "@unframework/compiler";
import type { CompileResult } from "@unframework/compiler";
import { catalogue } from "@unframework/diagnostics";
import type { Diagnostic } from "@unframework/diagnostics";
import {
  ATTRIBUTE_KINDS,
  BINDING_KINDS,
  CODE_REFERENCE_KINDS,
  collectFeatures,
  HANDLER_KINDS,
  RENDER_NODE_KINDS,
  SETUP_ITEM_KINDS,
  WATCH_SOURCE_KINDS,
} from "@unframework/ir";
import type { ModuleFeatures } from "@unframework/ir";

import { forTarget } from "./compile-checks.ts";
import { EXEMPT_CAPABILITIES, EXEMPT_CODES, EXEMPT_KINDS } from "./coverage-exemptions.ts";
import type { KindFamily } from "./coverage-exemptions.ts";

/** One family of IR kinds the gate requires a case for: its record and its features' set. */
interface KindRecord {
  family: KindFamily;
  kinds: readonly string[];
  features: keyof ModuleFeatures;
}

/**
 * The IR's coverage-gate records (`@unframework/ir`'s `visit.ts`), each read from the features
 * `collectFeatures` collects. A root fragment is no render node: the `fragment` capability
 * covers it.
 */
export const KIND_RECORDS: readonly KindRecord[] = [
  { family: "node", kinds: RENDER_NODE_KINDS, features: "nodeKinds" },
  { family: "attribute", kinds: ATTRIBUTE_KINDS, features: "attributeKinds" },
  { family: "binding", kinds: BINDING_KINDS, features: "bindingKinds" },
  { family: "setup item", kinds: SETUP_ITEM_KINDS, features: "setupItemKinds" },
  { family: "handler", kinds: HANDLER_KINDS, features: "handlerKinds" },
  { family: "watch source", kinds: WATCH_SOURCE_KINDS, features: "watchSourceKinds" },
  { family: "code reference", kinds: CODE_REFERENCE_KINDS, features: "codeReferenceKinds" },
];

/** What the gate reads of one case's compile to every target. */
export type CoveredCompile = Pick<CompileResult, "ir" | "diagnostics" | "outputs">;

/**
 * Every problem of the coverage gate over the corpus's compiles (each case compiled to every
 * target, without a canary, so it measures the corpus).
 */
export function coverageProblems(results: readonly CoveredCompile[]): string[] {
  const features: ModuleFeatures[] = [];
  const codes = new Set<string>();
  const cells = new Set<string>();
  for (const result of results) {
    for (const diagnostic of result.diagnostics) codes.add(diagnostic.code);
    if (!result.ir) continue;
    features.push(collectFeatures(result.ir));
    const capabilities = [...requiredCapabilities(result.ir).keys()];
    for (const target of TARGET_NAMES) {
      if (hasErrors(result.diagnostics, target) || !result.outputs[target]?.length) continue;
      for (const capability of capabilities) cells.add(`${target}:${capability}`);
    }
  }
  return [...kindProblems(features), ...capabilityProblems(cells), ...codeProblems(codes)];
}

/**
 * The IR kinds no case has and no exemption excuses, the exemptions a case covers, and the
 * exemptions that name no kind of their family.
 */
export function kindProblems(
  features: readonly ModuleFeatures[],
  exemptions: Readonly<
    Partial<Record<KindFamily, Readonly<Record<string, string>>>>
  > = EXEMPT_KINDS,
): string[] {
  const problems: string[] = [];
  for (const record of KIND_RECORDS) {
    const used = new Set<string>(features.flatMap((each) => [...each[record.features]]));
    const exempt = exemptions[record.family] ?? {};
    for (const [kind, reason] of Object.entries(exempt)) {
      if (!record.kinds.includes(kind)) {
        problems.push(`The exemption for ${kind} names no ${record.family} kind (${reason}).`);
      }
    }
    for (const kind of record.kinds) {
      const covered = used.has(kind);
      if (covered && exempt[kind] !== undefined) {
        problems.push(
          `A case covers the ${record.family} kind ${kind} now: remove its coverage exemption.`,
        );
      } else if (!covered && exempt[kind] === undefined) {
        problems.push(`No case covers the ${record.family} kind ${kind}.`);
      }
    }
  }
  return problems;
}

/** The native or emulated capability cells no case covers and no exemption excuses. */
function capabilityProblems(cells: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  const names: readonly string[] = CAPABILITY_NAMES;
  for (const [capability, reason] of Object.entries(EXEMPT_CAPABILITIES)) {
    if (!names.includes(capability)) {
      problems.push(`The exemption for "${capability}" names no capability (${reason}).`);
    }
  }
  for (const target of TARGET_NAMES) {
    for (const capability of CAPABILITY_NAMES) {
      const cell = builtinTargets[target].capabilities[capability];
      if (cell.support === "unsupported") continue;
      const covered = cells.has(`${target}:${capability}`);
      const exempt = EXEMPT_CAPABILITIES[capability];
      if (covered && exempt) {
        problems.push(`${target} › ${capability} has a case now: remove its coverage exemption.`);
      } else if (!covered && !exempt) {
        problems.push(`No case covers ${target} › ${capability} (${cell.support}).`);
      }
    }
  }
  return problems;
}

/** The catalogued codes no case triggers and no exemption excuses. */
function codeProblems(codes: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  const catalogued: ReadonlyMap<string, unknown> = catalogue;
  for (const code of Object.keys(EXEMPT_CODES)) {
    if (!catalogued.has(code)) problems.push(`The exemption for ${code} names no catalogued code.`);
  }
  for (const code of catalogue.keys()) {
    const covered = codes.has(code);
    const exempt = EXEMPT_CODES[code];
    if (covered && exempt)
      problems.push(`A case triggers ${code} now: remove its coverage exemption.`);
    else if (!covered && !exempt) problems.push(`No case triggers ${code}.`);
  }
  return problems;
}

const hasErrors = (diagnostics: readonly Diagnostic[], target: string) =>
  forTarget(diagnostics, target).some((diagnostic) => diagnostic.severity === "error");
