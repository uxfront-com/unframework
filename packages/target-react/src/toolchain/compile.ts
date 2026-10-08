// L3 for React: React Compiler 1.0 (`babel-plugin-react-compiler`) on Babel 7, the way a React
// 19 app compiles with the compiler on. Babel 8 is refused: React Compiler 1.0 bails out on
// its ASTs (for example on a destructured default, `({ name = "world" })`).
import { createRequire } from "node:module";

import type * as Babel from "@babel/core";
import type { FrameworkCompileResult, ToolchainFile, ToolchainMessage } from "@unframework/codegen";
import { assertFilesToCompile } from "@unframework/codegen/toolchain-node";
import type { LoggerEvent, PluginOptions } from "babel-plugin-react-compiler";

/**
 * A Babel source location (1-based lines, 0-based columns), or the symbol React Compiler
 * uses for code it generated itself.
 */
type Location = Babel.types.SourceLocation | symbol | null | undefined;

/**
 * Runs React Compiler over each file and collects what it reports:
 * - a file Babel cannot parse, and a compiler crash (`PipelineError`), are errors;
 * - a bailout (`CompileError`: the function was left uncompiled, for instance for breaking
 *   the Rules of React), a `CompileDiagnostic` and a skipped function are warnings;
 * - a function that opts out (`"use no memo"`, which the target prints where React Compiler
 *   cannot compile the component yet, ADR-0046) passes only where React Compiler still finds what
 *   it cannot compile there (a `Todo` or an `Invariant`): another bailout in it is a warning, and
 *   an opt-out React Compiler would compile is one too (`react-compiler/needless-opt-out`);
 * - a file in which nothing compiled is a warning too (`react-compiler/nothing-compiled`),
 *   so the check never passes because the compiler ignored the file.
 */
export async function compileWithReactCompiler(
  files: readonly ToolchainFile[],
): Promise<Map<string, FrameworkCompileResult>> {
  assertFilesToCompile(files);
  const babel: typeof Babel = await import("@babel/core");
  if (!babel.version.startsWith("7.")) {
    throw new Error(`React Compiler 1.0 needs Babel 7, but @babel/core ${babel.version} loaded.`);
  }
  // By path, so Babel loads them with its own interop.
  const require = createRequire(import.meta.url);
  const compiler = require.resolve("babel-plugin-react-compiler");
  const typescript = require.resolve("@babel/preset-typescript");
  return new Map(
    files.map((file) => [file.path, compileFile(babel, compiler, typescript, file)] as const),
  );
}

function compileFile(
  babel: typeof Babel,
  compiler: string,
  typescript: string,
  file: ToolchainFile,
): FrameworkCompileResult {
  const errors: ToolchainMessage[] = [];
  const warnings: ToolchainMessage[] = [];
  let compiled = 0;
  // The functions that opt out, by where they start, and those React Compiler cannot compile.
  const optedOut = optOuts(babel, typescript, file);
  const needed = new Set<string>();
  const skipped = new Map<string, ToolchainMessage>();
  const logEvent = (_filename: string | null, event: LoggerEvent): void => {
    switch (event.kind) {
      case "CompileSuccess":
        compiled++;
        break;
      case "CompileError":
      case "CompileDiagnostic": {
        const { detail } = event;
        const fn = optedOut.get(key(event.fnLoc) ?? "");
        if (fn && UNSUPPORTED.has(detail.category)) {
          needed.add(fn);
          break;
        }
        const location = "primaryLocation" in detail ? detail.primaryLocation() : detail.loc;
        warnings.push({
          message: detail.description ? `${detail.reason}: ${detail.description}` : detail.reason,
          ...at(location, event.fnLoc),
          code: `react-compiler/${detail.category}`,
        });
        break;
      }
      case "CompileSkip": {
        const message = {
          message: skipReason(event.reason, event.loc, file.contents),
          ...at(event.loc, event.fnLoc),
          code: "react-compiler/skip",
        };
        const fn = optedOut.get(key(event.fnLoc) ?? "");
        if (fn) skipped.set(fn, message);
        else warnings.push(message);
        break;
      }
      case "PipelineError":
        errors.push({ message: event.data, ...at(event.fnLoc), code: "react-compiler/pipeline" });
        break;
      default:
        // Timing and auto-deps events carry no verdict on the code.
        break;
    }
  };
  const options: PluginOptions = {
    target: "19",
    // Report every problem through the logger instead of throwing on the first one.
    panicThreshold: "none",
    // What a React app compiles: components and hooks, recognised by their names.
    compilationMode: "infer",
    logger: { logEvent },
  };
  try {
    babel.transformSync(file.contents, {
      filename: file.path,
      babelrc: false,
      configFile: false,
      sourceMaps: false,
      ast: false,
      code: false,
      // React Compiler must be the first plugin.
      plugins: [[compiler, options]],
      presets: [[typescript, { isTSX: true, allExtensions: true, onlyRemoveTypeImports: true }]],
    });
  } catch (error) {
    return { errors: [...errors, fromBabelError(error, file.path)], warnings };
  }
  for (const [fn, message] of skipped) {
    if (needed.has(fn)) continue;
    warnings.push({
      ...message,
      message: `${message.message} React Compiler compiles this function: it needs no opt-out.`,
      code: "react-compiler/needless-opt-out",
    });
  }
  // An opt-out React Compiler confirms was checked too.
  compiled += needed.size;
  if (compiled === 0 && errors.length === 0 && warnings.length === 0) {
    warnings.push({
      message: "React Compiler compiled no component or hook in this file, so it checked nothing.",
      code: "react-compiler/nothing-compiled",
    });
  }
  return { errors, warnings };
}

