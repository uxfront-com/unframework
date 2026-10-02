// L3 for Vue: runs @vue/compiler-sfc the way @vitejs/plugin-vue does in a dev server (parse,
// compileScript, compileTemplate for the DOM and for SSR, compileStyle) and collects every error
// and warning, wherever the compiler reports it (spike: framework-compile ADR).
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { format, stripVTControlCharacters } from "node:util";

import type { FrameworkCompileResult, ToolchainFile, ToolchainMessage } from "@unframework/codegen";
import { assertFilesToCompile } from "@unframework/codegen/toolchain-node";
import type {
  BindingMetadata,
  CompilerError,
  SFCDescriptor,
  SFCStyleCompileOptions,
  TemplateCompiler,
} from "vue/compiler-sfc";
import type * as CompilerSfcModule from "vue/compiler-sfc";

type CompilerSfc = typeof CompilerSfcModule;

interface VueCompilers {
  /** A private instance of @vue/compiler-sfc, for one file (see {@link privateCompilerSfc}). */
  sfc(): CompilerSfc;
  dom: TemplateCompiler;
  ssr: TemplateCompiler;
  /** The names of Vue's error codes (`23` → `X_INVALID_END_TAG`). */
  codeNames: ReadonlyMap<number, string>;
}

let compilers: Promise<VueCompilers> | undefined;

/** Loads Vue's compilers on first use, so importing the toolchain stays cheap. */
function loadCompilers(): Promise<VueCompilers> {
  compilers ??= (async () => {
    // `vue/compiler-sfc` re-exports @vue/compiler-sfc, the CommonJS build resolved from `vue`.
    const fromVue = createRequire(createRequire(import.meta.url).resolve("vue/package.json"));
    const sfcPath = fromVue.resolve("@vue/compiler-sfc");
    // The template compilers are compiler-sfc's own dependencies, resolved from it, so they are
    // exactly the versions compileTemplate would pick by itself.
    const fromSfc = createRequire(sfcPath);
    const dom = fromSfc("@vue/compiler-dom") as TemplateCompiler & {
      ErrorCodes: Record<string, string | number>;
      DOMErrorCodes: Record<string, string | number>;
    };
    const ssr = fromSfc("@vue/compiler-ssr") as Pick<TemplateCompiler, "compile">;
    return {
      sfc: () => privateCompilerSfc(fromSfc, sfcPath),
      dom,
      // compiler-ssr has no parser of its own: compileTemplate also parses SSR templates with
      // compiler-dom.
      ssr: {
        parse: (template, options) => dom.parse(template, options),
        compile: (template, options) => ssr.compile(template, options),
      },
      // Each enum ends with an `__EXTEND_POINT__` that shares its number with the next enum's
      // first code.
      codeNames: new Map(
        [dom.ErrorCodes, dom.DOMErrorCodes].flatMap((codes) =>
          Object.entries(codes).flatMap(([name, value]) =>
            typeof value === "number" && name !== "__EXTEND_POINT__"
              ? [[value, name] as const]
              : [],
          ),
        ),
      ),
    };
  })();
  return compilers;
}

/**
 * Evaluates @vue/compiler-sfc (the CommonJS module at `path`) afresh, for one file. It reports its
 * script warnings (a macro imported from `vue`, a `v-model` on a `const`) through a module-level
 * `warnOnce`: once one file has raised a warning, no later file in the process would, and its
 * L3 would pass. A private instance per file gives every file its own. Evaluating it again takes
 * about a millisecond (V8 keeps the compiled code); the process's shared instance, the one
 * plugin-vue compiles with, is put back in the require cache.
 */
function privateCompilerSfc(require: NodeJS.Require, path: string): CompilerSfc {
  const shared = require.cache[path];
  delete require.cache[path];
  try {
    return require(path) as CompilerSfc;
  } finally {
    if (shared) require.cache[path] = shared;
    else delete require.cache[path];
  }
}

