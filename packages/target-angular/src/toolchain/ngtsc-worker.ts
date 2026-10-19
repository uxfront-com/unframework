// The compile of `ngtscVirtual` (ngtsc-virtual.ts), in a worker thread: `NgtscProgram`, its
// diagnostics and the emit. The main thread posts each request with the generated source of
// every virtual module it reads, since only the main thread can ask the unframework plugin, and
// gets back JavaScript, its source map and the diagnostics as ngc prints them.
import { dirname, resolve } from "node:path";
import { parentPort, workerData } from "node:worker_threads";

import { COMPONENT_IMPORT, childKey } from "./ngtsc-virtual.ts";
import type { CompileRequest, Compiled, WorkerReply, WorkerRequest } from "./ngtsc-virtual.ts";
import { createHost, diagnosticCode, formatDiagnostics, strictOptions } from "./ngtsc.ts";
import { loadCompiler } from "./tools.ts";
import type { AngularCompiler, CompilerOptions, Diagnostic, NgtscProgram } from "./tools.ts";

const { toolchainDir } = workerData as { toolchainDir: string };
/** The compiler, and the strict options L3 checks with, set to emit. */
const loaded = loadCompiler(toolchainDir).then((compiler) => {
  const options: CompilerOptions = {
    ...strictOptions(compiler),
    noEmit: false,
    declaration: false,
    sourceMap: true,
    inlineSources: true,
    // AOT only: no TestBed or JIT metadata in what the browser runs.
    supportTestBed: false,
    supportJitMode: false,
  };
  return { compiler, options };
});
/** Each plugin's previous program, which its next compile reuses. */
const previous = new Map<number, NgtscProgram>();
// NgtscProgram reuse is sequential: a program can be the previous one of a single successor.
let queue: Promise<unknown> = Promise.resolve();

parentPort!.on("message", (message: WorkerRequest) => {
  queue = queue.then(async () => {
    if ("release" in message) {
      previous.delete(message.release);
      return;
    }
    let reply: WorkerReply;
    try {
      const { compiler, options } = await loaded;
      reply = { request: message.request, compiled: await compile(compiler, options, message) };
    } catch (failure) {
      reply = { request: message.request, failure };
    }
    parentPort!.postMessage(reply);
  });
});

async function compile(
  compiler: AngularCompiler,
  options: CompilerOptions,
  { plugin, id, sources, children }: CompileRequest,
): Promise<Compiled> {
  const { ts } = compiler;
  const inMemory = new Map(sources);
  const resolved = new Map(children);
  const host = createHost(compiler, options, (fileName) => inMemory.get(fileName));
  // `./Child.uf.tsx` in generated code means the child's generated Angular source, which is
  // the virtual `<abs>/Child.uf.tsx.ts`, not the unframework source on disk. TypeScript asks
  // `resolveModuleNameLiterals`; ngtsc's own module resolver asks `resolveModuleNames`.
  // A child's output (`./field`) means the virtual module Vite resolved it to (ADR-0053).
  const resolveOne = (
    name: string,
    containingFile: string,
    settings: CompilerOptions,
    redirect: unknown,
  ) => {
    const child = COMPONENT_IMPORT.test(name)
      ? `${resolve(dirname(containingFile), name)}.ts`
      : resolved.get(childKey(containingFile, name));
    return child
      ? {
          resolvedModule: {
            resolvedFileName: child,
            extension: ts.Extension.Ts,
            isExternalLibraryImport: false,
          },
        }
      : ts.resolveModuleName(name, containingFile, settings, host, undefined, redirect);
  };
  host.resolveModuleNameLiterals = (literals, containingFile, redirect, settings) =>
    literals.map(({ text }) => resolveOne(text, containingFile, settings, redirect));
  host.resolveModuleNames = (names, containingFile, _reused, redirect, settings) =>
    names.map((name) => resolveOne(name, containingFile, settings, redirect).resolvedModule);
  const program = new compiler.cli.NgtscProgram([id], options, host, previous.get(plugin));
  previous.set(plugin, program);
  const tsProgram = program.getTsProgram();
  const sourceFile = tsProgram.getSourceFile(id);
  const isError = (diagnostic: Diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error;
  const diagnostics = [
    ...program.getTsOptionDiagnostics(),
    ...program.getNgOptionDiagnostics(),
    ...program.getTsSyntacticDiagnostics(),
  ];
  let code: string | undefined;
  let map: string | undefined;
  if (!diagnostics.some(isError)) {
    await program.compiler.analyzeAsync();
    // This module's own type errors too: an import that does not resolve would otherwise
    // compile against `any` and surface, if at all, as a misleading template error.
    diagnostics.push(
      ...program.getTsSemanticDiagnostics(sourceFile),
      ...program.getNgStructuralDiagnostics(),
      ...program.getNgSemanticDiagnostics(id),
    );
  }
  if (!diagnostics.some(isError)) {
    const { transformers } = program.compiler.prepareEmit();
    const emitted = tsProgram.emit(
      sourceFile,
      (fileName, text) => {
        if (fileName.endsWith(".map")) map = text;
        else if (/\.[cm]?js$/.test(fileName)) code = text;
      },
      undefined,
      false,
      transformers,
    );
    diagnostics.push(...emitted.diagnostics);
    // The map goes to Vite with the code, not through a comment pointing at a file.
    code = code?.replace(/\n\/\/# sourceMappingURL=\S+\s*$/, "\n");
  }
  const errors = diagnostics.filter(isError);
  const warnings = diagnostics.filter((diagnostic) => !isError(diagnostic));
  let exports: string[] = [];
  if (errors.length && sourceFile) {
    const checker = tsProgram.getTypeChecker();
    const symbol = checker.getSymbolAtLocation(sourceFile);
    exports = symbol ? checker.getExportsOfModule(symbol).map(({ name }) => name) : [];
  }
  return {
    ...(code === undefined ? {} : { code }),
    ...(map === undefined ? {} : { map }),
    errors: formatDiagnostics(compiler, errors),
    codes: [...new Set(errors.map(diagnosticCode))],
    warnings: formatDiagnostics(compiler, warnings),
    exports,
  };
}
