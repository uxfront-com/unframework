// Loads Angular's compiler stack from the toolchain directory. @angular/compiler-cli,
// @angular/build, Analog and TypeScript 6 are never dependencies of this package: they peer on
// TypeScript 6, and the workspace's `typescript` is TypeScript 7, which has no JS API (the
// TS6/TS7 ADR). The types below are the structural subset this toolchain calls.
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { resolveInstalled } from "@unframework/codegen/toolchain-node";
import type { Plugin, Rolldown } from "vite";

/** TypeScript compiler options, as `NgtscProgram` reads them (TS and Angular options merged). */
export type CompilerOptions = Record<string, unknown>;

/** A parsed file of a TypeScript program. */
export interface SourceFile {
  readonly fileName: string;
  getLineAndCharacterOfPosition(position: number): { line: number; character: number };
}

/** A chain of diagnostic messages, flattened by `flattenDiagnosticMessageText`. */
export interface DiagnosticMessageChain {
  readonly messageText: string;
}

/** A TypeScript or Angular diagnostic. Angular's codes are `-99xxxx`. */
export interface Diagnostic {
  readonly file: SourceFile | undefined;
  readonly start: number | undefined;
  readonly messageText: string | DiagnosticMessageChain;
  readonly category: number;
  readonly code: number;
}

/** A module resolution, as `resolveModuleNameLiterals` returns it. */
export interface ResolvedModule {
  readonly resolvedModule:
    | { resolvedFileName: string; extension: string; isExternalLibraryImport?: boolean }
    | undefined;
}

/** The compiler host members this toolchain replaces. */
export interface CompilerHost {
  fileExists(fileName: string): boolean;
  readFile(fileName: string): string | undefined;
  directoryExists(directoryName: string): boolean;
  getSourceFile(
    fileName: string,
    languageVersion: unknown,
    onError?: unknown,
    shouldCreateNewSourceFile?: boolean,
  ): SourceFile | undefined;
  resolveModuleNameLiterals?(
    literals: readonly { readonly text: string }[],
    containingFile: string,
    redirectedReference: unknown,
    options: CompilerOptions,
  ): readonly ResolvedModule[];
  resolveModuleNames?(
    moduleNames: string[],
    containingFile: string,
    reusedNames: unknown,
    redirectedReference: unknown,
    options: CompilerOptions,
  ): ResolvedModule["resolvedModule"][];
}

/** A TypeScript program, for emit. */
export interface Program {
  getSourceFile(fileName: string): SourceFile | undefined;
  getTypeChecker(): {
    getSymbolAtLocation(node: SourceFile): object | undefined;
    getExportsOfModule(moduleSymbol: object): readonly { readonly name: string }[];
  };
  emit(
    targetSourceFile: SourceFile | undefined,
    writeFile: (fileName: string, text: string) => void,
    cancellationToken: undefined,
    emitOnlyDts: boolean,
    customTransformers: unknown,
  ): { diagnostics: readonly Diagnostic[]; emitSkipped: boolean };
}

/** The subset of TypeScript 6's API the Angular toolchain uses. */
export interface TypeScript {
  readonly DiagnosticCategory: { readonly Warning: number; readonly Error: number };
  readonly ScriptTarget: { readonly ES2022: number };
  readonly ModuleKind: { readonly Preserve: number };
  readonly ModuleResolutionKind: { readonly Bundler: number };
  readonly Extension: { readonly Ts: string };
  createCompilerHost(options: CompilerOptions, setParentNodes?: boolean): CompilerHost;
  createSourceFile(
    fileName: string,
    text: string,
    languageVersion: unknown,
    setParentNodes?: boolean,
  ): SourceFile;
  resolveModuleName(
    moduleName: string,
    containingFile: string,
    options: CompilerOptions,
    host: CompilerHost,
    cache: undefined,
    redirectedReference: unknown,
  ): ResolvedModule;
  flattenDiagnosticMessageText(
    messageText: string | DiagnosticMessageChain | undefined,
    newLine: string,
  ): string;
}

