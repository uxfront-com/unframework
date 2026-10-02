// L4 for Vue: one vue-tsc run (TypeScript 6, from the toolchain directory) over every file.
import { resolve } from "node:path";

import type { ToolchainContext, ToolchainMessage } from "@unframework/codegen";
import {
  assertFilesToCheck,
  checkerFailed,
  diagnosticsByFile,
  resolveToolBin,
  runChecker,
} from "@unframework/codegen/toolchain-node";

/** A `--pretty false` diagnostic: `path(line,column): error TS2322: message`. */
const LOCATED = /^(.+)\((\d+),(\d+)\): (error|warning|message) (TS\d+): (.*)$/;
/** A diagnostic with no file, such as a configuration error. */
const UNLOCATED = /^(error|warning|message) (TS\d+): (.*)$/;

/**
 * Type-checks Vue files with vue-tsc and the toolchain's tsconfig (`strictTemplates`), and
 * returns every diagnostic vue-tsc reported, by file: a requested file's own, an imported
 * file's, the toolchain tsconfig's, and, under the temporary tsconfig the run used, the ones
 * that belong to no file. Rejects when vue-tsc cannot run, or prints something this parser does
 * not understand: a checker whose output is not fully read cannot pass a file.
 */
export async function typecheck(
  files: readonly string[],
  context: ToolchainContext,
): Promise<Map<string, ToolchainMessage[]>> {
  assertFilesToCheck(files);
  const bin = resolveToolBin(context.toolchainDir, "vue-tsc", "vue-tsc");
  const run = await runChecker(context.toolchainDir, bin, files, (tsconfig) => [
    "--noEmit",
    "--pretty",
    "false",
    "-p",
    tsconfig,
  ]);

  const diagnostics = diagnosticsByFile(files, run.tsconfig);
  const unknown: string[] = [];
  let last: ToolchainMessage | undefined;
  let errors = 0;
  for (const line of run.stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const located = LOCATED.exec(line);
    const unlocated = located ? undefined : UNLOCATED.exec(line);
    if (located) {
      const [, path, row, column, category, code, message] = located;
      last = { message: message!, line: Number(row), column: Number(column), code: code! };
      diagnostics.add(resolve(run.cwd, path!), last);
      if (category === "error") errors++;
      continue;
    }
    if (unlocated) {
      const [, category, code, message] = unlocated;
      last = { message: message!, code: code! };
      diagnostics.add(undefined, last);
      if (category === "error") errors++;
      continue;
    }
    // tsc indents the rest of a multi-line message (its chained explanations).
    if (/^\s/.test(line) && last) {
      last.message += `\n${line}`;
      continue;
    }
    unknown.push(line);
  }

  if (run.signal || run.code === null) throw checkerFailed("vue-tsc", run, "it did not finish.");
  if (unknown.length > 0) {
    throw checkerFailed("vue-tsc", run, `it printed output this toolchain cannot read.`);
  }
  if ((run.code === 0) !== (errors === 0)) {
    throw checkerFailed(
      "vue-tsc",
      run,
      `its exit code does not match the ${errors} error(s) read from its output.`,
    );
  }
  return diagnostics.results;
}
