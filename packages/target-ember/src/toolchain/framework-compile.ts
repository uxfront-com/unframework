// L3 for Ember: each `.gts` file through the build's own steps (content-tag, Babel and Ember's
// template compiler, `gts.ts`), from the project root, where `ember-source` resolves. A `.ts`
// module beside the outputs goes through Vite's TypeScript transform.
import type {
  FrameworkCompileResult,
  ToolchainContext,
  ToolchainFile,
} from "@unframework.dev/codegen";
import {
  assertFilesToCompile,
  compileScriptModules,
  transformScriptModule,
} from "@unframework.dev/codegen/toolchain-node";

import { compileGts } from "./gts.ts";

/** Compiles each file and collects what the compilers threw, by path. */
export async function frameworkCompile(
  files: readonly ToolchainFile[],
  context: ToolchainContext,
): Promise<Map<string, FrameworkCompileResult>> {
  assertFilesToCompile(files);
  const results = new Map<string, FrameworkCompileResult>();
  const scripts = await compileScriptModules(files.filter((file) => !file.path.endsWith(".gts")));
  for (const [path, result] of scripts) results.set(path, result);
  for (const file of files) {
    if (!file.path.endsWith(".gts")) continue;
    try {
      await compileGts(file.contents, file.path, context.root);
      results.set(file.path, { errors: [], warnings: [] });
    } catch (error) {
      results.set(file.path, { errors: [messageOf(error)], warnings: [] });
    }
  }
  return results;
}

/** What the compilers make of each file for a production build (L15). */
export async function frameworkEmit(
  files: readonly ToolchainFile[],
  context: ToolchainContext,
): Promise<Map<string, ToolchainFile[]>> {
  const emitted = new Map<string, ToolchainFile[]>();
  for (const file of files) {
    if (!file.path.endsWith(".gts")) {
      const { code } = await transformScriptModule(file);
      if (code === undefined) throw new Error(`${file.path} does not compile: L3 says why.`);
      emitted.set(file.path, [{ path: file.path, contents: code }]);
      continue;
    }
    const { code } = await compileGts(file.contents, file.path, context.root);
    emitted.set(file.path, [{ path: file.path, contents: code }]);
  }
  return emitted;
}

/** An error as a toolchain message, with its position when the compiler gave one. */
function messageOf(error: unknown): FrameworkCompileResult["errors"][number] {
  if (!(error instanceof Error)) return { message: String(error) };
  const location = (error as { loc?: { line: number; column: number } }).loc;
  return {
    message: error.message,
    ...(location ? { line: location.line, column: location.column + 1 } : {}),
  };
}
