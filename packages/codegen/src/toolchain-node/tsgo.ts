// L4 for TSX outputs (React, Solid, Qwik): one TypeScript 7 (tsgo) run over every file. tsgo
// has no stable JS API yet (TypeScript 7.1 will add one), so it runs as a process and its
// plain-text diagnostics are parsed.
import { dirname, join, resolve } from "node:path";

import type { ToolchainContext, ToolchainMessage } from "../toolchain.ts";
import { diagnosticsByFile, runChecker } from "./checker.ts";
import type { CheckerRun } from "./checker.ts";
import { findInstalled } from "./resolve.ts";

/** `path(line,col): error TS2322: message`, as tsgo prints it with `--pretty false`. */
const LOCATED = /^(.+)\((\d+),(\d+)\): (?:error|warning|message) (TS\d+): (.*)$/;
/** A diagnostic without a file, such as a configuration error. */
const GLOBAL = /^(?:error|warning|message) (TS\d+): (.*)$/;

/** One diagnostic as tsgo printed it; `path` is absent for diagnostics without a file. */
interface Printed extends ToolchainMessage {
  path?: string;
}

/**
 * Type-checks `files` in one tsgo run and returns every diagnostic tsgo reported, by file (see
 * {@link diagnosticsByFile}): each given file has an entry, empty when it is clean; a diagnostic
 * in any other file (one a checked file imports, or a tsconfig with an unknown option) has an
 * entry of its own; and one without a file (a global or configuration error) is reported
 * against the temporary tsconfig the run used.
 *
 * That tsconfig, in `<toolchainDir>/.uf-tmp/`, extends the toolchain's `tsconfig.json` and lists
 * exactly `files` (see {@link runChecker}), so types resolve from each file's own location, as
 * they would in a user's project. The run rejects whenever its output cannot be trusted: no
 * files or a missing one, TypeScript 7 is missing, tsgo crashes, or it prints anything this
 * parser does not understand.
 */
export async function typecheckWithTsgo(
  files: readonly string[],
  context: ToolchainContext,
): Promise<Map<string, ToolchainMessage[]>> {
  const tsc = resolveTsgo(context.toolchainDir);
  // `--noEmit` on the command line: a toolchain tsconfig without it must never write
  // JavaScript next to the golden files.
  const run = await runChecker(
    context.toolchainDir,
    tsc,
    files.map((file) => resolve(file)),
    (tsconfig) => ["--project", tsconfig, "--noEmit", "--pretty", "false"],
  );
  return collect(files, run);
}

/** The path of TypeScript 7's `tsc` launcher, as installed for the toolchain directory. */
function resolveTsgo(toolchainDir: string): string {
  const installed = findInstalled(toolchainDir, "typescript");
  if (!installed) {
    throw new Error(`TypeScript 7 is not installed for the toolchain directory ${toolchainDir}.`);
  }
  const { manifestPath, manifest } = installed;
  // tsgo's output format and options are what this parser was written against.
  if (!manifest.version?.startsWith("7.")) {
    throw new Error(
      `Expected TypeScript 7 (tsgo) for ${toolchainDir}, found ${manifest.version ?? "no version"} at ${dirname(manifestPath)}.`,
    );
  }
  const bin = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.tsc;
  if (!bin) throw new Error(`TypeScript at ${dirname(manifestPath)} declares no tsc binary.`);
  return join(dirname(manifestPath), bin);
}

/** Parses tsgo's output into diagnostics by file, rejecting anything it cannot account for. */
function collect(
  files: readonly string[],
  { cwd, tsconfig, code, signal, stdout, stderr }: CheckerRun,
): Map<string, ToolchainMessage[]> {
  const printed: Printed[] = [];
  const unparsed: string[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const located = LOCATED.exec(line);
    if (located) {
      const [, path = "", row, column, tsCode, message = ""] = located;
      printed.push({
        path: resolve(cwd, path),
        message,
        line: Number(row),
        column: Number(column),
        code: tsCode,
      });
      continue;
    }
    const global = GLOBAL.exec(line);
    if (global) {
      printed.push({ message: global[2] ?? "", code: global[1] });
      continue;
    }
    // tsgo indents the elaboration of a diagnostic ("The types of 'x' are incompatible…").
    const previous = printed.at(-1);
    if (/^\s/.test(line) && previous) {
      previous.message += `\n${line}`;
      continue;
    }
    unparsed.push(line);
  }

  const output = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
  if (signal) throw new Error(`tsc was killed by ${signal}.\n${output}`);
  // A clean or failing run writes only to stdout; stderr means a crash or a launcher problem.
  if (stderr.trim() !== "") throw new Error(`tsc wrote to stderr (exit code ${code}):\n${output}`);
  if (unparsed.length > 0) {
    throw new Error(`tsc printed output this toolchain cannot read:\n${unparsed.join("\n")}`);
  }
  if (code !== 0 && printed.length === 0) {
    throw new Error(`tsc exited with code ${code} without reporting a diagnostic.\n${output}`);
  }

  // Report against the paths the caller gave, even when tsgo saw them through a symlink.
  const diagnostics = diagnosticsByFile(files, tsconfig);
  for (const { path, ...message } of printed) diagnostics.add(path, message);
  return diagnostics.results;
}
