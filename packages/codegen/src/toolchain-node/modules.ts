// L3 for the plain `.ts` modules of an output tree on the template targets: a shared module
// copied beside the components (ADR-0070) and a composable's module (ADR-0069). No framework
// compiler reads one. Vite's own TypeScript transform does, as each target's dev server loads it
// (ADR-0069's module ids), so it is their L3: what it cannot transform fails.
import { stripVTControlCharacters } from "node:util";

import type { FrameworkCompileResult, ToolchainFile, ToolchainMessage } from "../toolchain.ts";

/** One error of a failed transform, as Rolldown reports it. */
interface TransformError {
  message: string;
  code?: string;
  /** 1-based line, 0-based column. */
  loc?: { line: number; column: number };
}

/**
 * Transforms each `.ts` module with Vite's `transformWithOxc`, and returns its errors and
 * warnings by path.
 */
export async function compileScriptModules(
  files: readonly ToolchainFile[],
): Promise<Map<string, FrameworkCompileResult>> {
  const results = new Map<string, FrameworkCompileResult>();
  for (const file of files) results.set(file.path, (await transformScriptModule(file)).result);
  return results;
}

/**
 * Transforms one `.ts` module with Vite's `transformWithOxc` (Vite is the toolchains' peer,
 * loaded on first use): its JavaScript, absent when the transform failed, and what it reported.
 * Svelte compiles a `.svelte.ts` module's JavaScript next, as vite-plugin-svelte does.
 */
export async function transformScriptModule(
  file: ToolchainFile,
): Promise<{ code: string | undefined; result: FrameworkCompileResult }> {
  const { transformWithOxc } = await import("vite");
  try {
    const { code, warnings } = await transformWithOxc(file.contents, file.path, { lang: "ts" });
    return { code, result: { errors: [], warnings: warnings.map(fromTransformError) } };
  } catch (error) {
    const errors = (error as { errors?: TransformError[] }).errors;
    return {
      code: undefined,
      result: {
        errors: errors?.length
          ? errors.map(fromTransformError)
          : [{ message: error instanceof Error ? error.message : String(error) }],
        warnings: [],
      },
    };
  }
}

/** The message's first line, without its colours and its `[CODE]` prefix; its code frame goes. */
function fromTransformError(error: TransformError): ToolchainMessage {
  const message = stripVTControlCharacters(error.message)
    .split("\n")[0]!
    .replace(/^\[[A-Z_]+\]\s*/, "")
    .trim();
  return {
    message,
    ...(error.loc ? { line: error.loc.line, column: error.loc.column + 1 } : {}),
    ...(error.code ? { code: error.code } : {}),
  };
}