/** `NgtscProgram` from @angular/compiler-cli: the AOT compiler behind ngc and the CLI. */
export interface NgtscProgram {
  readonly compiler: {
    analyzeAsync(): Promise<void>;
    prepareEmit(): { transformers: unknown };
  };
  getTsProgram(): Program;
  getTsOptionDiagnostics(): readonly Diagnostic[];
  getNgOptionDiagnostics(): readonly Diagnostic[];
  getTsSyntacticDiagnostics(sourceFile?: SourceFile): readonly Diagnostic[];
  getTsSemanticDiagnostics(sourceFile?: SourceFile): readonly Diagnostic[];
  getNgStructuralDiagnostics(): readonly Diagnostic[];
  getNgSemanticDiagnostics(fileName?: string): readonly Diagnostic[];
}

/** What `readConfiguration` returns for a tsconfig. */
export interface ParsedConfiguration {
  options: CompilerOptions;
  rootNames: string[];
  errors: readonly Diagnostic[];
}

/** The subset of @angular/compiler-cli this toolchain uses. */
export interface CompilerCli {
  readonly VERSION: { readonly full: string };
  readonly NgtscProgram: new (
    rootNames: readonly string[],
    options: CompilerOptions,
    host: CompilerHost,
    oldProgram?: NgtscProgram,
  ) => NgtscProgram;
  readConfiguration(project: string): ParsedConfiguration;
}

/** Angular's compiler and the TypeScript 6 instance it runs on, loaded from one directory. */
export interface AngularCompiler {
  readonly ts: TypeScript;
  readonly cli: CompilerCli;
  /** The toolchain's `node_modules/@angular`, so output anywhere resolves `@angular/*`. */
  readonly angularScope: string;
  /** Lib and node_modules declarations, parsed once per process: they never change in a run. */
  readonly declarations: Map<string, SourceFile>;
}

/** The options of Analog's Vite plugin that this toolchain sets. */
export interface AnalogOptions {
  tsconfig: string;
  jit: boolean;
}

/** `JavaScriptTransformer` from `@angular/build/private`: Babel/oxc linking in a worker pool. */
export interface JavaScriptTransformer {
  transformFile(filename: string): Promise<Uint8Array>;
  transformData(filename: string, data: string): Promise<Uint8Array>;
  close(): Promise<void>;
}

/** The tools of the Vite projects: Analog and the Angular CLI's linker. */
export interface AngularViteTools {
  analog(options: AnalogOptions): Plugin[];
  createTransformer(): JavaScriptTransformer;
}

/** A rolldown plugin for `optimizeDeps.rolldownOptions.plugins`. */
export type RolldownPlugin = Rolldown.Plugin;

const compilers = new Map<string, Promise<AngularCompiler>>();
const viteTools = new Map<string, Promise<AngularViteTools>>();

/**
 * Loads @angular/compiler-cli and the TypeScript it runs on from `toolchainDir`, once per
 * directory. Rejects with the missing package and the directory when the toolchain is not
 * installed there: a gate that cannot start fails.
 */
export function loadCompiler(toolchainDir: string): Promise<AngularCompiler> {
  let loaded = compilers.get(toolchainDir);
  if (!loaded) {
    loaded = importCompiler(toolchainDir);
    // A failed load is not cached, so a fixed installation works without a restart.
    loaded.catch(() => compilers.delete(toolchainDir));
    compilers.set(toolchainDir, loaded);
  }
  return loaded;
}

/** Loads Analog and @angular/build's JavaScriptTransformer from `toolchainDir`, once. */
export function loadViteTools(toolchainDir: string): Promise<AngularViteTools> {
  let loaded = viteTools.get(toolchainDir);
  if (!loaded) {
    loaded = importViteTools(toolchainDir);
    loaded.catch(() => viteTools.delete(toolchainDir));
    viteTools.set(toolchainDir, loaded);
  }
  return loaded;
}

