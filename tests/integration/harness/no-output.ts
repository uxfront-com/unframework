// The browser projects' stand-ins for the components a target has no output for (ADR-0050). A
// feature case may expect an error for a target: the one that target declares for a capability
// it lacks (ADR-0033, L1 refuses any other). The compile project then records the target's later
// layers as skipped (no output), and the toolchain and ssr projects leave the case out. The
// browser project still loads the spec, because the summary compares each target's tests with
// the reference's: its import of the component gets a stand-in here instead of a compile that
// fails, so the spec loads, and the setup skips each of its tests on that target with the
// errors the case expects (`no output: …`, a mechanical cause the summary excuses there alone).
// The stand-in throws them if anything renders it.
//
// A target may also have output it cannot compile yet: a case whose L3 is quarantined there,
// where the target's browser build type-checks its output, so the component's own module would
// fail its spec's import and record no cell to quarantine. Its spec loads the same stand-in, but
// its tests are not skipped: the setup records every browser layer as failed with the stand-in's
// cause, so the case's browser entries quarantine real failures, and go stale once the target
// compiles the case and the L3 entry goes (ADR-0068, amending ADR-0050).
import { dirname, resolve } from "node:path";

import type { QuarantineEntry } from "@unframework/testing/node";
import type { Plugin } from "vite";

import { errorState, expectedDiagnostics } from "./cases.ts";
import type { CaseInfo } from "./cases.ts";

/** The prefix of a stand-in's module id: Vite's dependency scan never loads an id with `\0`. */
export const NO_OUTPUT_PREFIX = "\0uf-no-output:";

/**
 * The cases with a spec that a target has no output for, by its committed expected diagnostics
 * (as the toolchain and ssr projects judge it, `errorState`), by id: each with the errors it
 * expects for the target, `UF4001 (<message>)`, which the setup's skip reason quotes.
 */
export function noOutputCases(cases: readonly CaseInfo[], target: string): Record<string, string> {
  const found: Record<string, string> = {};
  for (const info of cases) {
    if (!info.spec || errorState(info, target) !== true) continue;
    const errors = (expectedDiagnostics(info) ?? []).filter(
      (diagnostic) =>
        diagnostic.severity === "error" &&
        (diagnostic.target === undefined || diagnostic.target === target),
    );
    found[info.id] = errors.map((error) => `${error.code} (${error.message})`).join("; ");
  }
  return found;
}

/**
 * The targets whose browser build type-checks its output, so a component that fails L3 fails its
 * spec's import there: Angular's, through ngtsc (ADR-0027). Every other target's build erases the
 * types, and runs the output L3 rejects.
 */
const TYPE_CHECKED_BUILDS: ReadonlySet<string> = new Set(["angular"]);

/**
 * The cases with a spec that a target cannot compile yet (ADR-0068), by id, each with the cause
 * every browser layer of its tests fails with: the target's browser build type-checks its output,
 * and the quarantine holds an L3 entry for the case there. None on any other target, and none
 * once the entry is gone.
 */
export function standInCases(
  cases: readonly CaseInfo[],
  target: string,
  quarantine: readonly QuarantineEntry[],
): Record<string, string> {
  const found: Record<string, string> = {};
  if (!TYPE_CHECKED_BUILDS.has(target)) return found;
  for (const info of cases) {
    const entry = quarantine.find(
      (each) => each.case === info.id && each.target === target && each.layer === "L3",
    );
    if (!info.spec || !entry) continue;
    found[info.id] =
      `${target} cannot compile this case yet, so its spec runs against a stand-in: its L3 is quarantined for ${entry.issue} (${entry.reason}), and its browser build type-checks the output.`;
  }
  return found;
}

/**
 * Why each case's spec gets a stand-in on a target, by id: a case the target has no output for
 * (`noOutputCases`), and one it cannot compile yet (`standInCases`).
 */
export function standInReasons(
  noOutput: Readonly<Record<string, string>>,
  standIns: Readonly<Record<string, string>>,
): Record<string, string> {
  return {
    ...Object.fromEntries(
      Object.entries(noOutput).map(([id, errors]) => [
        id,
        `${id} has no output for this target: it expects ${errors}.`,
      ]),
    ),
    ...standIns,
  };
}

/**
 * The Vite plugin that serves the stand-ins, each with its reason (`standInReasons`): before the
 * unplugin (both run `pre`, in order), it resolves a spec's relative import of such a case's
 * `.uf.tsx` to the stand-in's id. During the dependency scan it leaves the import to the
 * unplugin, as for any other case.
 */
export function noOutputPlugin(
  cases: readonly CaseInfo[],
  reasons: Readonly<Record<string, string>>,
): Plugin {
  const byFile = new Map(
    cases.filter((info) => Object.hasOwn(reasons, info.id)).map((info) => [info.source, info.id]),
  );
  return {
    name: "uf-harness:no-output",
    enforce: "pre",
    resolveId(source, importer, options) {
      if (!importer || !/^\.\.?\//.test(source) || !source.endsWith(".uf.tsx")) return null;
      // `scan` is set by Vite's dependency scanner and missing from the public type.
      if ("scan" in options && options.scan === true) return null;
      const file = resolve(dirname(importer.replace(/\?.*$/s, "")), source);
      const id = byFile.get(file);
      return id === undefined ? null : `${NO_OUTPUT_PREFIX}${id}`;
    },
    load(id) {
      if (!id.startsWith(NO_OUTPUT_PREFIX)) return null;
      const reason = reasons[id.slice(NO_OUTPUT_PREFIX.length)];
      return reason === undefined ? null : standIn(reason);
    },
  };
}

/** A component module that loads, and throws the reason if anything renders its component. */
export function standIn(reason: string): string {
  return [
    `const reason = ${JSON.stringify(reason)};`,
    "export default function NoOutput() {",
    "  throw new Error(reason);",
    "}",
    "",
  ].join("\n");
}
