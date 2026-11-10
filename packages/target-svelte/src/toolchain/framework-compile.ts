// L3 for Svelte: svelte/compiler's compile() for the client and for the server, collecting the
// first error (Svelte stops at it) and every warning, a11y included (spike: framework-compile ADR).
import type { FrameworkCompileResult, ToolchainFile, ToolchainMessage } from "@unframework/codegen";
import {
  assertFilesToCompile,
  compileScriptModules,
  transformScriptModule,
} from "@unframework/codegen/toolchain-node";
import type { Warning } from "svelte/compiler";
import type * as SvelteCompilerModule from "svelte/compiler";

type SvelteCompiler = typeof SvelteCompilerModule;

let compiler: Promise<SvelteCompiler> | undefined;

/**
 * Compiles each Svelte file with Svelte's own compiler, as the file declares it: runes mode is
 * not forced, so a file that would compile in legacy mode is reported as an error instead. A
 * composable's `.svelte.ts` module (ADR-0069) compiles as vite-plugin-svelte compiles it: Vite's
 * TypeScript transform, then `compileModule`. A shared `.ts` module (ADR-0070) is no Svelte file:
 * the transform alone checks it.
 */
export async function frameworkCompile(
  files: readonly ToolchainFile[],
): Promise<Map<string, FrameworkCompileResult>> {
  assertFilesToCompile(files);
  // Loaded on first use, so importing the toolchain stays cheap.
  const svelte = await (compiler ??= import("svelte/compiler"));
  const results = await compileScriptModules(
    files.filter((file) => file.path.endsWith(".ts") && !file.path.endsWith(".svelte.ts")),
  );
  for (const file of files) {
    if (file.path.endsWith(".svelte.ts")) {
      results.set(file.path, await compileRunesModule(svelte.compileModule, file));
    } else if (!file.path.endsWith(".ts")) {
      results.set(file.path, compileComponent(svelte.compile, file));
    }
  }
  return results;
}

/** A `.svelte.ts` module: its TypeScript transform's report, then Svelte's for each generate. */
async function compileRunesModule(
  compileModule: SvelteCompiler["compileModule"],
  file: ToolchainFile,
): Promise<FrameworkCompileResult> {
  const { code, result } = await transformScriptModule(file);
  if (code === undefined) return result;
  const warnings = new Map<string, ToolchainMessage>();
  for (const generate of ["client", "server"] as const) {
    try {
      for (const warning of compileModule(code, { filename: file.path, generate }).warnings) {
        const message = fromDiagnostic(warning);
        warnings.set(JSON.stringify([message.code, message.line, message.column]), message);
      }
    } catch (error) {
      return { errors: [...result.errors, fromThrown(error)], warnings: result.warnings };
    }
  }
  return { errors: result.errors, warnings: [...result.warnings, ...warnings.values()] };
}

function compileComponent(
  compile: SvelteCompiler["compile"],
  file: ToolchainFile,
): FrameworkCompileResult {
  const errors: ToolchainMessage[] = [];
  const warnings = new Map<string, ToolchainMessage>();
  for (const generate of ["client", "server"] as const) {
    let result: ReturnType<SvelteCompiler["compile"]>;
    try {
      result = compile(file.contents, { filename: file.path, generate });
    } catch (error) {
      errors.push(fromThrown(error));
      // The server pass would stop at the same error.
      break;
    }
    // Both passes run the same analysis, so most warnings come twice.
    for (const warning of result.warnings) {
      const message = fromDiagnostic(warning);
      warnings.set(JSON.stringify([message.code, message.line, message.column]), message);
    }
    if (generate === "client" && !result.metadata.runes) {
      errors.push({
        code: "legacy_mode",
        message:
          "The component compiles in legacy mode: Svelte infers it for a component without " +
          "runes. Declare runes mode with <svelte:options runes={true} />.",
      });
    }
  }
  return { errors, warnings: [...warnings.values()] };
}

/** Svelte's lines are 1-based and its columns 0-based. */
function fromDiagnostic(diagnostic: Warning): ToolchainMessage {
  return {
    message: diagnostic.message,
    ...(diagnostic.start
      ? { line: diagnostic.start.line, column: diagnostic.start.column + 1 }
      : {}),
    code: diagnostic.code,
  };
}

/** A CompileError has a warning's shape; anything else is a compiler crash. */
function fromThrown(error: unknown): ToolchainMessage {
  if (error instanceof Error && error.name === "CompileError" && "code" in error) {
    return fromDiagnostic(error as unknown as Warning);
  }
  return {
    message: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  };
}
