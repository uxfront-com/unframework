// L3 for Solid: babel-preset-solid (dom-expressions) on Babel 7, in the two modes the Vite
// plugin compiles with: `dom` for the browser and hydratable `ssr` for the server.
import { createRequire } from "node:module";

import type * as Babel from "@babel/core";
import type { FrameworkCompileResult, ToolchainFile, ToolchainMessage } from "@unframework/codegen";
import { assertFilesToCompile } from "@unframework/codegen/toolchain-node";

/** dom-expressions' template validation starts every warning with this line. */
const MALFORMED = "The HTML provided is malformed";

/**
 * Compiles each file in `dom` and then `ssr` mode. Babel's parse and plugin errors are errors.
 * Solid's only warning is its template validation, which compares each template with what a
 * browser would parse ("The HTML provided is malformed…") and prints the difference with
 * `console.warn`; anything printed during a compile is a warning.
 */
export async function compileWithSolid(
  files: readonly ToolchainFile[],
): Promise<Map<string, FrameworkCompileResult>> {
  assertFilesToCompile(files);
  const babel: typeof Babel = await import("@babel/core");
  if (!babel.version.startsWith("7.")) {
    throw new Error(`babel-preset-solid needs Babel 7, but @babel/core ${babel.version} loaded.`);
  }
  // By path, so Babel loads them with its own interop.
  const require = createRequire(import.meta.url);
  const solid = require.resolve("babel-preset-solid");
  const typescript = require.resolve("@babel/preset-typescript");
  // The check must run the compiler that vite-plugin-solid runs in the browser and SSR projects.
  const pluginsSolid = createRequire(require.resolve("vite-plugin-solid")).resolve(
    "babel-preset-solid",
  );
  if (pluginsSolid !== solid) {
    throw new Error(
      `vite-plugin-solid compiles with ${pluginsSolid}, but this check would use ${solid}: install one babel-preset-solid.`,
    );
  }
  return new Map(
    files.map((file) => [file.path, compileFile(babel, solid, typescript, file)] as const),
  );
}

function compileFile(
  babel: typeof Babel,
  solid: string,
  typescript: string,
  file: ToolchainFile,
): FrameworkCompileResult {
  const warnings = new Map<string, ToolchainMessage>();
  for (const generate of ["dom", "ssr"] as const) {
    let printed: string[];
    try {
      printed = printedWhile(() =>
        babel.transformSync(file.contents, {
          filename: file.path,
          babelrc: false,
          configFile: false,
          sourceMaps: false,
          ast: false,
          code: false,
          presets: [
            [solid, { generate, hydratable: generate === "ssr" }],
            [typescript, { isTSX: true, allExtensions: true, onlyRemoveTypeImports: true }],
          ],
        }),
      );
    } catch (error) {
      return { errors: [fromBabelError(error, file.path)], warnings: [...warnings.values()] };
    }
    // Both modes validate the same templates: report each problem once.
    for (const message of groupWarnings(printed)) {
      warnings.set(message, {
        message,
        code: message.startsWith(MALFORMED) ? "solid/malformed-html" : "solid/console",
      });
    }
  }
  return { errors: [], warnings: [...warnings.values()] };
}

/**
 * Runs `fn` and returns what it printed with `console.warn` and `console.error`. The console
 * is swapped process-wide, so `fn` must be synchronous: an `await` would capture other work.
 */
function printedWhile(fn: () => unknown): string[] {
  const printed: string[] = [];
  const { warn, error } = console;
  const capture = (...args: unknown[]): void => {
    printed.push(args.map((arg) => (typeof arg === "string" ? arg : String(arg))).join(""));
  };
  console.warn = capture;
  console.error = capture;
  try {
    fn();
  } finally {
    console.warn = warn;
    console.error = error;
  }
  return printed;
}

/**
 * dom-expressions prints one malformed template as four calls (the verdict, then the HTML as
 * written, as a browser would parse it, and as authored); join each group into one message.
 */
function groupWarnings(printed: readonly string[]): string[] {
  const groups: string[][] = [];
  for (const entry of printed) {
    const text = entry.trim();
    const current = groups.at(-1);
    if (current && !text.startsWith(MALFORMED)) current.push(text);
    else groups.push([text]);
  }
  return groups.map((group) => group.join("\n"));
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