/**
 * The version of a package installed for `directory`. Used to check that the compiler and the
 * runtime that runs its output are the same Angular release.
 */
export function packageVersion(directory: string, name: string): string {
  const manifest = resolveInstalled(directory, `${name}/package.json`);
  if (!manifest) throw new Error(`Cannot resolve ${name} from ${directory}: install it there.`);
  return (JSON.parse(readFileSync(manifest, "utf8")) as { version: string }).version;
}

async function importCompiler(toolchainDir: string): Promise<AngularCompiler> {
  const entry = resolveTool(toolchainDir, "@angular/compiler-cli");
  const cli = (await import(pathToFileURL(entry).href)) as CompilerCli;
  // The TypeScript that compiler-cli itself imports: SourceFiles from another instance would
  // not belong to its programs.
  const tsEntry = createRequire(entry).resolve("typescript");
  const ts = ((await import(pathToFileURL(tsEntry).href)) as { default: TypeScript }).default;
  const core = packageVersion(toolchainDir, "@angular/core");
  if (core !== cli.VERSION.full) {
    throw new Error(
      `The Angular toolchain in ${toolchainDir} mixes @angular/compiler-cli ${cli.VERSION.full} ` +
        `with @angular/core ${core}. Install the same version of both.`,
    );
  }
  // The directory the toolchain's own `@angular/*` are linked into, not a realpath: under pnpm
  // the real `@angular/core` directory has no `@angular/common` beside it.
  const angularScope = join(toolchainDir, "node_modules", "@angular");
  if (!existsSync(join(angularScope, "core", "package.json"))) {
    throw new Error(
      `The Angular toolchain directory ${toolchainDir} has no node_modules/@angular/core: ` +
        `install @angular/core there as a direct dependency.`,
    );
  }
  return { ts, cli, angularScope, declarations: new Map() };
}

async function importViteTools(toolchainDir: string): Promise<AngularViteTools> {
  const analogEntry = resolveTool(toolchainDir, "@analogjs/vite-plugin-angular");
  const analog = (await import(pathToFileURL(analogEntry).href)) as {
    default: (options: AnalogOptions) => Plugin[];
  };
  const buildEntry = resolveTool(toolchainDir, "@angular/build/private");
  const build = (await import(pathToFileURL(buildEntry).href)) as {
    JavaScriptTransformer: new (options: {
      sourcemap: boolean;
      jit: boolean;
      advancedOptimizations: boolean;
      maxConcurrency: number;
    }) => JavaScriptTransformer;
  };
  return {
    analog: (options) => analog.default(options),
    // Linking only (no JIT, no advanced optimisations), as production builds link, in one
    // worker: each caller (the dep optimizer, the SSR module graph) links a few packages.
    createTransformer: () =>
      new build.JavaScriptTransformer({
        sourcemap: false,
        jit: false,
        advancedOptimizations: false,
        maxConcurrency: 1,
      }),
  };
}

/**
 * Resolves one of the toolchain's tools, never through NODE_PATH (see `resolveInstalled`), and
 * names what the directory must provide when it fails.
 */
function resolveTool(directory: string, specifier: string): string {
  if (!existsSync(join(directory, "package.json"))) {
    throw new Error(
      `The Angular toolchain directory ${directory} has no package.json. It must provide ` +
        `@angular/compiler-cli, @angular/build, @analogjs/vite-plugin-angular and TypeScript 6.`,
    );
  }
  const entry = resolveInstalled(directory, specifier);
  if (!entry) {
    throw new Error(
      `Cannot load ${specifier} from the Angular toolchain directory ${directory}. Install ` +
        `@angular/compiler-cli, @angular/build, @analogjs/vite-plugin-angular and TypeScript 6 there.`,
    );
  }
  return entry;
}
