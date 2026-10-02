// The ngtsc machinery that L3 (frameworkCompile), L4 (typecheck) and the Vite plugin share:
// Angular's AOT compiler, `NgtscProgram`, driven the way ngc drives it.
import { dirname, join, relative, resolve } from "node:path";

import type { FrameworkCompileResult, ToolchainMessage } from "@unframework/codegen";

import type {
  AngularCompiler,
  CompilerHost,
  CompilerOptions,
  Diagnostic,
  NgtscProgram,
} from "./tools.ts";

/**
 * The options `ng new` generates (strict TypeScript, strict templates, host binding checks),
 * plus the type-checking flags it leaves out that the other targets' checkers set
 * (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`: tests/toolchains/angular/tsconfig.json),
 * with `@angular/*` resolved from the toolchain so output anywhere on disk, or only in memory,
 * compiles without an Angular dependency of its own. Extended template diagnostics stay
 * warnings, so L3 can hold output to zero of each.
 */
export function strictOptions(compiler: AngularCompiler): CompilerOptions {
  const { ts } = compiler;
  return {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.Preserve,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ["lib.es2022.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
    strict: true,
    noUncheckedIndexedAccess: true,
    noImplicitOverride: true,
    noPropertyAccessFromIndexSignature: true,
    noImplicitReturns: true,
    noFallthroughCasesInSwitch: true,
    isolatedModules: true,
    verbatimModuleSyntax: true,
    skipLibCheck: true,
    noEmit: true,
    types: [],
    paths: { "@angular/*": [join(compiler.angularScope, "*")] },
    strictTemplates: true,
    strictInjectionParameters: true,
    strictInputAccessModifiers: true,
    strictStandalone: true,
    typeCheckHostBindings: true,
    extendedDiagnostics: { defaultCategory: "warning" },
  };
}

const DECLARATION = /\.d\.[cm]?ts$/;

/**
 * A compiler host that serves `contents(fileName)` from memory and everything else from disk.
 * The directories of in-memory files exist for it: TypeScript resolves the template type-check
 * shims next to their component, and in a directory it believes missing, ngtsc silently skips
 * template type-checking. Declaration files under node_modules (TypeScript's libs, Angular's
 * typings) are parsed once per process and shared by every program: parsing them is most of a
 * cold compile.
 */
export function createHost(
  compiler: AngularCompiler,
  options: CompilerOptions,
  contents: (fileName: string) => string | undefined,
): CompilerHost {
  const { ts, declarations } = compiler;
  const host = ts.createCompilerHost(options, true);
  const fileExists = host.fileExists.bind(host);
  const readFile = host.readFile.bind(host);
  const directoryExists = host.directoryExists.bind(host);
  const getSourceFile = host.getSourceFile.bind(host);
  const directories = new Set<string>();
  // TypeScript reads a file before it resolves anything relative to it, so a directory is
  // known by the time it is asked about.
  const inMemory = (fileName: string) => {
    const text = contents(fileName);
    let directory = dirname(resolve(fileName));
    while (text !== undefined && !directories.has(directory)) {
      directories.add(directory);
      if (dirname(directory) === directory) break;
      directory = dirname(directory);
    }
    return text;
  };
  host.fileExists = (fileName) => inMemory(fileName) !== undefined || fileExists(fileName);
  host.readFile = (fileName) => inMemory(fileName) ?? readFile(fileName);
  host.directoryExists = (directory) =>
    directories.has(resolve(directory)) || directoryExists(directory);
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    const text = inMemory(fileName);
    if (text !== undefined) return ts.createSourceFile(fileName, text, languageVersion, true);
    // Only declarations: ngtsc tags the source files it compiles with its type-check shims.
    if (!fileName.includes("/node_modules/") || !DECLARATION.test(fileName)) {
      return getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
    }
    const key = `${fileName}|${JSON.stringify(languageVersion)}`;
    const cached = shouldCreateNewSourceFile ? undefined : declarations.get(key);
    if (cached) return cached;
    const parsed = getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
    if (parsed) declarations.set(key, parsed);
    return parsed;
  };
  return host;
}

/**
 * Every diagnostic of a check over `rootNames`, collected as ngc does: options and syntax
 * first, then (only for a program that parses) TypeScript semantics, Angular structure
 * (decorators, metadata) and Angular semantics (template parsing and type-checking, extended
 * template diagnostics). ngc skips the later phases for the whole program when any file fails
 * to parse, which would make every other file look clean, so the parsable files are checked
 * again on their own.
 */