/** Compiles each Vue file with Vue's own compiler, each with a compiler of its own. */
export async function frameworkCompile(
  files: readonly ToolchainFile[],
): Promise<Map<string, FrameworkCompileResult>> {
  assertFilesToCompile(files);
  // Under NODE_ENV=production, compiler-dom loads its production build and warnOnce is a no-op:
  // every warning disappears, and the check would pass without looking.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "The Vue toolchain refuses to run under NODE_ENV=production, which silences every " +
        "@vue/compiler-sfc warning. Unset NODE_ENV for toolchain checks.",
    );
  }
  const loaded = await loadCompilers();
  return new Map(files.map((file) => [file.path, compileSfc(loaded, file)]));
}

function compileSfc(vue: VueCompilers, file: ToolchainFile): FrameworkCompileResult {
  const sfc = vue.sfc();
  const source = file.contents;
  const errors: ToolchainMessage[] = [];
  const warnings: ToolchainMessage[] = [];
  const message = (error: CompilerError | SyntaxError | string, base = 0): ToolchainMessage =>
    fromCompilerError(error, source, base, vue.codeNames);
  const logged: string[] = [];

  const { descriptor, errors: parseErrors } = sfc.parse(source, {
    filename: file.path,
    sourceMap: false,
  });
  if (parseErrors.length > 0) {
    return { errors: parseErrors.map((error) => message(error)), warnings };
  }

  // plugin-vue hashes the path; the id only names the scope attribute of scoped styles.
  const id = createHash("sha256").update(file.path).digest("hex").slice(0, 8);
  const lang = descriptor.scriptSetup?.lang ?? descriptor.script?.lang;

  let bindings: BindingMetadata | undefined;
  if (descriptor.script || descriptor.scriptSetup) {
    try {
      bindings = capturingConsole(logged, () =>
        sfc.compileScript(descriptor, {
          id,
          isProd: false,
          inlineTemplate: false,
          sourceMap: false,
        }),
      ).bindings;
    } catch (error) {
      errors.push(scriptError(error, descriptor, source));
    }
  }

  const template = descriptor.template;
  if (template) {
    // With a custom compiler, compileTemplate compiles the block's content, so locations are
    // relative to the start of the content.
    const base = template.loc.start.offset;
    for (const ssr of [false, true]) {
      const reported: CompilerError[] = [];
      try {
        const result = capturingConsole(logged, () =>
          sfc.compileTemplate({
            source: template.content,
            filename: file.path,
            id,
            scoped: descriptor.styles.some((style) => style.scoped),
            slotted: descriptor.slotted,
            ssr,
            ssrCssVars: descriptor.cssVars,
            isProd: false,
            compiler: reportingWarnings(ssr ? vue.ssr : vue.dom, reported),
            // As the toolchain configures plugin-vue: static URLs stay plain strings.
            transformAssetUrls: false,
            compilerOptions: {
              bindingMetadata: bindings,
              expressionPlugins: lang && /tsx?$/.test(lang) ? ["typescript"] : [],
            },
          }),
        );
        errors.push(...result.errors.map((error) => message(error, base)));
      } catch (error) {
        errors.push(thrown(error));
      }
      warnings.push(...reported.map((warning) => message(warning, base)));
    }
  }

  for (const style of descriptor.styles) {
    // An external stylesheet is a separate file, not part of this component's source.
    if (style.src) continue;
    try {
      const result = capturingConsole(logged, () =>
        sfc.compileStyle({
          source: style.content,
          filename: file.path,
          id: `data-v-${id}`,
          scoped: style.scoped,
          isProd: false,
          preprocessLang: style.lang as SFCStyleCompileOptions["preprocessLang"],
        }),
      );
      errors.push(...result.errors.map((error) => styleError(error, style.loc.start)));
    } catch (error) {
      errors.push(thrown(error));
    }
  }

  warnings.push(...logged.map((text) => ({ message: text })));
  return { errors: unique(errors), warnings: unique(warnings) };
}

