// Layer L4 for Astro: `astro check`, run programmatically. Astro's checker still needs
// TypeScript 6's JS API, which TypeScript 7 does not have, so it is loaded at run time from the
// toolchain directory (`tests/toolchains/astro`), where `typescript` is TypeScript 6.
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ToolchainContext, ToolchainMessage } from "@unframework/codegen";
import {
  assertFilesToCheck,
  diagnosticsByFile,
  resolveInstalled,
} from "@unframework/codegen/toolchain-node";
import type { DiagnosticsByFile } from "@unframework/codegen/toolchain-node";

/** The part of `@astrojs/language-server` the check uses (its `AstroCheck` class). */
interface LanguageServer {
  AstroCheck: new (
    workspacePath: string,
    typescriptPath: string,
    tsconfigPath: string,
  ) => { lint(options: { fileNames: string[] }): Promise<CheckResult> };
  DiagnosticSeverity: { Error: number; Warning: number };
}

interface CheckResult {
  status: "completed" | "cancelled" | undefined;
  fileChecked: number;
  fileResult: { fileUrl: URL; errors: CheckDiagnostic[] }[];
}

/** An LSP diagnostic: 0-based positions. */
interface CheckDiagnostic {
  severity?: number;
  code?: number | string;
  source?: string;
  message: string;
  range: { start: { line: number; character: number } };
}

/** A TypeScript 6 diagnostic of the tsconfig, as its API reports one. */
interface ConfigDiagnostic {
  file?: {
    fileName: string;
    getLineAndCharacterOfPosition(position: number): { line: number; character: number };
  };
  start?: number;
  code: number;
  messageText: unknown;
}

/** The part of TypeScript 6's API that validates the generated tsconfig. */
interface TypeScriptConfigApi {
  sys: object;
  ScriptKind: { Deferred: number };
  getParsedCommandLineOfConfigFile(
    path: string,
    options: undefined,
    host: object,
    extendedConfigCache: undefined,
    watchOptions: undefined,
    extraFileExtensions: { extension: string; isMixedContent: boolean; scriptKind: number }[],
  ): { errors: ConfigDiagnostic[] } | undefined;
  flattenDiagnosticMessageText(text: unknown, newLine: string): string;
}

let runs = 0;

/**
 * Type-checks Astro files in one `AstroCheck` run, the class `astro check` drives, taken from
 * the `@astrojs/check` installed in the toolchain directory together with the TypeScript it
 * resolves. A temporary tsconfig in `<toolchainDir>/.uf-tmp/` extends the toolchain's
 * `tsconfig.json` and lists exactly the files.
 *
 * Returns every error and warning, by absolute path, with 1-based positions: each file's own
 * (an entry per file, empty when clean), and the tsconfig's, which `AstroCheck` would ignore,
 * under the file they are in or, without one, under the temporary tsconfig. Information and
 * hints (unused names, deprecations) are editor suggestions, which `astro check` never fails on,
 * and are left out. Rejects when the checker cannot start, when it does not check every file,
 * or when a file is missing, because `AstroCheck` would report a missing file as clean.
 */
