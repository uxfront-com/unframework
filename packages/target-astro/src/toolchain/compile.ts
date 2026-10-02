// Layer L3 for Astro: Astro's own compiler, `@astrojs/compiler-rs`, over each output file.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, posix, relative, sep } from "node:path";

import type { DiagnosticMessage, TransformOptions } from "@astrojs/compiler-rs";
import type {
  FrameworkCompileResult,
  ToolchainContext,
  ToolchainFile,
  ToolchainMessage,
} from "@unframework/codegen";
import { assertFilesToCompile, resolveInstalled } from "@unframework/codegen/toolchain-node";

const COMPILER = "@astrojs/compiler-rs";

/**
 * Compiles each file with the options Astro 7.3's Vite plugin passes
 * (`astro/dist/core/compile/compile.js`) at Astro's defaults: `compressHTML: "jsx"` and
 * `scopedStyleStrategy: "attribute"`. Astro throws on the first error and drops every other
 * diagnostic; here an `error` diagnostic or a style error is an error, and any other severity is
 * a warning, so the gate's "zero warnings" sees everything the compiler says.
 *
 * Two of Astro's inputs need a Vite server and are left out: `preprocessedStyles` (Vite's CSS
 * pipeline, which is what reports CSS syntax errors) and the project's `site`.
 *
 * Rejects when the compiler is not the version the project's `astro` depends on.
 */
export async function astroFrameworkCompile(
  files: readonly ToolchainFile[],
  context: ToolchainContext,
): Promise<Map<string, FrameworkCompileResult>> {
  assertFilesToCompile(files);
  assertCompilerMatchesAstro(context.root);
  const { transform } = await import("@astrojs/compiler-rs");
  const results = new Map<string, FrameworkCompileResult>();
  for (const file of files) {
    const result: FrameworkCompileResult = { errors: [], warnings: [] };
    try {
      const output = transform(file.contents, transformOptions(file.path, context.root));
      for (const diagnostic of output.diagnostics) {
        (diagnostic.severity === "error" ? result.errors : result.warnings).push(
          fromDiagnostic(diagnostic),
        );
      }
      for (const message of output.styleError) result.errors.push({ message });
    } catch (error) {
      // The compiler reports bad input as diagnostics; a throw is a compiler failure on this file.
      result.errors.push({ message: `${COMPILER} failed: ${String(error)}` });
    }
    results.set(file.path, result);
  }
  return results;
}

function transformOptions(filename: string, root: string): TransformOptions {
  return {
    compact: "jsx",
    filename,
    normalizedFilename: normalizeFilename(filename, root),
    sourcemap: "both",
    internalURL: "astro/compiler-runtime",
    scopedStyleStrategy: "attribute",
    resultScopedSlot: true,
    transitionsAnimationURL: "astro/components/viewtransitions.css",
    annotateSourceFile: false,
    // Astro always passes one, which selects the compiler's code path for resolved imports.
    // The output is never run here, so resolving against the file's directory is enough.
    resolvePath: (specifier) =>
      specifier.startsWith(".") ? posix.join(toPosix(dirname(filename)), specifier) : specifier,
  };
}

/** Astro's `normalizeFilename`: root-relative with a leading `/`, which seeds the scope hash. */
function normalizeFilename(filename: string, root: string): string {
  const path = relative(root, filename);
  return path.startsWith("..") || isAbsolute(path) ? toPosix(filename) : `/${toPosix(path)}`;
}

const toPosix = (path: string) => path.split(sep).join("/");

/** compiler-rs lines are 1-based and columns 0-based; toolchain messages are 1-based. */
function fromDiagnostic(diagnostic: DiagnosticMessage): ToolchainMessage {
  const label = diagnostic.labels[0];
  return {
    message: diagnostic.hint ? `${diagnostic.text} (${diagnostic.hint})` : diagnostic.text,
    ...(label ? { line: label.line, column: label.column + 1 } : {}),
  };
}

/**
 * The checker imports compiler-rs directly, so a version that differs from the one the project's
 * `astro` compiles with would check different code. Throws when they differ.
 */
export function assertCompilerMatchesAstro(root: string): void {
  const astroManifest = resolveInstalled(root, "astro/package.json");
  if (!astroManifest) throw new Error(`L3 (astro): astro is not installed in ${root}.`);
  const theirs = versionOf(createRequire(astroManifest));
  const ours = versionOf(createRequire(import.meta.url));
  if (theirs !== ours) {
    throw new Error(
      `L3 (astro): astro compiles with ${COMPILER}@${theirs}, but the toolchain checks with ${ours}. Pin them to the same version.`,
    );
  }
}

function versionOf(require: NodeJS.Require): string {
  const manifest = JSON.parse(readFileSync(require.resolve(`${COMPILER}/package.json`), "utf8"));
  return (manifest as { version: string }).version;
}
