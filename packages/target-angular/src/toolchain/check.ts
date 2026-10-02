// L3 and L4 for Angular. Both are ngtsc with strict templates, which is Angular's type checker
// as well as its compiler (the framework-compile ADR): one program over every file, never one
// per file (about 57 ms each against under 2 ms in a batch).
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import type {
  FrameworkCompileResult,
  ToolchainContext,
  ToolchainFile,
  ToolchainMessage,
} from "@unframework/codegen";
import {
  assertFilesToCheck,
  assertFilesToCompile,
  diagnosticsByFile,
} from "@unframework/codegen/toolchain-node";

import { collectDiagnostics, createHost, groupByFile, strictOptions, toMessage } from "./ngtsc.ts";
import { loadCompiler } from "./tools.ts";
import type { ParsedConfiguration } from "./tools.ts";

/**
 * L3: compiles the files, in memory, as one ngtsc program under the strict options, and
 * reports every file's errors and warnings (extended template diagnostics are the warnings).
 */
export async function frameworkCompile(
  files: readonly ToolchainFile[],
  context: ToolchainContext,
): Promise<Map<string, FrameworkCompileResult>> {
  assertFilesToCompile(files);
  const compiler = await loadCompiler(context.toolchainDir);
  const options = strictOptions(compiler);
  const contents = new Map(files.map((file) => [resolve(file.path), file.contents]));
  const host = createHost(compiler, options, (fileName) => contents.get(resolve(fileName)));
  const diagnostics = collectDiagnostics(
    compiler,
    [...contents.keys()],
    (rootNames) => new compiler.cli.NgtscProgram(rootNames, options, host),
  );
  return groupByFile(
    compiler,
    files.map((file) => file.path),
    diagnostics,
  );
}

let configs = 0;

/**
 * L4: type-checks the files on disk as ngc would, with the toolchain directory's
 * `tsconfig.json`, through a temporary tsconfig in its `.uf-tmp/` that extends it and lists
 * exactly these files. Returns every diagnostic ngtsc reported, by file: a requested file's own,
 * an imported file's, the toolchain tsconfig's, and, under the temporary tsconfig, the ones that
 * belong to no file (options, globals). Rejects when the toolchain has no tsconfig.
 */
export async function typecheck(
  files: readonly string[],
  context: ToolchainContext,
): Promise<Map<string, ToolchainMessage[]>> {
  assertFilesToCheck(files);
  const compiler = await loadCompiler(context.toolchainDir);
  const base = join(context.toolchainDir, "tsconfig.json");
  if (!existsSync(base)) {
    throw new Error(
      `Cannot start the Angular type check: ${base} does not exist, and it is what the check extends.`,
    );
  }
  const directory = join(context.toolchainDir, ".uf-tmp");
  const project = join(directory, `tsconfig.typecheck.${process.pid}.${++configs}.json`);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    project,
    `${JSON.stringify({ extends: "../tsconfig.json", files: files.map((file) => resolve(file)), include: [] }, null, 2)}\n`,
  );
  let config: ParsedConfiguration;
  try {
    config = compiler.cli.readConfiguration(project);
  } finally {
    rmSync(project, { force: true });
  }
  // A configuration error is reported, and the check still runs with the options that could be
  // read, so no file's own diagnostics are lost.
  const { options, rootNames, errors } = config;
  const host = createHost(compiler, options, () => undefined);
  const diagnostics = diagnosticsByFile(files, project);
  for (const diagnostic of [
    ...errors,
    ...collectDiagnostics(
      compiler,
      rootNames,
      (roots) => new compiler.cli.NgtscProgram(roots, options, host),
    ),
  ]) {
    diagnostics.add(diagnostic.file?.fileName, toMessage(compiler, diagnostic));
  }
  return diagnostics.results;
}