export async function astroTypecheck(
  files: readonly string[],
  context: ToolchainContext,
): Promise<Map<string, ToolchainMessage[]>> {
  assertFilesToCheck(files);
  const { toolchainDir } = context;
  const baseConfig = join(toolchainDir, "tsconfig.json");
  if (!existsSync(baseConfig)) {
    throw new Error(`L4 (astro): the toolchain has no tsconfig.json: ${baseConfig}.`);
  }
  const { languageServer, typescriptPath, typescript } = loadChecker(toolchainDir);

  const directory = join(toolchainDir, ".uf-tmp");
  mkdirSync(directory, { recursive: true });
  const tsconfig = join(directory, `tsconfig.astro-check.${process.pid}.${++runs}.json`);
  writeFileSync(
    tsconfig,
    `${JSON.stringify({ extends: baseConfig, include: [], files: [...files] }, null, 2)}\n`,
  );
  try {
    const diagnostics = diagnosticsByFile(files, tsconfig);
    addConfigDiagnostics(typescript, tsconfig, diagnostics);
    const checker = new languageServer.AstroCheck(toolchainDir, typescriptPath, tsconfig);
    // AstroCheck lints only the files it is given, unlike tsgo, vue-tsc, svelte-check and ngtsc,
    // which report every file of the program: an error inside a module an output imports is
    // not reported here. M0's outputs import only Astro itself; before outputs import shared
    // modules (M5), lint the program's other source files too.
    const result = await checker.lint({ fileNames: [...files] });
    if (result.status !== "completed" || result.fileChecked !== files.length) {
      throw new Error(
        `L4 (astro): astro check ${result.status ?? "did not finish"} after ${result.fileChecked} of ${files.length} files.`,
      );
    }
    const { Error: error, Warning: warning } = languageServer.DiagnosticSeverity;
    for (const { fileUrl, errors } of result.fileResult) {
      const file = fileURLToPath(fileUrl);
      for (const diagnostic of errors) {
        // LSP leaves the severity out when it is an error.
        const severity = diagnostic.severity ?? error;
        if (severity !== error && severity !== warning) continue;
        diagnostics.add(file, fromDiagnostic(diagnostic, severity === warning));
      }
    }
    return diagnostics.results;
  } finally {
    rmSync(tsconfig, { force: true });
  }
}

function loadChecker(toolchainDir: string): {
  languageServer: LanguageServer;
  typescriptPath: string;
  typescript: TypeScriptConfigApi;
} {
  const checkEntry = resolveInstalled(toolchainDir, "@astrojs/check");
  if (!checkEntry) {
    throw new Error(`L4 (astro): @astrojs/check is not installed in ${toolchainDir}.`);
  }
  // Resolve the language server and TypeScript the way `astro check` itself does.
  const fromCheck = createRequire(checkEntry);
  const typescriptPath = fromCheck.resolve("typescript");
  const typescript = fromCheck(typescriptPath) as TypeScriptConfigApi & { version?: string };
  if (typeof typescript.getParsedCommandLineOfConfigFile !== "function") {
    throw new Error(
      `L4 (astro): @astrojs/check resolves TypeScript ${typescript.version ?? "of an unknown version"}, which has no JS API; the toolchain needs TypeScript 6.`,
    );
  }
  return {
    languageServer: fromCheck("@astrojs/language-server") as LanguageServer,
    typescriptPath,
    typescript,
  };
}

/**
 * Adds the generated tsconfig's errors, such as an `extends` that cannot be read or an unknown
 * option, which `AstroCheck` ignores and checks on without.
 */
function addConfigDiagnostics(
  typescript: TypeScriptConfigApi,
  tsconfig: string,
  diagnostics: DiagnosticsByFile,
): void {
  const astroFiles = [
    { extension: ".astro", isMixedContent: true, scriptKind: typescript.ScriptKind.Deferred },
  ];
  const fatal: ConfigDiagnostic[] = [];
  const parsed = typescript.getParsedCommandLineOfConfigFile(
    tsconfig,
    undefined,
    {
      ...typescript.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic: ConfigDiagnostic) => fatal.push(diagnostic),
    },
    undefined,
    undefined,
    astroFiles,
  );
  for (const diagnostic of [...fatal, ...(parsed?.errors ?? [])]) {
    const { file, start } = diagnostic;
    const message = typescript.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    const code = `TS${diagnostic.code}`;
    if (!file || start === undefined) {
      diagnostics.add(file?.fileName, { message, code });
      continue;
    }
    const { line, character } = file.getLineAndCharacterOfPosition(start);
    diagnostics.add(file.fileName, { message, line: line + 1, column: character + 1, code });
  }
}

function fromDiagnostic(diagnostic: CheckDiagnostic, warning: boolean): ToolchainMessage {
  const { line, character } = diagnostic.range.start;
  const code =
    diagnostic.code === undefined
      ? undefined
      : diagnostic.source === "ts"
        ? `TS${diagnostic.code}`
        : String(diagnostic.code);
  return {
    message: warning ? `warning: ${diagnostic.message}` : diagnostic.message,
    line: line + 1,
    column: character + 1,
    ...(code ? { code } : {}),
  };
}
