// Real ngtsc AOT for virtual modules. Analog compiles only the files of its tsconfig program on
// disk, and an Angular module from the unframework plugin exists only through `load`, so this
// plugin compiles it with `NgtscProgram` over an in-memory host, before Analog sees it. Analog
// then finds no decorators left and passes the module through (the Angular+Qwik ADR). A child
// that a module imports is a virtual module too, so it is resolved and loaded first (ADR-0053).
import { dirname, resolve } from "node:path";

import type { Plugin } from "vite";

import { createHost, diagnosticCode, formatDiagnostics, strictOptions } from "./ngtsc.ts";
import type { AngularCompiler, CompilerOptions, Diagnostic, NgtscProgram } from "./tools.ts";

/**
 * The Angular id scheme of the unframework plugin, not on disk: `<abs>/X.uf.tsx.ts` for a file's
 * main component, and `<abs>/X.uf.tsx.<output file>` for any other (`Card.uf.tsx.card-icon.ts`,
 * ADR-0053).
 */
const VIRTUAL_ID = /\.uf\.tsx(?:\.[^/?]+)?\.ts$/;
/**
 * A relative import or re-export in generated code, of a child's output (`./field`, ADR-0053)
 * or of a file on disk: its specifier is the first group.
 */
const RELATIVE_IMPORT = /^\s*(?:import|export)\b[^"';]*?["'](\.\.?\/[^"']+)["']/gm;
/** An import of another component in generated code: `./Child.uf.tsx`. */
const COMPONENT_IMPORT = /^\.\.?\/.*\.uf\.tsx$/;

/** What the unframework plugin exposes for reading the code it compiled. */
export interface UnframeworkApi {
  getCompiled(id: string): string | undefined;
}

/** The outcome of one compile: JavaScript and its source map, or what stopped it. */
interface Compiled {
  code?: string;
  map?: string;
  errors: Diagnostic[];
  warnings: Diagnostic[];
  /** The module's export names, for a module that has to stand in for a rejected one. */
  exports: string[];
}

/**
 * Compiles `<abs>/X.uf.tsx.ts` ids with Angular's AOT compiler under the strict options L3
 * checks with, failing the module on any error (template type errors included) and passing
 * warnings to Vite. Compiles run one at a time, each reusing the previous program, so libraries
 * are analysed once.
 */
export function ngtscVirtual(compiler: AngularCompiler): Plugin {
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
  let api: UnframeworkApi | undefined;
  let previous: NgtscProgram | undefined;
  /** The virtual module each relative import of a virtual module resolved to, by importer. */
  const children = new Map<string, string>();
  // NgtscProgram reuse is sequential: a program can be the previous one of a single successor.
  let queue: Promise<unknown> = Promise.resolve();

  async function compile(id: string, code: string): Promise<Compiled> {
    const { ts } = compiler;
    const contents = (fileName: string) =>
      fileName === id ? code : VIRTUAL_ID.test(fileName) ? api!.getCompiled(fileName) : undefined;
    const host = createHost(compiler, options, contents);
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
        : children.get(childKey(containingFile, name));
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
    const program = new compiler.cli.NgtscProgram([id], options, host, previous);
    previous = program;
    const tsProgram = program.getTsProgram();
    const sourceFile = tsProgram.getSourceFile(id);
    const isError = (diagnostic: Diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error;
    const diagnostics = [
      ...program.getTsOptionDiagnostics(),
      ...program.getNgOptionDiagnostics(),
      ...program.getTsSyntacticDiagnostics(),
    ];
    const compiled: Compiled = { errors: [], warnings: [], exports: [] };
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
          if (fileName.endsWith(".map")) compiled.map = text;
          else if (/\.[cm]?js$/.test(fileName)) compiled.code = text;
        },
        undefined,
        false,
        transformers,
      );
      diagnostics.push(...emitted.diagnostics);
      // The map goes to Vite with the code, not through a comment pointing at a file.
      compiled.code = compiled.code?.replace(/\n\/\/# sourceMappingURL=\S+\s*$/, "\n");
    }
    compiled.errors = diagnostics.filter(isError);
    compiled.warnings = diagnostics.filter((diagnostic) => !isError(diagnostic));
    if (compiled.errors.length && sourceFile) {
      const checker = tsProgram.getTypeChecker();
      const symbol = checker.getSymbolAtLocation(sourceFile);
      compiled.exports = symbol ? checker.getExportsOfModule(symbol).map(({ name }) => name) : [];
    }
    return compiled;
  }

  return {
    name: "unframework:angular-ngtsc",
    enforce: "pre",
    configResolved(config) {
      const plugin = config.plugins.find((candidate) => candidate.name === "unframework");
      const candidate = (plugin as { api?: Partial<UnframeworkApi> } | undefined)?.api;
      if (typeof candidate?.getCompiled !== "function") {
        throw new Error(
          "The Angular toolchain compiles the unframework plugin's output, but this Vite config " +
            'has no plugin named "unframework" exposing api.getCompiled(id). Add ' +
            "@unframework/unplugin/vite before the Angular toolchain's plugins.",
        );
      }
      api = candidate as UnframeworkApi;
    },
    transform: {
      filter: { id: /\.uf\.tsx(?:\.[^/?]+)?\.ts(?:\?|$)/ },
      async handler(code, rawId) {
        const id = rawId.split("?")[0]!;
        // ngtsc reads a child's source from the unframework plugin, which has it only once Vite
        // has loaded the child (ADR-0027's negative): resolve each relative import with Vite
        // and load the virtual modules it names before this module compiles (ADR-0053). A child
        // whose source the plugin holds is loaded, or being loaded, already: that also ends a
        // cycle of imports.
        for (const [, fileName = ""] of code.matchAll(RELATIVE_IMPORT)) {
          if (COMPONENT_IMPORT.test(fileName)) continue;
          const resolved = await this.resolve(fileName, id);
          const child = resolved?.id.split("?")[0];
          if (!resolved || !child || !VIRTUAL_ID.test(child)) continue;
          children.set(childKey(id, fileName), child);
          if (api!.getCompiled(child) === undefined) await this.load({ id: resolved.id });
        }
        const run = queue.then(() => compile(id, code));
        // The queue only orders compiles; each caller still gets its own outcome or error.
        queue = run.then(
          () => undefined,
          () => undefined,
        );
        const compiled = await run;
        if (compiled.warnings.length) this.warn(formatDiagnostics(compiler, compiled.warnings));
        if (compiled.errors.length) {
          const codes = [...new Set(compiled.errors.map(diagnosticCode))].join(", ");
          const message = `ngtsc rejected ${id} (${codes}):\n${formatDiagnostics(compiler, compiled.errors)}`;
          // A page gets a module that failed to transform only as "Failed to fetch dynamically
          // imported module", without the reason. Served to a browser, the module throws the
          // reason instead, so it reaches the test report; the server log keeps it too.
          if (this.environment.mode === "dev" && this.environment.config.consumer === "client") {
            this.environment.logger.error(message);
            return { code: failingModule(message, compiled.exports), map: null };
          }
          this.error(message);
        }
        if (compiled.code === undefined) this.error(`ngtsc emitted no JavaScript for ${id}`);
        return { code: compiled.code, map: compiled.map ?? null };
      },
    },
  };
}

/** The key of an import in `children`: the importing file and the specifier. */
function childKey(importer: string, specifier: string): string {
  return `${importer}\0${specifier}`;
}

/**
 * A module that throws `message` when it runs and still provides every export of the module it
 * stands in for, so its importers link and the message is what they see.
 */
function failingModule(message: string, exports: readonly string[]): string {
  const lines = [`throw new Error(${JSON.stringify(message)});`, "export default undefined;"];
  const named = exports.filter((name) => name !== "default");
  if (named.length) {
    lines.push(
      "const failed = undefined;",
      `export { ${named.map((name) => `failed as ${JSON.stringify(name)}`).join(", ")} };`,
    );
  }
  return `${lines.join("\n")}\n`;
}