export function collectDiagnostics(
  compiler: AngularCompiler,
  rootNames: readonly string[],
  createProgram: (rootNames: readonly string[]) => NgtscProgram,
): Diagnostic[] {
  const program = createProgram(rootNames);
  const isError = (diagnostic: Diagnostic) =>
    diagnostic.category === compiler.ts.DiagnosticCategory.Error;
  const early = [
    ...program.getTsOptionDiagnostics(),
    ...program.getNgOptionDiagnostics(),
    ...program.getTsSyntacticDiagnostics(),
  ];
  if (!early.some(isError)) {
    return [
      ...early,
      ...program.getTsSemanticDiagnostics(),
      ...program.getNgStructuralDiagnostics(),
      ...program.getNgSemanticDiagnostics(),
    ];
  }
  const unparsable = new Set(
    early.flatMap((diagnostic) =>
      isError(diagnostic) && diagnostic.file ? [resolve(diagnostic.file.fileName)] : [],
    ),
  );
  const parsable = rootNames.filter((fileName) => !unparsable.has(resolve(fileName)));
  // An options error fails everything, and a syntax error outside the roots cannot be set
  // aside: report what there is (both reach every file, see groupByFile).
  const global = early.some((diagnostic) => isError(diagnostic) && !diagnostic.file);
  if (global || parsable.length === 0 || parsable.length === rootNames.length) return early;
  return [
    ...early.filter(
      (diagnostic) => diagnostic.file && unparsable.has(resolve(diagnostic.file.fileName)),
    ),
    ...collectDiagnostics(compiler, parsable, createProgram),
  ];
}

/**
 * Groups diagnostics by input file, errors apart from warnings. A diagnostic outside
 * the inputs (options, a library, an imported file) is reported on every file, with its own
 * location in the message: nothing is dropped.
 */
export function groupByFile(
  compiler: AngularCompiler,
  fileNames: readonly string[],
  diagnostics: readonly Diagnostic[],
): Map<string, FrameworkCompileResult> {
  const byPath = new Map(fileNames.map((fileName) => [resolve(fileName), fileName]));
  const results = new Map<string, FrameworkCompileResult>(
    fileNames.map((fileName) => [fileName, { errors: [], warnings: [] }]),
  );
  const global: FrameworkCompileResult = { errors: [], warnings: [] };
  for (const diagnostic of diagnostics) {
    const input = diagnostic.file && byPath.get(resolve(diagnostic.file.fileName));
    const result = input ? results.get(input)! : global;
    const message = toMessage(compiler, diagnostic, input === undefined);
    if (diagnostic.category === compiler.ts.DiagnosticCategory.Error) result.errors.push(message);
    else result.warnings.push(message);
  }
  for (const result of results.values()) {
    result.errors.unshift(...global.errors);
    result.warnings.unshift(...global.warnings);
  }
  return results;
}

/** The code ngc prints: Angular's diagnostics are `-99xxxx` internally and `NGxxxx` outside. */
export function diagnosticCode(diagnostic: Diagnostic): string {
  const code = String(diagnostic.code);
  return code.startsWith("-99") ? `NG${code.slice(3)}` : `TS${code}`;
}

/**
 * A diagnostic as a toolchain message, with a 1-based line and column. `located` puts the
 * file and position in the message instead, for a diagnostic reported on another file.
 */
export function toMessage(
  compiler: AngularCompiler,
  diagnostic: Diagnostic,
  located = false,
): ToolchainMessage {
  const text = compiler.ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
  const code = diagnosticCode(diagnostic);
  const position = positionOf(diagnostic);
  if (located && diagnostic.file) return { message: `${locationOf(diagnostic)}: ${text}`, code };
  return position ? { message: text, ...position, code } : { message: text, code };
}

/** Diagnostics as ngc prints them, one per line: `file(line,column): error NG8002: …`. */
export function formatDiagnostics(
  compiler: AngularCompiler,
  diagnostics: readonly Diagnostic[],
): string {
  return diagnostics
    .map((diagnostic) => {
      const text = compiler.ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
      const severity =
        diagnostic.category === compiler.ts.DiagnosticCategory.Error ? "error" : "warning";
      const where = diagnostic.file ? `${locationOf(diagnostic)}: ` : "";
      return `${where}${severity} ${diagnosticCode(diagnostic)}: ${text}`;
    })
    .join("\n");
}

function positionOf(diagnostic: Diagnostic): { line: number; column: number } | undefined {
  if (!diagnostic.file || diagnostic.start === undefined) return undefined;
  const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
  return { line: line + 1, column: character + 1 };
}

/** `path(line,column)`, relative to the working directory, as ngc prints it. */
function locationOf(diagnostic: Diagnostic): string {
  const path = relative(process.cwd(), diagnostic.file!.fileName);
  const position = positionOf(diagnostic);
  return position ? `${path}(${position.line},${position.column})` : path;
}