/**
 * compileTemplate replaces `onWarn` with its own and flattens warnings into `tips`, strings
 * without a location. Wrapping the compiler keeps the structured warnings.
 */
function reportingWarnings(compiler: TemplateCompiler, sink: CompilerError[]): TemplateCompiler {
  return {
    parse: (template, options) => compiler.parse(template, options),
    compile: (template, options) =>
      compiler.compile(template, {
        ...options,
        onWarn(warning) {
          sink.push(warning);
          options.onWarn?.(warning);
        },
      }),
  };
}

/**
 * Runs synchronous compiler work while collecting what it prints: some Vue warnings only ever
 * reach `console.warn`. The swap is process-wide, so it must never span an `await`.
 */
function capturingConsole<T>(sink: string[], run: () => T): T {
  const { warn, error } = console;
  const capture = (...args: unknown[]) => {
    sink.push(stripVTControlCharacters(format(...args)).trim());
  };
  console.warn = capture;
  console.error = capture;
  try {
    return run();
  } finally {
    console.warn = warn;
    console.error = error;
  }
}

function fromCompilerError(
  error: CompilerError | SyntaxError | string,
  source: string,
  base: number,
  codeNames: VueCompilers["codeNames"],
): ToolchainMessage {
  if (typeof error === "string") return { message: error };
  const { code, loc } = error as Partial<CompilerError>;
  return {
    message: error.message,
    ...(loc ? positionAt(source, base + loc.start.offset) : {}),
    ...(typeof code === "number" ? { code: codeNames.get(code) ?? `VUE_${code}` } : {}),
  };
}

/**
 * compileScript throws its errors. Babel's syntax errors carry an offset into the script block
 * they come from, which is only certain when the component has one script block; the message
 * itself always holds a code frame.
 */
function scriptError(error: unknown, descriptor: SFCDescriptor, source: string): ToolchainMessage {
  const blocks = [descriptor.script, descriptor.scriptSetup].filter((block) => block !== null);
  const base = blocks.length === 1 ? blocks[0]!.loc.start.offset : undefined;
  return base === undefined ? thrown(error) : thrown(error, base, source);
}

/** A thrown error; `pos` (Babel's offset) is located when the block's offset is known. */
function thrown(error: unknown, base?: number, source?: string): ToolchainMessage {
  if (!(error instanceof Error)) return { message: String(error) };
  const { code, pos } = error as Error & { code?: unknown; pos?: unknown };
  return {
    message: error.message.trim(),
    ...(base !== undefined && source !== undefined && typeof pos === "number"
      ? positionAt(source, base + pos)
      : {}),
    ...(typeof code === "string" ? { code } : {}),
  };
}

/**
 * PostCSS errors carry a line and column within the style block, and a `reason`: their message
 * repeats the position, relative to the block.
 */
function styleError(error: Error, start: { line: number; column: number }): ToolchainMessage {
  const { line, column, reason } = error as Error & {
    line?: unknown;
    column?: unknown;
    reason?: unknown;
  };
  if (typeof line !== "number" || typeof column !== "number") return thrown(error);
  return {
    message: typeof reason === "string" ? reason : error.message.trim(),
    line: start.line + line - 1,
    column: line === 1 ? start.column + column - 1 : column,
  };
}

/** The 1-based line and column of an offset. */
function positionAt(source: string, offset: number): { line: number; column: number } {
  const before = source.slice(0, offset);
  const lineStart = before.lastIndexOf("\n") + 1;
  return { line: before.split("\n").length, column: offset - lineStart + 1 };
}

/** The DOM and SSR passes share a parser, so they report the same problems twice. */
function unique(messages: ToolchainMessage[]): ToolchainMessage[] {
  const seen = new Set<string>();
  return messages.filter((item) => {
    const key = JSON.stringify([item.code, item.line, item.column, item.message]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