/**
 * The categories of what React Compiler cannot compile yet, rather than code it rejects: in a
 * function that opts out, they are the reason it does.
 */
const UNSUPPORTED: ReadonlySet<string> = new Set(["Todo", "Invariant"]);

/** React Compiler's opt-out directives (its `OPT_OUT_DIRECTIVES`). */
const OPT_OUT = new Set(["use no memo", "use no forget"]);

/** Where a function starts, as React Compiler's events locate it. */
function key(location: Location): string | undefined {
  return isSourceLocation(location) ? `${location.start.line}:${location.start.column}` : undefined;
}

/**
 * The functions of a file that opt out of React Compiler: each by where it starts, under where
 * it and its body start, as React Compiler's events locate a function by either.
 */
function optOuts(
  babel: typeof Babel,
  typescript: string,
  file: ToolchainFile,
): Map<string, string> {
  const found = new Map<string, string>();
  if (![...OPT_OUT].some((directive) => file.contents.includes(directive))) return found;
  let ast: Babel.types.File | null;
  try {
    ast = babel.parseSync(file.contents, {
      filename: file.path,
      babelrc: false,
      configFile: false,
      presets: [[typescript, { isTSX: true, allExtensions: true, onlyRemoveTypeImports: true }]],
    });
  } catch {
    // The transform reports the parse error.
    return found;
  }
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (typeof node !== "object" || node === null) return;
    const { body, loc } = node as {
      body?: { directives?: { value: { value: string } }[]; loc?: Location };
      loc?: Location;
    };
    const start = key(loc);
    if (start && body?.directives?.some(({ value }) => OPT_OUT.has(value.value))) {
      found.set(start, start);
      const inner = key(body.loc);
      if (inner) found.set(inner, start);
    }
    for (const [field, value] of Object.entries(node)) {
      if (field !== "loc" && typeof value === "object") visit(value);
    }
  };
  visit(ast?.program);
  return found;
}

/** The 1-based line and column of the first usable location (Babel's columns are 0-based). */
function at(...locations: Location[]): { line?: number; column?: number } {
  const location = locations.find(isSourceLocation);
  return location ? { line: location.start.line, column: location.start.column + 1 } : {};
}

function isSourceLocation(location: Location): location is Babel.types.SourceLocation {
  return typeof location === "object" && location !== null;
}

/**
 * React Compiler 1.0 prints a skip directive as `'[object Object]'`; put the directive's
 * source text back, so the message names it.
 */
function skipReason(reason: string, location: Location, source: string): string {
  if (!reason.includes("'[object Object]'") || !isSourceLocation(location)) return reason;
  const directive = source.slice(location.start.index, location.end.index).replace(/;$/, "");
  return reason.replace("'[object Object]'", directive);
}

/**
 * A Babel parse or plugin error as a message: its first line, without the file name or the
 * `(line:column)` Babel appends, which the message's own 1-based position replaces.
 */
function fromBabelError(error: unknown, filename: string): ToolchainMessage {
  if (!(error instanceof Error)) return { message: String(error) };
  const { loc, reasonCode, code } = error as Error & {
    loc?: { line: number; column: number };
    reasonCode?: string;
    code?: string;
  };
  let message = error.message.split("\n")[0] ?? error.message;
  if (message.startsWith(`${filename}: `)) message = message.slice(filename.length + 2);
  if (loc) message = message.replace(` (${loc.line}:${loc.column})`, "");
  return {
    message,
    ...(loc ? { line: loc.line, column: loc.column + 1 } : {}),
    ...((reasonCode ?? code) ? { code: reasonCode ?? code } : {}),
  };
}
