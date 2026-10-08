// The browser projects' stand-ins for the components a target has no output for (ADR-0050). A
// feature case may expect an error for a target: the one that target declares for a capability
// it lacks (ADR-0033, L1 refuses any other). The compile project then records the target's later
// layers as skipped (no output), and the toolchain and ssr projects leave the case out. The
// browser project still loads the spec, because the summary compares each target's tests with
// the reference's: its import of the component gets a stand-in here instead of a compile that
// fails, so the spec loads, and the setup skips each of its tests on that target with the
// errors the case expects (`no output: …`, a mechanical cause the summary excuses there alone).
// The stand-in throws them if anything renders it.
import { dirname, resolve } from "node:path";

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
 * The Vite plugin that serves the stand-ins: before the unplugin (both run `pre`, in order), it
 * resolves a spec's relative import of such a case's `.uf.tsx` to the stand-in's id. During the
 * dependency scan it leaves the import to the unplugin, as for any other case.
 */
export function noOutputPlugin(
  cases: readonly CaseInfo[],
  noOutput: Readonly<Record<string, string>>,
): Plugin {
  const byFile = new Map(
    cases.filter((info) => Object.hasOwn(noOutput, info.id)).map((info) => [info.source, info.id]),
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
      const caseId = id.slice(NO_OUTPUT_PREFIX.length);
      const errors = noOutput[caseId];
      if (errors === undefined) return null;
      return standIn(`${caseId} has no output for this target: it expects ${errors}.`);
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
